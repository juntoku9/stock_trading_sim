import type { IncomingMessage, ServerResponse } from 'http';
import { handleTradingTradePost } from '../_lib/paperTradingApi';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'POST') {
    await handleTradingTradePost(req, res);
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Method not allowed.' }));
}
