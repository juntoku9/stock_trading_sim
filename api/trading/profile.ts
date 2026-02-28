import type { IncomingMessage, ServerResponse } from 'http';
import { handleTradingProfileGet, handleTradingProfilePost } from '../_lib/paperTradingApi';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') {
    await handleTradingProfileGet(req, res);
    return;
  }

  if (req.method === 'POST') {
    await handleTradingProfilePost(req, res);
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Method not allowed.' }));
}
