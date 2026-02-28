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
};

type PoolLike = Pool | null;

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

const readJsonBody = async <T>(req: IncomingMessage): Promise<T | null> => {
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
    `SELECT id, cash, league_name, league_type
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
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
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
      })();
    }

    await promise;
  };
})();

let sharedPool: PoolLike | undefined;
let sharedYahoo: YahooFinance | undefined;

const getPool = () => {
  if (sharedPool === undefined) {
    sharedPool = createDatabasePool(process.env.DATABASE_URL);
  }

  return sharedPool;
};

const getYahoo = () => {
  if (!sharedYahoo) {
    sharedYahoo = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });
  }

  return sharedYahoo;
};

const getCurrentQuote = async (symbol: string): Promise<QuoteResult> => {
  const yahooSymbol = symbol.toUpperCase().replace(/\./g, '-');
  const quote = await getYahoo().quote(yahooSymbol);

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

  await client.query(
    `INSERT INTO portfolios (id, clerk_user_id, cash, league_name, league_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [portfolioId, context.userId, STARTING_CASH, league.name, league.type]
  );
  await client.query(
    `INSERT INTO portfolio_snapshots (id, portfolio_id, label, total_value, recorded_at_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), portfolioId, 'Start', STARTING_CASH, Date.now()]
  );

  return mapProfile(client, context.userId);
};

const getPortfolioState = async (client: PoolClient, userId: string) => {
  const portfolioResult = await client.query(
    `SELECT id, cash, league_name, league_type
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

  const quote = await getCurrentQuote(trade.symbol);
  const totalCost = quote.price * trade.shares;
  const existingHolding = state.holdings.find((holding) => holding.symbol === quote.symbol);

  if (trade.type === 'BUY' && state.cash < totalCost) {
    throw new Error('Insufficient virtual cash.');
  }

  if (trade.type === 'SELL' && (!existingHolding || existingHolding.shares < trade.shares)) {
    throw new Error('Insufficient shares to sell.');
  }

  const nextCash = trade.type === 'BUY' ? state.cash - totalCost : state.cash + totalCost;

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
        const weightedCost =
          ((existingHolding.shares * existingHolding.averageCost) + (trade.shares * quote.price)) / totalShares;

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

    const latestHoldings =
      trade.type === 'BUY'
        ? state.holdings.map((holding) =>
            holding.symbol === quote.symbol
              ? {
                  ...holding,
                  shares: holding.shares + trade.shares,
                  averageCost: existingHolding
                    ? ((holding.shares * holding.averageCost) + (trade.shares * quote.price)) /
                      (holding.shares + trade.shares)
                    : quote.price,
                }
              : holding
          )
        : state.holdings
            .map((holding) =>
              holding.symbol === quote.symbol ? { ...holding, shares: holding.shares - trade.shares } : holding
            )
            .filter((holding) => holding.shares > 0);

    const currentValue = latestHoldings.reduce(
      (sum, holding) => sum + (holding.symbol === quote.symbol ? quote.price : holding.averageCost) * holding.shares,
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

const getLeaderboard = async (client: PoolClient, userId: string) => {
  const portfolioState = await getPortfolioState(client, userId);

  if (!portfolioState) {
    return [];
  }

  const portfolioRows = await client.query(
    `SELECT p.id, u.username, p.cash
     FROM portfolios p
     JOIN app_users u ON u.clerk_user_id = p.clerk_user_id
     WHERE p.league_name = $1 AND p.league_type = $2`,
    [portfolioState.league.name, portfolioState.league.type]
  );

  const holdingsRows = await client.query(
    `SELECT portfolio_id, symbol, shares
     FROM holdings
     WHERE portfolio_id = ANY($1::text[])`,
    [portfolioRows.rows.map((row) => row.id)]
  );

  const symbols = Array.from(new Set(holdingsRows.rows.map((row) => row.symbol)));
  const quotes = new Map<string, number>();

  for (const symbol of symbols) {
    try {
      const quote = await getCurrentQuote(symbol);
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
    valueByPortfolio.set(row.portfolio_id, current + (quotes.get(row.symbol) ?? 0) * Number(row.shares));
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

export const handleTradingProfileGet = async (req: IncomingMessage, res: ServerResponse) => {
  const pool = getPool();

  if (!pool) {
    json(res, 500, { error: 'DATABASE_URL is not configured.' });
    return;
  }

  const context = getApiContext(req);
  if (!context) {
    json(res, 401, { error: 'Missing auth context.' });
    return;
  }

  let client: PoolClient | null = null;

  try {
    await ensureSchema(pool);
    client = await pool.connect();
    await upsertUser(client, context);
    const profile = await mapProfile(client, context.userId);
    const leaderboard = profile ? await getLeaderboard(client, context.userId) : [];

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
    json(res, 500, { error: message });
  } finally {
    client?.release();
  }
};

export const handleTradingProfilePost = async (req: IncomingMessage, res: ServerResponse) => {
  const pool = getPool();

  if (!pool) {
    json(res, 500, { error: 'DATABASE_URL is not configured.' });
    return;
  }

  const context = getApiContext(req);
  if (!context) {
    json(res, 401, { error: 'Missing auth context.' });
    return;
  }

  const body = await readJsonBody<{ username: string; realName: string; league: League }>(req);

  if (!body?.league?.name || !body?.league?.type) {
    json(res, 400, { error: 'League details are required.' });
    return;
  }

  let client: PoolClient | null = null;

  try {
    await ensureSchema(pool);
    client = await pool.connect();
    const profile = await createProfile(
      client,
      {
        userId: context.userId,
        username: body.username,
        realName: body.realName,
      },
      body.league
    );
    const leaderboard = profile ? await getLeaderboard(client, context.userId) : [];

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
    client?.release();
  }
};

export const handleTradingTradePost = async (req: IncomingMessage, res: ServerResponse) => {
  const pool = getPool();

  if (!pool) {
    json(res, 500, { error: 'DATABASE_URL is not configured.' });
    return;
  }

  const context = getApiContext(req);
  if (!context) {
    json(res, 401, { error: 'Missing auth context.' });
    return;
  }

  const body = await readJsonBody<{ symbol: string; shares: number; type: 'BUY' | 'SELL' }>(req);

  if (!body?.symbol || !body?.shares || !body?.type) {
    json(res, 400, { error: 'Trade payload is required.' });
    return;
  }

  let client: PoolClient | null = null;

  try {
    await ensureSchema(pool);
    client = await pool.connect();
    const profile = await executeMarketTrade(client, context.userId, body);
    const leaderboard = profile ? await getLeaderboard(client, context.userId) : [];

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
    client?.release();
  }
};

export const handleQuoteApiRequest = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const rawSymbol = url.searchParams.get('symbol')?.trim().toUpperCase();

  if (!rawSymbol) {
    json(res, 400, { error: 'Missing symbol query parameter.' });
    return;
  }

  try {
    const quote = await getCurrentQuote(rawSymbol);
    json(res, 200, quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Yahoo Finance error.';
    json(res, 502, { error: message });
  }
};
