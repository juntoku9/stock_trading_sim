
import { Stock, PricePoint, UserProfile } from '../types';
import { INITIAL_STOCKS, STARTING_CASH } from '../constants';
import { fetchStockQuote, hasLiveMarketDataConfig } from './marketData';

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

const simulateNextPrice = (currentPrice: number): number => {
  const drift = 0.0001;
  const volatility = 0.015;
  const change = currentPrice * (drift + volatility * (Math.random() - 0.5));
  return Math.max(0.01, currentPrice + change);
};

export const initializeStocks = async (): Promise<Stock[]> => {
  const stocks = await Promise.all(INITIAL_STOCKS.map(async (stockDef) => {
    const liveData = await fetchStockQuote(stockDef.symbol);
    const basePrice = liveData?.price ?? FALLBACK_PRICES[stockDef.symbol] ?? 100;
    const history: PricePoint[] = Array.from({ length: 20 }).map((_, idx) => ({
      time: new Date(Date.now() - (20 - idx) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: basePrice,
    }));

    return {
      ...stockDef,
      price: basePrice,
      change: liveData?.change ?? 0,
      changePercent: liveData?.changePercent ?? 0,
      history,
    };
  }));

  return stocks;
};

export const updateStockPrices = async (stocks: Stock[], prioritySymbol?: string): Promise<Stock[]> => {
  const symbolsToUpdateLive = prioritySymbol
    ? [prioritySymbol, stocks[Math.floor(Math.random() * stocks.length)].symbol]
    : [stocks[Math.floor(Math.random() * stocks.length)].symbol];

  const updatedStocks = await Promise.all(stocks.map(async (stock) => {
    const shouldFetchLive = symbolsToUpdateLive.includes(stock.symbol);
    let liveData = null;

    if (shouldFetchLive) {
      liveData = await fetchStockQuote(stock.symbol);
    }

    const shouldSimulate = !hasLiveMarketDataConfig && !liveData;
    const newPrice = liveData
      ? liveData.price
      : shouldSimulate
        ? simulateNextPrice(stock.price)
        : stock.price;
    const change = liveData
      ? liveData.change
      : shouldSimulate
        ? (newPrice - stock.price)
        : 0;
    const changePercent = liveData
      ? liveData.changePercent
      : shouldSimulate
        ? ((change / stock.price) * 100)
        : stock.changePercent;
    
    const nextPoint = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: newPrice
    };
    const newHistory = [...stock.history.slice(1), nextPoint];

    return {
      ...stock,
      price: newPrice,
      change,
      changePercent,
      history: newHistory
    };
  }));

  return updatedStocks;
};

export const getInitialUser = (
  username: string, 
  realName: string, 
  league: { name: string, type: 'public' | 'private' }
): UserProfile => ({
  id: Math.random().toString(36).substr(2, 9),
  username,
  realName,
  cash: STARTING_CASH,
  holdings: [],
  history: [],
  performanceHistory: [{
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: STARTING_CASH
  }],
  achievements: [],
  league: {
    id: Math.random().toString(36).substr(2, 6),
    ...league
  }
});

export const executeTrade = (
  user: UserProfile, 
  stock: Stock, 
  shares: number, 
  type: 'BUY' | 'SELL'
): UserProfile => {
  const cost = stock.price * shares;
  const newHoldings = [...user.holdings];
  const holdingIndex = newHoldings.findIndex(h => h.symbol === stock.symbol);

  if (type === 'BUY') {
    if (user.cash < cost) throw new Error('Insufficient virtual cash');
    
    if (holdingIndex >= 0) {
      const h = newHoldings[holdingIndex];
      const totalCost = (h.shares * h.averageCost) + cost;
      const totalShares = h.shares + shares;
      newHoldings[holdingIndex] = {
        ...h,
        shares: totalShares,
        averageCost: totalCost / totalShares
      };
    } else {
      newHoldings.push({
        symbol: stock.symbol,
        shares,
        averageCost: stock.price
      });
    }
    
    return {
      ...user,
      cash: user.cash - cost,
      holdings: newHoldings,
      history: [{
        id: Math.random().toString(36).substr(2, 9),
        symbol: stock.symbol,
        type: 'BUY',
        shares,
        priceAtTrade: stock.price,
        timestamp: Date.now()
      }, ...user.history]
    };
  } else {
    const holding = newHoldings[holdingIndex];
    if (!holding || holding.shares < shares) throw new Error('Insufficient shares to sell');

    if (holding.shares === shares) {
      newHoldings.splice(holdingIndex, 1);
    } else {
      newHoldings[holdingIndex] = {
        ...holding,
        shares: holding.shares - shares
      };
    }

    return {
      ...user,
      cash: user.cash + cost,
      holdings: newHoldings,
      history: [{
        id: Math.random().toString(36).substr(2, 9),
        symbol: stock.symbol,
        type: 'SELL',
        shares,
        priceAtTrade: stock.price,
        timestamp: Date.now()
      }, ...user.history]
    };
  }
};
