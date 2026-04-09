import type { NextApiRequest, NextApiResponse } from 'next';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const symbol =
    typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';
  const period =
    typeof req.query.period === 'string' ? req.query.period : '1M';

  if (!symbol) {
    res.status(400).json({ error: 'Missing symbol query parameter.' });
    return;
  }

  // '1D' uses the live tick data already on the client — nothing to fetch
  if (period === '1D') {
    res.status(200).json({ points: [] });
    return;
  }

  try {
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    const now = new Date();
    let startDate: Date;
    let interval: '1d' | '1wk' | '1mo' = '1d';

    switch (period) {
      case '1W':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = '1d';
        break;
      case '3M':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        interval = '1d';
        break;
      case '1Y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        interval = '1wk';
        break;
      case '1M':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        interval = '1d';
        break;
    }

    const result = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: now,
      interval,
    });

    const points = result
      .map((item: { date: Date | string; close?: number; adjClose?: number }) => ({
        time: new Date(item.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        price: item.close ?? item.adjClose ?? 0,
      }))
      .filter((p: { time: string; price: number }) => p.price > 0);

    res.status(200).json({ points });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    res.status(502).json({ error: message });
  }
}
