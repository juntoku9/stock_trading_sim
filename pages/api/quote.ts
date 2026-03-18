import type { NextApiRequest, NextApiResponse } from 'next';
import { handleQuoteApiRequest } from '@/lib/server/paperTradingApi';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await handleQuoteApiRequest(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    res.status(500).json({ error: message });
  }
}
