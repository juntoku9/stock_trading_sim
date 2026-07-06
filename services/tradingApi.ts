import type { UserProfile, LeaderboardEntry, PendingOrder } from '../types';

/**
 * All requests ride on the Clerk session cookie (same-origin fetch) — the old
 * X-User-Id headers were spoofable and let anyone act as any user.
 */

type ProfileResponse = {
  profile: UserProfile | null;
  leaderboard: LeaderboardEntry[];
  error?: string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as { error?: string })?.error || 'Server request failed.');
  }

  return data as T;
};

export const fetchTradingProfile = async (): Promise<ProfileResponse> =>
  parseJson<ProfileResponse>(await fetch('/api/trading/profile'));

export const createTradingProfile = async (
  identity: { username: string; realName: string },
  league: { name: string; type: 'public' | 'private'; roomMode?: 'create' | 'join'; roomCode?: string }
): Promise<ProfileResponse> =>
  parseJson<ProfileResponse>(await fetch('/api/trading/profile', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      username: identity.username,
      realName: identity.realName,
      league,
    }),
  }));

export const executeMarketTrade = async (
  trade: {
    symbol: string;
    shares: number;
    type: 'BUY' | 'SELL';
    /** Server rejects the fill if the live price violates this limit. */
    limitPrice?: number;
  }
): Promise<ProfileResponse> =>
  parseJson<ProfileResponse>(await fetch('/api/trading/trades', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(trade),
  }));

// ---------------------------------------------------------------------------
// Pending orders — persisted server-side so they survive refresh
// ---------------------------------------------------------------------------

export const fetchPendingOrders = async (): Promise<PendingOrder[]> => {
  const data = await parseJson<{ orders: PendingOrder[] }>(await fetch('/api/trading/orders'));
  return data.orders;
};

export const createPendingOrder = async (order: {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'STOP_LOSS' | 'STOP_LIMIT';
  shares: number;
  limitPrice?: number;
  stopPrice?: number;
}): Promise<PendingOrder> => {
  const data = await parseJson<{ order: PendingOrder }>(await fetch('/api/trading/orders', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(order),
  }));
  return data.order;
};

export const updatePendingOrder = async (patch: {
  id: string;
  stopTriggered?: boolean;
  lastError?: string | null;
}): Promise<PendingOrder> => {
  const data = await parseJson<{ order: PendingOrder }>(await fetch('/api/trading/orders', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
  }));
  return data.order;
};

export const deletePendingOrder = async (orderId: string): Promise<void> => {
  await parseJson<{ ok: boolean }>(await fetch(`/api/trading/orders?id=${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  }));
};
