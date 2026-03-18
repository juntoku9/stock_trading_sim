import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { handleQuoteApiRequest } = await import('../../lib/server/paperTradingApi');
    await handleQuoteApiRequest(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    res.status(500).json({ error: message });
  }
}
