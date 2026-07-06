export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  /** Company name when Yahoo provides one — used to restore held stocks after refresh. */
  name?: string;
}

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

export const fetchStockQuote = async (symbol: string): Promise<StockQuote | null> => {
  try {
    const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&_t=${Date.now()}`, { cache: 'no-store' });

    if (!response.ok) {
      console.warn(`Yahoo Finance request failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (
      !data ||
      !isFiniteNumber(data.price) ||
      !isFiniteNumber(data.change) ||
      !isFiniteNumber(data.changePercent)
    ) {
      console.warn(`Yahoo Finance returned incomplete quote data for ${symbol}.`, data);
      return null;
    }

    return {
      symbol: typeof data.symbol === 'string' ? data.symbol : symbol,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      name: typeof data.name === 'string' ? data.name : undefined,
    };
  } catch (error) {
    console.error(`Error fetching Yahoo Finance quote for ${symbol}:`, error);
    return null;
  }
};
