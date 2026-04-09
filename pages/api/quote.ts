import type { NextApiRequest, NextApiResponse } from 'next';
import YahooFinance from 'yahoo-finance2';
import { getCurrentQuote } from '../../server/paperTradingApi';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const rawSymbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';

  if (!rawSymbol) {
    res.status(400).json({ error: 'Missing symbol query parameter.' });
    return;
  }

  try {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const quote = await getCurrentQuote(yahooFinance, rawSymbol);
    res.status(200).json(quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Yahoo Finance error.';
    res.status(502).json({ error: message });
  }
}
