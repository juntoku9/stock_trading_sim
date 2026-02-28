import path from 'path';
import { defineConfig, loadEnv, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const json = (res: Connect.ServerResponse, statusCode: number, body: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const handleQuoteRequest = async (req: Connect.IncomingMessage, res: Connect.ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const rawSymbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const yahooSymbol = rawSymbol?.replace(/\./g, '-');

  if (!rawSymbol || !yahooSymbol) {
    json(res, 400, { error: 'Missing symbol query parameter.' });
    return;
  }

  try {
    const quote = await yahooFinance.quote(yahooSymbol);
    const price = quote.regularMarketPrice;
    const change = quote.regularMarketChange;
    const changePercent = quote.regularMarketChangePercent;

    if (
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      typeof change !== 'number' ||
      !Number.isFinite(change) ||
      typeof changePercent !== 'number' ||
      !Number.isFinite(changePercent)
    ) {
      json(res, 502, { error: `Yahoo Finance returned incomplete data for ${rawSymbol}.` });
      return;
    }

    json(res, 200, {
      symbol: rawSymbol,
      price,
      change,
      changePercent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Yahoo Finance error.';
    json(res, 502, { error: message });
  }
};

const yahooFinanceProxy = () => ({
  name: 'yahoo-finance-proxy',
  configureServer(server: { middlewares: Connect.Server }) {
    server.middlewares.use('/api/quote', (req, res) => {
      void handleQuoteRequest(req, res);
    });
  },
  configurePreviewServer(server: { middlewares: Connect.Server }) {
    server.middlewares.use('/api/quote', (req, res) => {
      void handleQuoteRequest(req, res);
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), yahooFinanceProxy()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
