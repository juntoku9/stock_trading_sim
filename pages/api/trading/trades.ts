import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { handleTradingTradePost } = await import('../../../lib/server/paperTradingApi');

    if (req.method === 'POST') {
      await handleTradingTradePost(req, res);
      return;
    }

    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    res.status(500).json({ error: message });
  }
}
