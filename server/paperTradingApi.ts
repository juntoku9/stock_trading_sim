import { randomInt, randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { Pool, type PoolClient } from 'pg';
import YahooFinance from 'yahoo-finance2';
import { toYahooSymbol, violatesLimit, weightedAverageCost } from '../services/tradeMath';

const STARTING_CASH = 100000;

/** Cap what a single profile response carries so payloads don't grow forever. */
const MAX_TRADES_RETURNED = 200;
const MAX_SNAPSHOTS_RETURNED = 300;

/** How long a cached quote may be reused for display/valuation (not execution). */
const QUOTE_CACHE_TTL_MS = 30_000;

type QuoteResult = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  /** Company name when Yahoo provides one (used by the watchlist restore). */
  name?: string;
};

type League = {
  name: string;
  type: 'public' | 'private';
  roomMode?: 'create' | 'join';
  roomCode?: string;
};

type TradeRequest = {
  symbol: string;
  shares: number;
  type: 'BUY' | 'SELL';
  /**
   * Optional guard used when the client executes a triggered limit/stop-limit
   * order: the trade is rejected if the live price has moved through the limit,
   * so a "buy at $200 max" can never fill at $201.
   */
  limitPrice?: number;
};

type OrderRequest = {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'STOP_LOSS' | 'STOP_LIMIT';
  shares: number;
  limitPrice?: number;
  stopPrice?: number;
};

type PoolLike = Pool | null;
type YahooFinanceClient = InstanceType<typeof YahooFinance>;

type BodyRequest<T> = IncomingMessage & {
  body?: T;
};

const numeric = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const json = (res: ServerResponse, statusCode: number, body: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readJsonBody = async <T>(req: BodyRequest<T>): Promise<T | null> => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
};

/** Mirrors the client-side sanitizer — never trust display fields from the wire. */
const sanitizeUsername = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);

const sanitizeRealName = (value: string): string => value.trim().slice(0, 64);

const createDatabasePool = (databaseUrl?: string): PoolLike => {
  if (!databaseUrl) {
    return null;
  }

  return new Pool({
    connectionString: databaseUrl,
    // Trade-off: rejectUnauthorized:false skips cert verification. Convenient for
    // hosted dev databases (Neon etc.); tighten before pointing at production data.
    ssl: databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });
};

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export const getCurrentQuote = async (yahooFinance: YahooFinanceClient, symbol: string): Promise<QuoteResult> => {
  const quote = await yahooFinance.quote(toYahooSymbol(symbol));

  if (
    typeof quote.regularMarketPrice !== 'number' ||
    typeof quote.regularMarketChange !== 'number' ||
    typeof quote.regularMarketChangePercent !== 'number'
  ) {
    throw new Error(`Yahoo Finance returned incomplete data for ${symbol}.`);
  }

  return {
    symbol: symbol.toUpperCase(),
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
    name: quote.shortName ?? quote.longName ?? undefined,
  };
};

/**
 * Cached quote for display, snapshots and leaderboard valuation.
 * Trade EXECUTION always uses getCurrentQuote (fresh) — only valuation may be
 * up to QUOTE_CACHE_TTL_MS stale. This collapses the previous
 * O(users x holdings) serial Yahoo calls into mostly cache hits.
 */
const quoteCache = new Map<string, { quote: QuoteResult; fetchedAt: number }>();

export const getCachedQuote = async (
  yahooFinance: YahooFinanceClient,
  symbol: string,
  maxAgeMs: number = QUOTE_CACHE_TTL_MS
): Promise<QuoteResult> => {
  const key = symbol.toUpperCase();
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < maxAgeMs) {
    return hit.quote;
  }

  const quote = await getCurrentQuote(yahooFinance, symbol);
  quoteCache.set(key, { quote, fetchedAt: Date.now() });
  return quote;
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ensureSchema = (() => {
  let promise: Promise<void> | null = null;

  return async (pool: PoolLike) => {
    if (!pool) {
      return;
    }

    if (!promise) {
      promise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_users (
            clerk_user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            real_name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS portfolios (
            id TEXT PRIMARY KEY,
            clerk_user_id TEXT NOT NULL UNIQUE REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
            cash NUMERIC(14, 2) NOT NULL,
            league_name TEXT NOT NULL,
            league_type TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        // Room codes make private leagues actually joinable (they previously
        // matched on league_name only, so "join by code" silently did nothing).
        await pool.query(`
          ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS league_room_code TEXT;
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS holdings (
            portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL,
            shares INTEGER NOT NULL,
            average_cost NUMERIC(14, 4) NOT NULL,
            PRIMARY KEY (portfolio_id, symbol)
          );
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS trades (
            id TEXT PRIMARY KEY,
            portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL,
            type TEXT NOT NULL,
            shares INTEGER NOT NULL,
            price_at_trade NUMERIC(14, 4) NOT NULL,
            created_at_ms BIGINT NOT NULL
          );
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS portfolio_snapshots (
            id TEXT PRIMARY KEY,
            portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            total_value NUMERIC(14, 2) NOT NULL,
            recorded_at_ms BIGINT NOT NULL
          );
        `);
        // Server-persisted conditional orders — they used to live only in React
        // state, so a refresh silently deleted every stop-loss.
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pending_orders (
            id TEXT PRIMARY KEY,
            portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            order_type TEXT NOT NULL,
            shares INTEGER NOT NULL,
            limit_price NUMERIC(14, 4),
            stop_price NUMERIC(14, 4),
            stop_triggered BOOLEAN NOT NULL DEFAULT FALSE,
            last_error TEXT,
            placed_at_ms BIGINT NOT NULL
          );
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS trades_portfolio_created_idx
            ON trades (portfolio_id, created_at_ms DESC);
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS snapshots_portfolio_recorded_idx
            ON portfolio_snapshots (portfolio_id, recorded_at_ms DESC);
        `);
        // Best-effort: enforce unique usernames going forward. If a legacy DB
        // already contains duplicates the index can't be created — log and
        // continue rather than taking the whole API down.
        try {
          await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_unique
              ON app_users (username);
          `);
        } catch (error) {
          console.warn('Could not enforce unique usernames (existing duplicates?):', error);
        }
      })().catch((error) => {
        // Reset so the next request retries instead of caching the failure forever.
        promise = null;
        throw error;
      });
    }

    await promise;
  };
})();

// ---------------------------------------------------------------------------
// Profile mapping
// ---------------------------------------------------------------------------

const snapshotEvent = (label: string): 'BUY' | 'SELL' | 'START' | undefined => {
  if (label === 'Buy') return 'BUY';
  if (label === 'Sell') return 'SELL';
  if (label === 'Start') return 'START';
  return undefined;
};

const mapProfile = async (client: PoolClient, userId: string) => {
  const portfolioResult = await client.query(
    `SELECT p.id, p.cash, p.league_name, p.league_type, p.league_room_code,
            u.username, u.real_name
     FROM portfolios p
     JOIN app_users u ON u.clerk_user_id = p.clerk_user_id
     WHERE p.clerk_user_id = $1`,
    [userId]
  );

  if (portfolioResult.rowCount === 0) {
    return null;
  }

  const portfolio = portfolioResult.rows[0];
  const holdingsResult = await client.query(
    `SELECT symbol, shares, average_cost
     FROM holdings
     WHERE portfolio_id = $1
     ORDER BY symbol ASC`,
    [portfolio.id]
  );
  const tradesResult = await client.query(
    `SELECT id, symbol, type, shares, price_at_trade, created_at_ms
     FROM trades
     WHERE portfolio_id = $1
     ORDER BY created_at_ms DESC
     LIMIT $2`,
    [portfolio.id, MAX_TRADES_RETURNED]
  );
  // Latest N snapshots, returned oldest-first for charting.
  const snapshotsResult = await client.query(
    `SELECT label, total_value, recorded_at_ms
     FROM portfolio_snapshots
     WHERE portfolio_id = $1
     ORDER BY recorded_at_ms DESC
     LIMIT $2`,
    [portfolio.id, MAX_SNAPSHOTS_RETURNED]
  );

  return {
    id: portfolio.id,
    username: portfolio.username as string,
    realName: portfolio.real_name as string,
    cash: numeric(portfolio.cash),
    holdings: holdingsResult.rows.map((row) => ({
      symbol: row.symbol,
      shares: Number(row.shares),
      averageCost: numeric(row.average_cost),
    })),
    history: tradesResult.rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      type: row.type,
      shares: Number(row.shares),
      priceAtTrade: numeric(row.price_at_trade),
      timestamp: Number(row.created_at_ms),
    })),
    performanceHistory: snapshotsResult.rows.reverse().map((row) => ({
      // Real timestamps instead of 'Buy'/'Sell' strings polluting the time axis.
      time: new Date(Number(row.recorded_at_ms)).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      price: numeric(row.total_value),
      ts: Number(row.recorded_at_ms),
      event: snapshotEvent(row.label),
    })),
    achievements: [] as string[],
    league: {
      id: portfolio.id,
      name: portfolio.league_name,
      type: portfolio.league_type as 'public' | 'private',
      roomCode: (portfolio.league_room_code as string | null) ?? undefined,
    },
  };
};

// ---------------------------------------------------------------------------
// Profile creation & leagues
// ---------------------------------------------------------------------------

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

const generateRoomCode = async (client: PoolClient): Promise<string> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    const existing = await client.query(
      'SELECT 1 FROM portfolios WHERE league_room_code = $1 LIMIT 1',
      [code]
    );
    if (existing.rowCount === 0) {
      return code;
    }
  }
  throw new Error('Could not generate a unique room code. Please try again.');
};

const upsertUser = async (
  client: PoolClient,
  userId: string,
  username: string,
  realName: string
) => {
  try {
    await client.query(
      `INSERT INTO app_users (clerk_user_id, username, real_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (clerk_user_id)
       DO UPDATE SET username = EXCLUDED.username, real_name = EXCLUDED.real_name`,
      [userId, username, realName]
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error('That username is already taken — try another.');
    }
    throw error;
  }
};

const createProfile = async (
  client: PoolClient,
  userId: string,
  usernameRaw: string,
  realNameRaw: string,
  league: League
) => {
  const username = sanitizeUsername(usernameRaw ?? '');
  const realName = sanitizeRealName(realNameRaw ?? '');

  if (!username || !realName) {
    throw new Error('A username and full name are required.');
  }

  const existing = await mapProfile(client, userId);
  if (existing) {
    return existing;
  }

  // Resolve the league BEFORE creating anything so a bad room code fails cleanly.
  let leagueName = league.name?.trim();
  let roomCode: string | null = null;

  if (league.type === 'private') {
    if (league.roomMode === 'join') {
      const code = (league.roomCode ?? '').trim().toUpperCase();
      if (code.length !== 6) {
        throw new Error('Room codes are 6 characters.');
      }
      const room = await client.query(
        'SELECT league_name FROM portfolios WHERE league_room_code = $1 LIMIT 1',
        [code]
      );
      if (room.rowCount === 0) {
        throw new Error('Room not found. Double-check the code and try again.');
      }
      leagueName = room.rows[0].league_name;
      roomCode = code;
    } else {
      if (!leagueName) {
        throw new Error('A room name is required.');
      }
      roomCode = await generateRoomCode(client);
    }
  } else if (!leagueName) {
    leagueName = 'Global PaperTrade Arena';
  }

  await upsertUser(client, userId, username, realName);

  const portfolioId = randomUUID();

  await client.query(
    `INSERT INTO portfolios (id, clerk_user_id, cash, league_name, league_type, league_room_code)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [portfolioId, userId, STARTING_CASH, leagueName, league.type, roomCode]
  );
  await client.query(
    `INSERT INTO portfolio_snapshots (id, portfolio_id, label, total_value, recorded_at_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), portfolioId, 'Start', STARTING_CASH, Date.now()]
  );

  return mapProfile(client, userId);
};

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

const getPortfolioState = async (client: PoolClient, userId: string, forUpdate = false) => {
  const portfolioResult = await client.query(
    `SELECT id, cash, league_name, league_type, league_room_code
     FROM portfolios
     WHERE clerk_user_id = $1
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId]
  );

  if (portfolioResult.rowCount === 0) {
    return null;
  }

  const portfolio = portfolioResult.rows[0];
  const holdingsResult = await client.query(
    `SELECT symbol, shares, average_cost
     FROM holdings
     WHERE portfolio_id = $1`,
    [portfolio.id]
  );

  return {
    id: portfolio.id as string,
    cash: numeric(portfolio.cash),
    league: {
      name: portfolio.league_name as string,
      type: portfolio.league_type as 'public' | 'private',
      roomCode: (portfolio.league_room_code as string | null) ?? undefined,
    },
    holdings: holdingsResult.rows.map((row) => ({
      symbol: row.symbol as string,
      shares: Number(row.shares),
      averageCost: numeric(row.average_cost),
    })),
  };
};

const executeMarketTrade = async (
  client: PoolClient,
  yahooFinance: YahooFinanceClient,
  userId: string,
  trade: TradeRequest
) => {
  if (!Number.isInteger(trade.shares) || trade.shares <= 0) {
    throw new Error('Shares must be a positive integer.');
  }
  if (trade.type !== 'BUY' && trade.type !== 'SELL') {
    throw new Error('Trade type must be BUY or SELL.');
  }

  // Network I/O happens BEFORE the transaction so we never hold row locks
  // (or a pool connection) across a Yahoo round-trip.
  const quote = await getCurrentQuote(yahooFinance, trade.symbol);

  // Honour limit semantics server-side: a triggered limit order must not
  // execute through its limit price just because the live quote moved.
  if (typeof trade.limitPrice === 'number' && violatesLimit(trade.type, trade.limitPrice, quote.price)) {
    throw new Error(
      trade.type === 'BUY'
        ? `Market price $${quote.price.toFixed(2)} is above your $${trade.limitPrice.toFixed(2)} limit.`
        : `Market price $${quote.price.toFixed(2)} is below your $${trade.limitPrice.toFixed(2)} limit.`
    );
  }

  const totalCost = quote.price * trade.shares;
  let portfolioId: string;
  let cashAfter: number;

  await client.query('BEGIN');

  try {
    // Row lock serialises concurrent trades for the same user — previously two
    // simultaneous trades both read the same starting cash and the second
    // commit silently overwrote the first (double-spend).
    const state = await getPortfolioState(client, userId, true);

    if (!state) {
      throw new Error('Portfolio not found.');
    }

    portfolioId = state.id;
    const existingHolding = state.holdings.find((holding) => holding.symbol === quote.symbol);

    if (trade.type === 'BUY' && state.cash < totalCost) {
      throw new Error('Insufficient virtual cash.');
    }
    if (trade.type === 'SELL' && (!existingHolding || existingHolding.shares < trade.shares)) {
      throw new Error('Insufficient shares to sell.');
    }

    // Relative update + guard as a second line of defence under the lock.
    const cashResult = trade.type === 'BUY'
      ? await client.query(
          `UPDATE portfolios SET cash = cash - $1, updated_at = NOW()
           WHERE id = $2 AND cash >= $1
           RETURNING cash`,
          [totalCost, state.id]
        )
      : await client.query(
          `UPDATE portfolios SET cash = cash + $1, updated_at = NOW()
           WHERE id = $2
           RETURNING cash`,
          [totalCost, state.id]
        );

    if (cashResult.rowCount === 0) {
      throw new Error('Insufficient virtual cash.');
    }
    cashAfter = numeric(cashResult.rows[0].cash);

    if (trade.type === 'BUY') {
      if (existingHolding) {
        const totalShares = existingHolding.shares + trade.shares;
        const newAverage = weightedAverageCost(
          existingHolding.shares,
          existingHolding.averageCost,
          trade.shares,
          quote.price
        );
        await client.query(
          `UPDATE holdings SET shares = $1, average_cost = $2
           WHERE portfolio_id = $3 AND symbol = $4`,
          [totalShares, newAverage, state.id, quote.symbol]
        );
      } else {
        await client.query(
          `INSERT INTO holdings (portfolio_id, symbol, shares, average_cost)
           VALUES ($1, $2, $3, $4)`,
          [state.id, quote.symbol, trade.shares, quote.price]
        );
      }
    } else if (existingHolding) {
      const remainingShares = existingHolding.shares - trade.shares;
      if (remainingShares === 0) {
        await client.query(
          'DELETE FROM holdings WHERE portfolio_id = $1 AND symbol = $2',
          [state.id, quote.symbol]
        );
      } else {
        await client.query(
          `UPDATE holdings SET shares = $1
           WHERE portfolio_id = $2 AND symbol = $3`,
          [remainingShares, state.id, quote.symbol]
        );
      }
    }

    await client.query(
      `INSERT INTO trades (id, portfolio_id, symbol, type, shares, price_at_trade, created_at_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), state.id, quote.symbol, trade.type, trade.shares, quote.price, Date.now()]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  // Snapshot AFTER commit: valuation needs quotes (network), and a snapshot
  // failure should never roll back a successfully executed trade.
  try {
    quoteCache.set(quote.symbol, { quote, fetchedAt: Date.now() });
    const holdingsAfter = await client.query(
      'SELECT symbol, shares, average_cost FROM holdings WHERE portfolio_id = $1',
      [portfolioId]
    );
    const priced = await Promise.all(
      holdingsAfter.rows.map(async (row) => {
        const price = await getCachedQuote(yahooFinance, row.symbol)
          .then((q) => q.price)
          .catch(() => numeric(row.average_cost)); // fall back to cost basis, not $0
        return price * Number(row.shares);
      })
    );
    const totalValue = priced.reduce((sum, v) => sum + v, cashAfter);

    await client.query(
      `INSERT INTO portfolio_snapshots (id, portfolio_id, label, total_value, recorded_at_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), portfolioId, trade.type === 'BUY' ? 'Buy' : 'Sell', totalValue, Date.now()]
    );
  } catch (error) {
    console.warn('Post-trade snapshot failed (trade itself committed):', error);
  }

  return mapProfile(client, userId);
};

// ---------------------------------------------------------------------------
// Pending orders (server-persisted so they survive refresh)
// ---------------------------------------------------------------------------

const mapOrderRow = (row: Record<string, unknown>) => ({
  id: row.id as string,
  symbol: row.symbol as string,
  side: row.side as 'BUY' | 'SELL',
  orderType: row.order_type as 'LIMIT' | 'STOP_LOSS' | 'STOP_LIMIT',
  shares: Number(row.shares),
  limitPrice: row.limit_price === null ? undefined : numeric(row.limit_price),
  stopPrice: row.stop_price === null ? undefined : numeric(row.stop_price),
  placedAt: Number(row.placed_at_ms),
  stopTriggered: Boolean(row.stop_triggered),
  lastError: (row.last_error as string | null) ?? undefined,
});

const requirePortfolioId = async (client: PoolClient, userId: string): Promise<string> => {
  const result = await client.query(
    'SELECT id FROM portfolios WHERE clerk_user_id = $1',
    [userId]
  );
  if (result.rowCount === 0) {
    throw new Error('Portfolio not found.');
  }
  return result.rows[0].id as string;
};

const listPendingOrders = async (client: PoolClient, userId: string) => {
  const portfolioId = await requirePortfolioId(client, userId);
  const result = await client.query(
    'SELECT * FROM pending_orders WHERE portfolio_id = $1 ORDER BY placed_at_ms ASC',
    [portfolioId]
  );
  return result.rows.map(mapOrderRow);
};

const createPendingOrder = async (client: PoolClient, userId: string, order: OrderRequest) => {
  const portfolioId = await requirePortfolioId(client, userId);

  if (!order.symbol?.trim()) throw new Error('A symbol is required.');
  if (!Number.isInteger(order.shares) || order.shares <= 0) {
    throw new Error('Shares must be a positive integer.');
  }
  if (order.side !== 'BUY' && order.side !== 'SELL') {
    throw new Error('Order side must be BUY or SELL.');
  }
  if (!['LIMIT', 'STOP_LOSS', 'STOP_LIMIT'].includes(order.orderType)) {
    throw new Error('Unsupported order type.');
  }

  const needsLimit = order.orderType === 'LIMIT' || order.orderType === 'STOP_LIMIT';
  const needsStop = order.orderType === 'STOP_LOSS' || order.orderType === 'STOP_LIMIT';

  if (needsLimit && (typeof order.limitPrice !== 'number' || order.limitPrice <= 0)) {
    throw new Error('A valid limit price is required.');
  }
  if (needsStop && (typeof order.stopPrice !== 'number' || order.stopPrice <= 0)) {
    throw new Error('A valid stop price is required.');
  }

  const symbol = order.symbol.trim().toUpperCase();

  // A sell order for more shares than held would only fail later, silently —
  // reject it at placement instead. (Buy-side cash is checked at execution,
  // like a real broker without buying-power reservation. Trade-off: a fill can
  // still fail if cash was spent in the meantime; the order then surfaces the
  // error instead of vanishing.)
  if (order.side === 'SELL') {
    const held = await client.query(
      'SELECT shares FROM holdings WHERE portfolio_id = $1 AND symbol = $2',
      [portfolioId, symbol]
    );
    const heldShares = held.rowCount ? Number(held.rows[0].shares) : 0;
    if (heldShares < order.shares) {
      throw new Error(`You only hold ${heldShares} share${heldShares === 1 ? '' : 's'} of ${symbol}.`);
    }
  }

  const id = randomUUID();
  await client.query(
    `INSERT INTO pending_orders
       (id, portfolio_id, symbol, side, order_type, shares, limit_price, stop_price, placed_at_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      portfolioId,
      symbol,
      order.side,
      order.orderType,
      order.shares,
      needsLimit ? order.limitPrice : null,
      needsStop ? order.stopPrice : null,
      Date.now(),
    ]
  );

  const created = await client.query('SELECT * FROM pending_orders WHERE id = $1', [id]);
  return mapOrderRow(created.rows[0]);
};

const updatePendingOrder = async (
  client: PoolClient,
  userId: string,
  patch: { id: string; stopTriggered?: boolean; lastError?: string | null }
) => {
  const portfolioId = await requirePortfolioId(client, userId);
  const result = await client.query(
    `UPDATE pending_orders
     SET stop_triggered = COALESCE($3, stop_triggered),
         last_error = $4
     WHERE id = $1 AND portfolio_id = $2
     RETURNING *`,
    [patch.id, portfolioId, patch.stopTriggered ?? null, patch.lastError ?? null]
  );
  if (result.rowCount === 0) {
    throw new Error('Order not found.');
  }
  return mapOrderRow(result.rows[0]);
};

const deletePendingOrder = async (client: PoolClient, userId: string, orderId: string) => {
  const portfolioId = await requirePortfolioId(client, userId);
  await client.query(
    'DELETE FROM pending_orders WHERE id = $1 AND portfolio_id = $2',
    [orderId, portfolioId]
  );
};

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

const getLeaderboard = async (client: PoolClient, yahooFinance: YahooFinanceClient, userId: string) => {
  const portfolioState = await getPortfolioState(client, userId);

  if (!portfolioState) {
    return [];
  }

  // Private leagues match on room code (names collide across rooms);
  // public leagues keep the original name+type grouping.
  const portfolioRows = portfolioState.league.type === 'private' && portfolioState.league.roomCode
    ? await client.query(
        `SELECT p.id, u.username, p.cash
         FROM portfolios p
         JOIN app_users u ON u.clerk_user_id = p.clerk_user_id
         WHERE p.league_room_code = $1`,
        [portfolioState.league.roomCode]
      )
    : await client.query(
        `SELECT p.id, u.username, p.cash
         FROM portfolios p
         JOIN app_users u ON u.clerk_user_id = p.clerk_user_id
         WHERE p.league_name = $1 AND p.league_type = $2`,
        [portfolioState.league.name, portfolioState.league.type]
      );

  const portfolioIds = portfolioRows.rows.map((row) => row.id);
  if (portfolioIds.length === 0) {
    return [];
  }

  const holdingsRows = await client.query(
    `SELECT portfolio_id, symbol, shares, average_cost
     FROM holdings
     WHERE portfolio_id = ANY($1::text[])`,
    [portfolioIds]
  );

  // One parallel, cached fetch per distinct symbol (was: serial fetch per
  // symbol on every request — the main reason trades felt slow).
  const symbols: string[] = Array.from(new Set(holdingsRows.rows.map((row) => String(row.symbol))));
  const quotes = new Map<string, number>();
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await getCachedQuote(yahooFinance, symbol);
        quotes.set(symbol, quote.price);
      } catch {
        // leave unset — holder falls back to cost basis below instead of $0
      }
    })
  );

  const valueByPortfolio = new Map<string, number>();

  for (const row of portfolioRows.rows) {
    valueByPortfolio.set(row.id, numeric(row.cash));
  }

  for (const row of holdingsRows.rows) {
    const current = valueByPortfolio.get(row.portfolio_id) ?? 0;
    const quotePrice = quotes.get(row.symbol) ?? numeric(row.average_cost);
    valueByPortfolio.set(row.portfolio_id, current + (quotePrice * Number(row.shares)));
  }

  return portfolioRows.rows
    .map((row) => ({
      id: row.id as string,
      username: row.username as string,
      totalValue: valueByPortfolio.get(row.id) ?? numeric(row.cash),
      rank: 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
};

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

/**
 * Identity now arrives as a verified Clerk userId supplied by the API route
 * (via getAuth) — the old X-User-Id headers let anyone trade on any account
 * with a curl one-liner.
 */
export const createPaperTradingHandlers = (options: {
  databaseUrl?: string;
  yahooFinance: YahooFinanceClient;
}) => {
  const pool = createDatabasePool(options.databaseUrl);

  const withClient = async (
    res: ServerResponse,
    errorStatus: number,
    run: (client: PoolClient) => Promise<void>
  ) => {
    if (!pool) {
      json(res, 500, { error: 'DATABASE_URL is not configured.' });
      return;
    }

    try {
      await ensureSchema(pool);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database schema setup failed.';
      json(res, 500, { error: message });
      return;
    }

    const client = await pool.connect();
    try {
      await run(client);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown server error.';
      json(res, errorStatus, { error: message });
    } finally {
      client.release();
    }
  };

  const handleProfileGet = async (req: IncomingMessage, res: ServerResponse, userId: string) => {
    await withClient(res, 500, async (client) => {
      // NOTE: no upsert here — a GET must never overwrite the username the
      // user chose at onboarding with a Clerk-derived default.
      const profile = await mapProfile(client, userId);
      const leaderboard = profile
        ? await getLeaderboard(client, options.yahooFinance, userId)
        : [];
      json(res, 200, { profile, leaderboard });
    });
  };

  const handleProfilePost = async (
    req: BodyRequest<{ username: string; realName: string; league: League }>,
    res: ServerResponse,
    userId: string
  ) => {
    const body = await readJsonBody(req);

    if (!body?.league?.name || !body?.league?.type) {
      json(res, 400, { error: 'League details are required.' });
      return;
    }

    await withClient(res, 400, async (client) => {
      const profile = await createProfile(client, userId, body.username, body.realName, body.league);
      const leaderboard = profile
        ? await getLeaderboard(client, options.yahooFinance, userId)
        : [];
      json(res, 200, { profile, leaderboard });
    });
  };

  const handleTradePost = async (
    req: BodyRequest<TradeRequest>,
    res: ServerResponse,
    userId: string
  ) => {
    const body = await readJsonBody(req);

    if (!body?.symbol || !body?.shares || !body?.type) {
      json(res, 400, { error: 'Trade payload is required.' });
      return;
    }

    await withClient(res, 400, async (client) => {
      const profile = await executeMarketTrade(client, options.yahooFinance, userId, body);
      const leaderboard = profile
        ? await getLeaderboard(client, options.yahooFinance, userId)
        : [];
      json(res, 200, { profile, leaderboard });
    });
  };

  const handleOrdersGet = async (req: IncomingMessage, res: ServerResponse, userId: string) => {
    await withClient(res, 500, async (client) => {
      const orders = await listPendingOrders(client, userId);
      json(res, 200, { orders });
    });
  };

  const handleOrdersPost = async (
    req: BodyRequest<OrderRequest>,
    res: ServerResponse,
    userId: string
  ) => {
    const body = await readJsonBody(req);
    if (!body) {
      json(res, 400, { error: 'Order payload is required.' });
      return;
    }

    await withClient(res, 400, async (client) => {
      const order = await createPendingOrder(client, userId, body);
      json(res, 200, { order });
    });
  };

  const handleOrdersPatch = async (
    req: BodyRequest<{ id: string; stopTriggered?: boolean; lastError?: string | null }>,
    res: ServerResponse,
    userId: string
  ) => {
    const body = await readJsonBody(req);
    if (!body?.id) {
      json(res, 400, { error: 'Order id is required.' });
      return;
    }

    await withClient(res, 400, async (client) => {
      const order = await updatePendingOrder(client, userId, body);
      json(res, 200, { order });
    });
  };

  const handleOrdersDelete = async (req: IncomingMessage, res: ServerResponse, userId: string) => {
    const orderId = new URL(req.url ?? '/', 'http://localhost').searchParams.get('id');
    if (!orderId) {
      json(res, 400, { error: 'Order id is required.' });
      return;
    }

    await withClient(res, 400, async (client) => {
      await deletePendingOrder(client, userId, orderId);
      json(res, 200, { ok: true });
    });
  };

  return {
    handleProfileGet,
    handleProfilePost,
    handleTradePost,
    handleOrdersGet,
    handleOrdersPost,
    handleOrdersPatch,
    handleOrdersDelete,
  };
};
