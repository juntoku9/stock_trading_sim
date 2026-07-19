import type { UserProfile, LeaderboardEntry } from '../types';

type AuthPayload = {
  userId: string;
  username: string;
  realName: string;
};

type ProfileResponse = {
  profile: UserProfile | null;
  leaderboard: LeaderboardEntry[];
  error?: string;
};

const authHeaders = (auth: AuthPayload) => ({
  'Content-Type': 'application/json',
  'X-User-Id': auth.userId,
  'X-User-Name': auth.username,
  'X-User-Display-Name': auth.realName,
});

const parseJson = async (response: Response): Promise<ProfileResponse> => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Server request failed.');
  }

  return data as ProfileResponse;
};

export const fetchTradingProfile = async (auth: AuthPayload): Promise<ProfileResponse> => {
  const response = await fetch('/api/trading/profile', {
    headers: authHeaders(auth),
  });

  return parseJson(response);
};

export const createTradingProfile = async (
  auth: AuthPayload,
  league: { name: string; type: 'public' | 'private'; roomMode?: 'create' | 'join'; roomCode?: string }
): Promise<ProfileResponse> => {
  const response = await fetch('/api/trading/profile', {
    method: 'POST',
    headers: authHeaders(auth),
    body: JSON.stringify({
      username: auth.username,
      realName: auth.realName,
      league,
    }),
  });

  return parseJson(response);
};

export const executeMarketTrade = async (
  auth: AuthPayload,
  trade: { symbol: string; shares: number; type: 'BUY' | 'SELL' }
): Promise<ProfileResponse> => {
  const response = await fetch('/api/trading/trades', {
    method: 'POST',
    headers: authHeaders(auth),
    body: JSON.stringify(trade),
  });

  return parseJson(response);
};

export const changeTradingLeague = async (
  auth: AuthPayload,
  league: { name: string; type: 'public' | 'private'; roomMode?: 'create' | 'join'; roomCode?: string }
): Promise<ProfileResponse> => {
  const response = await fetch('/api/trading/profile', {
    method: 'PUT',
    headers: authHeaders(auth),
    body: JSON.stringify({ league }),
  });
  return parseJson(response);
};
