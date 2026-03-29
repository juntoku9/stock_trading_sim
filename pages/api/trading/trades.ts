import type { NextApiRequest, NextApiResponse } from 'next';
import YahooFinance from 'yahoo-finance2';
import { createPaperTradingHandlers } from '../../../server/paperTradingApi';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

const handlers = createPaperTradingHandlers({
  databaseUrl: process.env.DATABASE_URL,
  yahooFinance,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    await handlers.handleTradePost(req, res);
    return;
  }

  res.setHeader('Allow', 'POST');
  res.status(405).json({ error: 'Method not allowed.' });
}
