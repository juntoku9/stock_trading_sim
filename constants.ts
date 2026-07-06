
import { Stock } from './types';

export const STARTING_CASH = 100000;
export const PRICE_UPDATE_INTERVAL = 15000; // 15 seconds

export const INITIAL_STOCKS: Omit<Stock, 'price' | 'change' | 'changePercent' | 'history'>[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financial Services' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive' },
  { symbol: 'DIS', name: 'The Walt Disney Co.', sector: 'Communication Services' },
];

// NOTE: the old ACHIEVEMENTS list was removed — it was never awarded or
// displayed anywhere. Reintroduce alongside real award logic if wanted.
