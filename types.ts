
export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  history: PricePoint[];
  sector: string;
}

export interface PricePoint {
  time: string;
  price: number;
}

export interface Holding {
  symbol: string;
  shares: number;
  averageCost: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  priceAtTrade: number;
  timestamp: number;
}

export interface UserProfile {
  id: string;
  username: string;
  realName: string;
  cash: number;
  holdings: Holding[];
  history: Trade[];
  performanceHistory: PricePoint[]; // Tracks total net worth over time
  achievements: string[];
  league: {
    id: string;
    name: string;
    type: 'public' | 'private';
    roomCode?: string;
  };
}

export interface LeaderboardEntry {
  username: string;
  totalValue: number;
  rank: number;
}

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LIMIT';

export interface PendingOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: Exclude<OrderType, 'MARKET'>;
  shares: number;
  limitPrice?: number;
  stopPrice?: number;
  placedAt: number;
  stopTriggered?: boolean;
}
