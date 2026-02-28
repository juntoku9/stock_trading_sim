import type { IncomingMessage, ServerResponse } from 'http';
import { handleQuoteApiRequest } from '../server/paperTradingApi';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleQuoteApiRequest(req, res);
}
