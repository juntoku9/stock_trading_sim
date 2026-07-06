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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Identity comes from the verified Clerk session, never from client headers.
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.method === 'GET') {
    await handlers.handleProfileGet(req, res, userId);
    return;
  }

  if (req.method === 'POST') {
    await handlers.handleProfilePost(req, res, userId);
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed.' });
}
