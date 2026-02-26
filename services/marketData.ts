
const API_KEY = 'S59UCBGISGLYG9IC';
const BASE_URL = 'https://www.alphavantage.co/query';

export interface AlphaVantageQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export const fetchAlphaVantageQuote = async (symbol: string): Promise<AlphaVantageQuote | null> => {
  try {
    const response = await fetch(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`);
    const data = await response.json();
    
    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) {
      console.warn(`Alpha Vantage: No data for ${symbol}. Might be rate limited.`, data);
      return null;
    }

    return {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
    };
  } catch (error) {
    console.error(`Error fetching live data for ${symbol}:`, error);
    return null;
  }
};
