import type { NextApiRequest, NextApiResponse } from 'next';
import { handleQuoteApiRequest } from '../../lib/server/paperTradingApi';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await handleQuoteApiRequest(req, res);
}
