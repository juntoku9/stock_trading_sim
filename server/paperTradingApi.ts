import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { Pool, type PoolClient } from 'pg';
import YahooFinance from 'yahoo-finance2';

const STARTING_CASH = 100000;

type QuoteResult = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
};

type ApiContext = {
  userId: string;
  username: string;
  realName: string;
};

type League = {
  name: string;
  type: 'public' | 'private';
  roomMode?: 'create' | 'join';
  roomCode?: string;
};

const makeRoomCode = () => randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
const normalizeRoomCode = (value?: string) => value?.trim().toUpperCase();

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

const getApiContext = (req: IncomingMessage): ApiContext | null => {
  const userId = req.headers['x-user-id'];
  const username = req.headers['x-user-name'];
  const realName = req.headers['x-user-display-name'];

  if (
    typeof userId !== 'string' ||
    typeof username !== 'string' ||
    typeof realName !== 'string' ||
    !userId ||
    !username ||
    !realName
  ) {
    return null;
  }

  return { userId, username, realName };
};

const createDatabasePool = (databaseUrl?: string): PoolLike => {
  if (!databaseUrl) {
    return null;
  }

  return new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });
};

const mapProfile = async (client: PoolClient, userId: string) => {
  const portfolioResult = await client.query(
    `SELECT id, cash, league_name, league_type, room_code, saved_private_room_code, saved_private_room_name, private_rooms
     FROM portfolios
     WHERE clerk_user_id = $1`,
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
     ORDER BY created_at_ms DESC`,
    [portfolio.id]
  );
  const snapshotsResult = await client.query(
    `SELECT label, total_value, recorded_at_ms
     FROM portfolio_snapshots
     WHERE portfolio_id = $1
     ORDER BY recorded_at_ms ASC`,
    [portfolio.id]
  );

  return {
    id: portfolio.id,
    username: '',
    realName: '',
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
    performanceHistory: snapshotsResult.rows.map((row) => ({
      time: row.label,
      price: numeric(row.total_value),
    })),
    achievements: [],
    league: {
      id: portfolio.id,
      name: portfolio.league_name,
      type: portfolio.league_type as 'public' | 'private',
      roomCode: portfolio.room_code || undefined,
      savedRoomCode: portfolio.saved_private_room_code || undefined,
      savedRoomName: portfolio.saved_private_room_name || undefined,
      rooms: Array.isArray(portfolio.private_rooms) ? portfolio.private_rooms : [],
    },
  };
};

const upsertUser = async (client: PoolClient, context: ApiContext) => {
  await client.query(
    `INSERT INTO app_users (clerk_user_id, username, real_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (clerk_user_id)
     DO UPDATE SET username = EXCLUDED.username, real_name = EXCLUDED.real_name`,
    [context.userId, context.username, context.realName]
  );
};

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
            room_code TEXT,
            saved_private_room_code TEXT,
            saved_private_room_name TEXT,
            private_rooms JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await pool.query(`ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS room_code TEXT;`);
        await pool.query(`ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS saved_private_room_code TEXT;`);
        await pool.query(`ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS saved_private_room_name TEXT;`);
        await pool.query(`ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS private_rooms JSONB NOT NULL DEFAULT '[]'::jsonb;`);
        await pool.query(`
          UPDATE portfolios
          SET private_rooms = jsonb_build_array(jsonb_build_object('name', saved_private_room_name, 'code', saved_private_room_code))
          WHERE saved_private_room_code IS NOT NULL AND private_rooms = '[]'::jsonb;
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS portfolios_room_code_idx ON portfolios(room_code);`);
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
      })();
    }

    await promise;
  };
})();

export const getCurrentQuote = async (yahooFinance: YahooFinanceClient, symbol: string): Promise<QuoteResult> => {
  const yahooSymbol = symbol.toUpperCase().replace(/\./g, '-');
  const quote = await yahooFinance.quote(yahooSymbol);

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
  };
};

const createProfile = async (client: PoolClient, context: ApiContext, league: League) => {
  await upsertUser(client, context);

  const existing = await mapProfile(client, context.userId);
  if (existing) {
    return existing;
  }

  const portfolioId = randomUUID();
  let leagueName = league.name;
  let roomCode: string | null = null;

  if (league.type === 'private') {
    if (league.roomMode === 'join') {
      roomCode = normalizeRoomCode(league.roomCode) || null;
      if (!roomCode) throw new Error('Enter a room code.');
      const room = await client.query(
        `SELECT league_name FROM portfolios WHERE league_type = 'private' AND room_code = $1 LIMIT 1`,
        [roomCode]
      );
      if (room.rowCount === 0) throw new Error('Room code not found.');
      leagueName = room.rows[0].league_name;
    } else {
      roomCode = makeRoomCode();
    }
  }

  await client.query(
    `INSERT INTO portfolios (id, clerk_user_id, cash, league_name, league_type, room_code, saved_private_room_code, saved_private_room_name, private_rooms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [portfolioId, context.userId, STARTING_CASH, leagueName, league.type, roomCode,
      league.type === 'private' ? roomCode : null, league.type === 'private' ? leagueName : null,
      JSON.stringify(league.type === 'private' ? [{ name: leagueName, code: roomCode }] : [])]
  );
  await client.query(
    `INSERT INTO portfolio_snapshots (id, portfolio_id, label, total_value, recorded_at_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), portfolioId, 'Start', STARTING_CASH, Date.now()]
  );

  return mapProfile(client, context.userId);
};

const changeLeague = async (client: PoolClient, userId: string, league: League) => {
  let leagueName = league.type === 'public' ? 'Global PaperTrade Arena' : league.name.trim();
  let roomCode: string | null = null;

  if (league.type === 'private') {
    if (league.roomMode === 'join') {
      roomCode = normalizeRoomCode(league.roomCode) || null;
      if (!roomCode) throw new Error('Enter a room code.');
      const room = await client.query(
        `SELECT league_name FROM portfolios WHERE league_type = 'private' AND room_code = $1 LIMIT 1`,
        [roomCode]
      );
      if (room.rowCount === 0) throw new Error('Room code not found.');
      leagueName = room.rows[0].league_name;
    } else {
      if (!leagueName) throw new Error('Enter a room name.');
      roomCode = makeRoomCode();
    }
  }

  if (league.type === 'private') {
    await client.query(
      `UPDATE portfolios SET league_name = $1, league_type = $2, room_code = $3,
       saved_private_room_code = $3, saved_private_room_name = $1,
       private_rooms = CASE
         WHEN private_rooms @> jsonb_build_array(jsonb_build_object('name', $1::text, 'code', $3::text)) THEN private_rooms
         ELSE private_rooms || jsonb_build_array(jsonb_build_object('name', $1::text, 'code', $3::text))
       END,
       updated_at = NOW()
       WHERE clerk_user_id = $4`,
      [leagueName, league.type, roomCode, userId]
    );
  } else {
    await client.query(
      `UPDATE portfolios SET league_name = $1, league_type = $2, room_code = NULL, updated_at = NOW()
       WHERE clerk_user_id = $3`,
      [leagueName, league.type, userId]
    );
  }
  return mapProfile(client, userId);
};

const getPortfolioState = async (client: PoolClient, userId: string) => {
  const portfolioResult = await client.query(
    `SELECT id, cash, league_name, league_type, room_code, saved_private_room_code, saved_private_room_name, private_rooms
     FROM portfolios
     WHERE clerk_user_id = $1`,
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
    id: portfolio.id,
    cash: numeric(portfolio.cash),
    league: {
      name: portfolio.league_name,
      type: portfolio.league_type as 'public' | 'private',
      roomCode: portfolio.room_code || undefined,
      savedRoomCode: portfolio.saved_private_room_code || undefined,
      savedRoomName: portfolio.saved_private_room_name || undefined,
      rooms: Array.isArray(portfolio.private_rooms) ? portfolio.private_rooms : [],
    },
    holdings: holdingsResult.rows.map((row) => ({
      symbol: row.symbol,
      shares: Number(row.shares),
      averageCost: numeric(row.average_cost),
    })),
  };
};

const executeMarketTrade = async (
  client: PoolClient,
  yahooFinance: YahooFinanceClient,
  userId: string,
  trade: { symbol: string; shares: number; type: 'BUY' | 'SELL' }
) => {
  const state = await getPortfolioState(client, userId);

  if (!state) {
    throw new Error('Portfolio not found.');
  }

  if (!Number.isInteger(trade.shares) || trade.shares <= 0) {
    throw new Error('Shares must be a positive integer.');
  }

  const quote = await getCurrentQuote(yahooFinance, trade.symbol);
  const totalCost = quote.price * trade.shares;
  const existingHolding = state.holdings.find((holding) => holding.symbol === quote.symbol);

  if (trade.type === 'BUY' && state.cash < totalCost) {
    throw new Error('Insufficient virtual cash.');
  }

  if (trade.type === 'SELL' && (!existingHolding || existingHolding.shares < trade.shares)) {
    throw new Error('Insufficient shares to sell.');
  }

  const nextCash = trade.type === 'BUY'
    ? state.cash - totalCost
    : state.cash + totalCost;

  await client.query('BEGIN');

  try {
    await client.query(
      `UPDATE portfolios
       SET cash = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextCash, state.id]
    );

    if (trade.type === 'BUY') {
      if (existingHolding) {
        const totalShares = existingHolding.shares + trade.shares;
        const weightedCost = (
          (existingHolding.shares * existingHolding.averageCost) +
          (trade.shares * quote.price)
        ) / totalShares;

        await client.query(
          `UPDATE holdings
           SET shares = $1, average_cost = $2
           WHERE portfolio_id = $3 AND symbol = $4`,
          [totalShares, weightedCost, state.id, quote.symbol]
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
          `DELETE FROM holdings
           WHERE portfolio_id = $1 AND symbol = $2`,
          [state.id, quote.symbol]
        );
      } else {
        await client.query(
          `UPDATE holdings
           SET shares = $1
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

    const latestHoldings = trade.type === 'BUY'
      ? state.holdings.map((holding) => holding.symbol === quote.symbol
        ? {
            ...holding,
            shares: holding.shares + trade.shares,
            averageCost: existingHolding
              ? (((holding.shares * holding.averageCost) + (trade.shares * quote.price)) / (holding.shares + trade.shares))
              : quote.price,
          }
        : holding
      )
      : state.holdings.map((holding) => holding.symbol === quote.symbol
        ? { ...holding, shares: holding.shares - trade.shares }
        : holding
      ).filter((holding) => holding.shares > 0);

    // Fetch live prices for all other holdings so the snapshot is accurate
    const livePrices = new Map<string, number>();
    livePrices.set(quote.symbol, quote.price);
    for (const holding of latestHoldings) {
      if (holding.symbol !== quote.symbol) {
        try {
          const otherQuote = await getCurrentQuote(yahooFinance, holding.symbol);
          livePrices.set(holding.symbol, otherQuote.price);
        } catch {
          livePrices.set(holding.symbol, holding.averageCost); // fallback to cost basis
        }
      }
    }

    const currentValue = latestHoldings.reduce(
      (sum, holding) => sum + (livePrices.get(holding.symbol) ?? holding.averageCost) * holding.shares,
      nextCash
    );

    await client.query(
      `INSERT INTO portfolio_snapshots (id, portfolio_id, label, total_value, recorded_at_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), state.id, trade.type === 'BUY' ? 'Buy' : 'Sell', currentValue, Date.now()]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return mapProfile(client, userId);
};

const getLeaderboard = async (client: PoolClient, yahooFinance: YahooFinanceClient, userId: string) => {
  const portfolioState = await getPortfolioState(client, userId);

  if (!portfolioState) {
    return [];
  }

  const portfolioRows = await client.query(
    `SELECT p.id, u.username, p.cash
     FROM portfolios p
     JOIN app_users u ON u.clerk_user_id = p.clerk_user_id
     WHERE p.league_type = $1
       AND (($1 = 'private' AND p.room_code = $2) OR ($1 = 'public'))`,
    [portfolioState.league.type, portfolioState.league.roomCode ?? null]
  );

  const portfolioIds = portfolioRows.rows.map((row) => row.id);
  if (portfolioIds.length === 0) {
    return [];
  }

  const holdingsRows = await client.query(
    `SELECT portfolio_id, symbol, shares
     FROM holdings
     WHERE portfolio_id = ANY($1::text[])`,
    [portfolioIds]
  );

  const symbols: string[] = Array.from(new Set(holdingsRows.rows.map((row) => String(row.symbol))));
  const quotes = new Map<string, number>();

  for (const symbol of symbols) {
    try {
      const quote = await getCurrentQuote(yahooFinance, symbol);
      quotes.set(symbol, quote.price);
    } catch {
      quotes.set(symbol, 0);
    }
  }

  const valueByPortfolio = new Map<string, number>();

  for (const row of portfolioRows.rows) {
    valueByPortfolio.set(row.id, numeric(row.cash));
  }

  for (const row of holdingsRows.rows) {
    const current = valueByPortfolio.get(row.portfolio_id) ?? 0;
    const quotePrice = quotes.get(row.symbol) ?? 0;
    valueByPortfolio.set(row.portfolio_id, current + (quotePrice * Number(row.shares)));
  }

  return portfolioRows.rows
    .map((row) => ({
      username: row.username,
      totalValue: valueByPortfolio.get(row.id) ?? numeric(row.cash),
      rank: 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
};

export const createPaperTradingHandlers = (options: {
  databaseUrl?: string;
  yahooFinance: YahooFinanceClient;
}) => {
  const pool = createDatabasePool(options.databaseUrl);

  const handleProfileGet = async (req: IncomingMessage, res: ServerResponse) => {
    if (!pool) {
      json(res, 500, { error: 'DATABASE_URL is not configured.' });
      return;
    }

    const context = getApiContext(req);
    if (!context) {
      json(res, 401, { error: 'Missing auth context.' });
      return;
    }

    await ensureSchema(pool);

    const client = await pool.connect();

    try {
      await upsertUser(client, context);
      const profile = await mapProfile(client, context.userId);
      const hydratedProfile = profile
        ? {
            ...profile,
            username: context.username,
            realName: context.realName,
          }
        : null;
      const leaderboard = profile
        ? await getLeaderboard(client, options.yahooFinance, context.userId)
        : [];

      json(res, 200, { profile: hydratedProfile, leaderboard });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown server error.';
      json(res, 500, { error: message });
    } finally {
      client.release();
    }
  };

  const handleProfilePost = async (
    req: BodyRequest<{ username: string; realName: string; league: League }>,
    res: ServerResponse
  ) => {
    if (!pool) {
      json(res, 500, { error: 'DATABASE_URL is not configured.' });
      return;
    }

    const context = getApiContext(req);
    if (!context) {
      json(res, 401, { error: 'Missing auth context.' });
      return;
    }

    const body = await readJsonBody(req);

    if (!body?.league?.name || !body?.league?.type) {
      json(res, 400, { error: 'League details are required.' });
      return;
    }

    await ensureSchema(pool);

    const client = await pool.connect();

    try {
      const profile = await createProfile(client, {
        userId: context.userId,
        username: body.username,
        realName: body.realName,
      }, body.league);

      const leaderboard = profile
        ? await getLeaderboard(client, options.yahooFinance, context.userId)
        : [];

      json(res, 200, {
        profile: profile
          ? {
              ...profile,
              username: body.username,
              realName: body.realName,
            }
          : null,
        leaderboard,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown server error.';
      json(res, 500, { error: message });
    } finally {
      client.release();
    }
  };

  const handleTradePost = async (
    req: BodyRequest<{ symbol: string; shares: number; type: 'BUY' | 'SELL' }>,
    res: ServerResponse
  ) => {
    if (!pool) {
      json(res, 500, { error: 'DATABASE_URL is not configured.' });
      return;
    }

    const context = getApiContext(req);
    if (!context) {
      json(res, 401, { error: 'Missing auth context.' });
      return;
    }

    const body = await readJsonBody(req);

    if (!body?.symbol || !body?.shares || !body?.type) {
      json(res, 400, { error: 'Trade payload is required.' });
      return;
    }

    await ensureSchema(pool);

    const client = await pool.connect();

    try {
      const profile = await executeMarketTrade(client, options.yahooFinance, context.userId, body);
      const leaderboard = profile
        ? await getLeaderboard(client, options.yahooFinance, context.userId)
        : [];

      json(res, 200, {
        profile: profile
          ? {
              ...profile,
              username: context.username,
              realName: context.realName,
            }
          : null,
        leaderboard,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown server error.';
      json(res, 400, { error: message });
    } finally {
      client.release();
    }
  };

  const handleLeaguePut = async (req: BodyRequest<{ league: League }>, res: ServerResponse) => {
    if (!pool) return json(res, 500, { error: 'DATABASE_URL is not configured.' });
    const context = getApiContext(req);
    if (!context) return json(res, 401, { error: 'Missing auth context.' });
    const body = await readJsonBody(req);
    if (!body?.league?.type) return json(res, 400, { error: 'League details are required.' });
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const profile = await changeLeague(client, context.userId, body.league);
      const leaderboard = await getLeaderboard(client, options.yahooFinance, context.userId);
      json(res, 200, { profile: profile ? { ...profile, username: context.username, realName: context.realName } : null, leaderboard });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Could not change room.' });
    } finally {
      client.release();
    }
  };

  return {
    handleProfileGet,
    handleProfilePost,
    handleLeaguePut,
    handleTradePost,
  };
};
