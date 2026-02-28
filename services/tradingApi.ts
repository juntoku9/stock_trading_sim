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
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    if (data?.error) {
      throw new Error(data.error);
    }

    const fallbackText = isJson ? '' : (await response.text()).slice(0, 120);
    throw new Error(
      fallbackText
        ? `Server request failed: ${fallbackText}`
        : `Server request failed with status ${response.status}.`
    );
  }

  if (!data) {
    throw new Error('Server returned a non-JSON response.');
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
  league: { name: string; type: 'public' | 'private' }
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
