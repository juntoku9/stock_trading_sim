
import { Stock, PricePoint } from '../types';
import { INITIAL_STOCKS } from '../constants';
import { fetchStockQuote } from './marketData';

/** Used only when Yahoo is unreachable at startup so the UI isn't empty. */
const FALLBACK_PRICES: Record<string, number> = {
  AAPL: 190,
  MSFT: 420,
  GOOGL: 180,
  AMZN: 210,
  TSLA: 330,
  NVDA: 140,
  META: 700,
  'BRK.B': 500,
  V: 350,
  JPM: 250,
  WMT: 105,
  DIS: 115,
};

/** Cap the intraday tick history kept per stock. */
const MAX_HISTORY_POINTS = 100;

const nowPoint = (price: number): PricePoint => ({
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  price,
  ts: Date.now(),
});

export const initializeStocks = async (): Promise<Stock[]> => {
  const stocks = await Promise.all(INITIAL_STOCKS.map(async (stockDef) => {
    const liveData = await fetchStockQuote(stockDef.symbol);
    const basePrice = liveData?.price ?? FALLBACK_PRICES[stockDef.symbol] ?? 100;

    return {
      ...stockDef,
      price: basePrice,
      change: liveData?.change ?? 0,
      changePercent: liveData?.changePercent ?? 0,
      // Seed with a single real point — the old 20 fabricated flat points drew
      // a fake price line; the 1D chart now shows a "collecting data" state
      // until enough live ticks exist.
      history: [nowPoint(basePrice)],
    };
  }));

  return stocks;
};

export interface StockUpdateResult {
  stocks: Stock[];
  /** False when every live fetch this tick failed — drives the "prices delayed" indicator. */
  liveDataReceived: boolean;
}

/**
 * Refreshes 1-2 symbols per tick from Yahoo (the viewed stock always included)
 * to stay inside rate limits; all other stocks keep their last known price AND
 * their last known change. Previously non-fetched stocks had `change` zeroed
 * while `changePercent` was kept, which rendered green "+-2.50%" on stocks
 * that were down.
 */
export const updateStockPrices = async (
  stocks: Stock[],
  prioritySymbol?: string
): Promise<StockUpdateResult> => {
  if (stocks.length === 0) {
    return { stocks, liveDataReceived: true };
  }

  const randomSymbol = stocks[Math.floor(Math.random() * stocks.length)].symbol;
  const symbolsToUpdateLive = prioritySymbol && prioritySymbol !== randomSymbol
    ? [prioritySymbol, randomSymbol]
    : [randomSymbol];

  let liveFetches = 0;
  let liveSuccesses = 0;

  const updatedStocks = await Promise.all(stocks.map(async (stock) => {
    const shouldFetchLive = symbolsToUpdateLive.includes(stock.symbol);

    if (!shouldFetchLive) {
      // No new data: carry the previous quote forward unchanged and extend the
      // tick history with the last known price (flat segment = "no new data").
      return {
        ...stock,
        history: [...stock.history, nowPoint(stock.price)].slice(-MAX_HISTORY_POINTS),
      };
    }

    liveFetches += 1;
    const liveData = await fetchStockQuote(stock.symbol);
    if (liveData) liveSuccesses += 1;

    const newPrice = liveData?.price ?? stock.price;

    return {
      ...stock,
      price: newPrice,
      change: liveData?.change ?? stock.change,
      changePercent: liveData?.changePercent ?? stock.changePercent,
      history: [...stock.history, nowPoint(newPrice)].slice(-MAX_HISTORY_POINTS),
    };
  }));

  return {
    stocks: updatedStocks,
    liveDataReceived: liveFetches === 0 || liveSuccesses > 0,
  };
};
