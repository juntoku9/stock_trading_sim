
import React, { useMemo, useState } from 'react';
import { UserProfile, LeaderboardEntry } from '../types';
import { Star, Globe, Lock, Copy, Users } from 'lucide-react';

interface LeaderboardProps {
  user: UserProfile;
  portfolioValue: number;
  entries: LeaderboardEntry[];
  onChangeLeague: (league: { name: string; type: 'public' | 'private'; roomMode?: 'create' | 'join'; roomCode?: string }) => Promise<void>;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ user, portfolioValue, entries, onChangeLeague }) => {
  const [mode, setMode] = useState<'create' | 'join'>('join');
  const [roomName, setRoomName] = useState('Friends League');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const allEntries = useMemo(() => {
    const hasCurrentUser = entries.some((entry) => entry.username === user.username);
    const combined = hasCurrentUser
      ? entries
      : [...entries, { username: user.username, totalValue: portfolioValue, rank: entries.length + 1 }];
    return [...combined]
      .sort((a, b) => b.totalValue - a.totalValue)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [entries, portfolioValue, user.username]);

  const currentUserEntry = allEntries.find(e => e.username === user.username);

  const submitRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await onChangeLeague({
        name: mode === 'create' ? roomName : '',
        type: 'private',
        roomMode: mode,
        roomCode: mode === 'join' ? roomCode : undefined,
      });
      setRoomCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change room.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-10">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-[#161616] border border-white/[0.06] rounded-full mb-4">
          {user.league.type === 'public' ? <Globe className="w-8 h-8 text-green-400" /> : <Lock className="w-8 h-8 text-green-400" />}
        </div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">{user.league.name}</h1>
        <p className="text-sm text-[#a1a1aa] max-w-md mx-auto">
          {user.league.type === 'public' ? 'Global rankings for all traders' : 'A private leaderboard for you and your friends'}
        </p>
        {user.league.roomCode && (
          <button type="button" onClick={() => void navigator.clipboard?.writeText(user.league.roomCode!)}
            className="inline-flex items-center gap-3 border border-green-500/30 bg-green-500/10 text-green-300 px-4 py-3 text-sm font-semibold tracking-[0.2em]">
            {user.league.roomCode} <Copy className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] bg-[#161616] border border-white/[0.06]">
        <div className="p-6 border-b md:border-b-0 md:border-r border-white/[0.06]">
          <Users className="w-6 h-6 text-green-400 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Friends-only room</h2>
          <p className="text-sm text-[#a1a1aa]">Create a room and share its six-character code, or join one your friend made.</p>
          {user.league.type === 'private' && (
            <button type="button" onClick={() => void onChangeLeague({ name: 'Global PaperTrade Arena', type: 'public' })}
              className="mt-5 text-xs font-semibold text-green-400 border border-green-500/30 px-3 py-2">Return to global leaderboard</button>
          )}
          {user.league.type === 'public' && user.league.savedRoomCode && (
            <button type="button" onClick={() => void onChangeLeague({ name: '', type: 'private', roomMode: 'join', roomCode: user.league.savedRoomCode })}
              className="mt-5 text-xs font-semibold text-green-400 border border-green-500/30 px-3 py-2 block">
              Return to {user.league.savedRoomName || 'private room'}
            </button>
          )}
        </div>
        <form onSubmit={submitRoom} className="p-6">
          <div className="flex border border-white/[0.06] mb-5">
            {(['join', 'create'] as const).map(option => (
              <button key={option} type="button" onClick={() => setMode(option)}
                className={`flex-1 py-2.5 text-sm font-semibold ${mode === option ? 'bg-green-500 text-black' : 'text-[#a1a1aa]'}`}>
                {option === 'join' ? 'Join with code' : 'Create room'}
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-[#a1a1aa] mb-2">{mode === 'join' ? 'Room code' : 'Room name'}</label>
          <div className="flex gap-3">
            <input value={mode === 'join' ? roomCode : roomName}
              onChange={event => mode === 'join' ? setRoomCode(event.target.value.toUpperCase().slice(0, 6)) : setRoomName(event.target.value)}
              required placeholder={mode === 'join' ? 'ABC123' : 'Friday Traders'}
              className="min-w-0 flex-1 bg-[#0a0a0a] border border-white/[0.06] px-4 py-3 text-white focus:outline-none focus:border-green-500/50" />
            <button disabled={isSaving} className="bg-green-500 text-black font-semibold px-5 disabled:opacity-50">
              {isSaving ? 'Saving…' : mode === 'join' ? 'Join' : 'Create'}
            </button>
          </div>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </form>
      </div>

      <div className="bg-[#161616] border border-white/[0.06] p-8 flex flex-col md:flex-row items-center justify-between gap-6 rounded-xl">
        <div className="flex items-center gap-6 text-center md:text-left">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 flex items-center justify-center rounded-xl text-2xl font-bold text-green-400">
            #{currentUserEntry?.rank}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Current Standing</h2>
            <p className="text-[#a1a1aa] text-sm">Competing in {user.league.name}</p>
          </div>
        </div>
        <div className="bg-[#0a0a0a] border border-white/[0.06] px-6 py-4 rounded-lg text-center md:text-right">
          <p className="text-xs text-[#a1a1aa] font-medium mb-1">Total Equity</p>
          <p className="text-2xl font-semibold text-white">${portfolioValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-[#161616] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-8 py-4 text-xs font-medium text-[#a1a1aa]">Rank</th>
              <th className="px-8 py-4 text-xs font-medium text-[#a1a1aa]">Trader</th>
              <th className="px-8 py-4 text-xs font-medium text-[#a1a1aa] text-right">Net Worth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {allEntries.map((entry) => (
              <tr key={entry.username}
                className={`transition-colors ${entry.username === user.username ? 'bg-green-500/5' : 'hover:bg-white/[0.02]'}`}>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    {entry.rank === 1 && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                    <span className={`text-lg font-bold ${entry.rank <= 3 ? 'text-green-400' : 'text-[#52525b]'}`}>{entry.rank}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#0a0a0a] border border-white/[0.06] rounded-full flex items-center justify-center font-semibold text-[#a1a1aa] text-xs">
                      {entry.username.substring(0, 2).toUpperCase()}
                    </div>
                    <p className={`text-sm font-semibold ${entry.username === user.username ? 'text-green-300' : 'text-white'}`}>
                      {entry.username}
                      {entry.username === user.username && <span className="ml-3 text-[10px] bg-green-500 text-black px-2 py-0.5 rounded-full font-bold">You</span>}
                    </p>
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  <p className="font-semibold text-white">${entry.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;
