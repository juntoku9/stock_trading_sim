import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const symbol =
    typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';
  const name =
    typeof req.query.name === 'string' ? req.query.name.trim() : symbol;

  if (!symbol) {
    res.status(400).json({ error: 'Missing symbol.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ news: [] });
    return;
  }

  try {
    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: `Find the 3 most recent and relevant news headlines for ${name} (${symbol}) stock from today or the last 48 hours. For each, provide the headline title and URL.`,
    });

    const news: { title: string; url: string; summary: string; source: string }[] = [];
    for (const item of response.output) {
      if (item.type === 'message') {
        for (const block of item.content) {
          if (block.type === 'output_text' && block.annotations) {
            for (const ann of block.annotations) {
              if (ann.type === 'url_citation' && news.length < 3) {
                const rawTitle = ann.title || `Update on ${symbol}`;
                // Try to split "Title - Source" into parts
                const parts = rawTitle.split(' - ');
                const title = parts[0] ?? rawTitle;
                const source = parts[1] ?? 'Financial News';
                news.push({
                  title,
                  url: ann.url,
                  summary: 'Check source for the latest details on market impact and company performance.',
                  source,
                });
              }
            }
          }
        }
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({ news });
  } catch (error) {
    console.error('stock-news error:', error);
    res.status(200).json({ news: [] });
  }
}
