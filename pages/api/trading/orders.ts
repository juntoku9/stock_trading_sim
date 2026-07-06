import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import YahooFinance from 'yahoo-finance2';
import { createPaperTradingHandlers } from '../../../server/paperTradingApi';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

const handlers = createPaperTradingHandlers({
  databaseUrl: process.env.DATABASE_URL,
  yahooFinance,
});

/**
 * Server-persisted conditional orders (limit / stop-loss / stop-limit).
 * They previously lived only in React state, so any page refresh silently
 * deleted every "protective" order the student had placed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  switch (req.method) {
    case 'GET':
      await handlers.handleOrdersGet(req, res, userId);
      return;
    case 'POST':
      await handlers.handleOrdersPost(req, res, userId);
      return;
    case 'PATCH':
      await handlers.handleOrdersPatch(req, res, userId);
      return;
    case 'DELETE':
      await handlers.handleOrdersDelete(req, res, userId);
      return;
    default:
      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      res.status(405).json({ error: 'Method not allowed.' });
  }
}
