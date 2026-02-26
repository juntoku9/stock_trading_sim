
import React, { useMemo } from 'react';
import { UserProfile } from '../types';
import { Trophy, Medal, Star, Target, Globe, Lock } from 'lucide-react';

interface LeaderboardProps {
  user: UserProfile;
  portfolioValue: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ user, portfolioValue }) => {
  // Mock data for the rest of the leaderboard
  const mockEntries = useMemo(() => [
    { username: 'alpha_trader', totalValue: 142050.22, rank: 1 },
    { username: 'wall_st_bets', totalValue: 138900.00, rank: 2 },
    { username: 'crypto_king_sim', totalValue: 125400.15, rank: 3 },
    { username: 'buffett_apprentice', totalValue: 118200.44, rank: 4 },
    { username: 'paper_planes_v2', totalValue: 112000.00, rank: 5 },
  ], []);

  const allEntries = useMemo(() => {
    const combined = [...mockEntries, { username: user.username, totalValue: portfolioValue, rank: 0 }];
    return combined.sort((a, b) => b.totalValue - a.totalValue).map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));
  }, [user.username, portfolioValue, mockEntries]);

  const currentUserEntry = allEntries.find(e => e.username === user.username);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-12 font-mono">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-full mb-4">
          {user.league.type === 'public' ? (
            <Globe className="w-8 h-8 text-yellow-400" />
          ) : (
            <Lock className="w-8 h-8 text-yellow-400" />
          )}
        </div>
        <h1 className="text-4xl font-bold text-white uppercase tracking-tight">{user.league.name}</h1>
        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest max-w-md mx-auto">
          Currently viewing {user.league.type === 'public' ? 'Global' : 'Private'} rankings for this session.
        </p>
      </div>

      {/* User Rank Snapshot */}
      <div className="bg-yellow-400 p-8 flex flex-col md:flex-row items-center justify-between gap-6 rounded-lg">
        <div className="flex items-center gap-6 text-center md:text-left">
           <div className="w-16 h-16 bg-black flex items-center justify-center rounded-full text-2xl font-bold text-yellow-400">
             #{currentUserEntry?.rank}
           </div>
           <div>
             <h2 className="text-xl font-bold text-black mb-1 uppercase tracking-tight">Current Standing</h2>
             <p className="text-black/70 text-[10px] font-bold uppercase tracking-widest">
               Competing in {user.league.name}
             </p>
           </div>
        </div>
        <div className="bg-black/10 border border-black/20 px-6 py-4 rounded-md">
          <p className="text-[9px] text-black font-bold uppercase mb-1 tracking-widest">Total Equity</p>
          <p className="text-2xl font-bold text-black">${portfolioValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-900">
              <th className="px-8 py-5 text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Rank</th>
              <th className="px-8 py-5 text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Trader</th>
              <th className="px-8 py-5 text-[10px] font-bold text-yellow-400 uppercase tracking-widest text-right">Net Worth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {allEntries.map((entry) => (
              <tr 
                key={entry.username} 
                className={`transition-colors ${entry.username === user.username ? 'bg-yellow-400/5' : 'hover:bg-black'}`}
              >
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    {entry.rank === 1 && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                    <span className={`text-lg font-bold ${entry.rank <= 3 ? 'text-yellow-400' : 'text-zinc-700'}`}>
                      {entry.rank}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black border border-zinc-800 rounded-full flex items-center justify-center font-bold text-zinc-600 uppercase text-xs">
                      {entry.username.substring(0, 2)}
                    </div>
                    <div>
                      <p className={`text-sm font-bold uppercase tracking-tighter ${entry.username === user.username ? 'text-yellow-400' : 'text-white'}`}>
                        {entry.username}
                        {entry.username === user.username && <span className="ml-3 text-[8px] bg-yellow-400 text-black px-1.5 py-0.5 rounded-sm font-bold">You</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <p className="font-bold text-white tracking-tight">
                    ${entry.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
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
