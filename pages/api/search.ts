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

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (!query) {
    res.status(400).json({ error: 'Missing query parameter.' });
    return;
  }

  try {
    const result = await yahooFinance.search(query, {}, { validateResult: false }) as any;
    const quotes = ((result.quotes ?? []) as any[])
      .filter((q: any) => q.quoteType === 'EQUITY' && q.symbol && q.shortname)
      .slice(0, 10)
      .map((q: any) => ({
        symbol: (q.symbol as string).replace(/-/g, '.'),
        name: q.shortname as string,
        sector: (q.sector as string) ?? 'Unknown',
      }));
    res.status(200).json({ quotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    res.status(502).json({ error: message });
  }
}
