import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
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
      input:
        'Give me the 5 most important global stock market news headlines from today or the last 24 hours. For each, provide the headline title and source URL.',
    });

    // Extract URL citations from the response annotations
    const news: { title: string; url: string }[] = [];
    for (const item of response.output) {
      if (item.type === 'message') {
        for (const block of item.content) {
          if (block.type === 'output_text' && block.annotations) {
            for (const ann of block.annotations) {
              if (ann.type === 'url_citation' && news.length < 5) {
                news.push({ title: ann.title || 'Market Update', url: ann.url });
              }
            }
          }
        }
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=300'); // cache 5 min
    res.status(200).json({ news });
  } catch (error) {
    console.error('market-news error:', error);
    res.status(200).json({ news: [] }); // fail silently — non-critical feature
  }
}
