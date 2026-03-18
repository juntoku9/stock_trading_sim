import type { NextApiRequest, NextApiResponse } from 'next';
import { handleTradingProfileGet, handleTradingProfilePost } from '@/lib/server/paperTradingApi';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await handleTradingProfileGet(req, res);
      return;
    }

    if (req.method === 'POST') {
      await handleTradingProfilePost(req, res);
      return;
    }

    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    res.status(500).json({ error: message });
  }
}
