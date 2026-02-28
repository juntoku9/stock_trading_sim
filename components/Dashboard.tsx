
import React, { useMemo } from 'react';
import { Stock, UserProfile } from '../types';
import { ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardProps {
  user: UserProfile;
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  portfolioValue: number;
  onNavigate: (tab: string) => void;
  globalRank: number | null;
}

const Dashboard: React.FC<DashboardProps> = ({ user, stocks, onSelectStock, portfolioValue, onNavigate, globalRank }) => {
  const topGainers = useMemo(() => [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3), [stocks]);
  
  // Use actual performance history from the user profile
  const chartData = user.performanceHistory.map(p => ({
    time: p.time,
    val: p.price
  }));

  // Calculate daily change based on the performance history
  const dailyChangePercent = useMemo(() => {
    if (user.performanceHistory.length < 2) return 0;
    const initial = user.performanceHistory[0].price;
    const current = portfolioValue;
    return ((current - initial) / initial) * 100;
  }, [user.performanceHistory, portfolioValue]);

  return (
    <div className="space-y-10 animate-fade-in font-mono">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Portfolio Stats */}
        <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Portfolio Value</p>
              <h2 className="text-4xl font-bold text-white tracking-tight">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className={`px-3 py-1 text-[10px] font-bold rounded-sm ${dailyChangePercent >= 0 ? 'bg-yellow-400 text-black' : 'bg-red-500 text-white'}`}>
              {dailyChangePercent >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}% Overall
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#facc15" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px', fontFamily: 'JetBrains Mono' }}
                  itemStyle={{ color: '#facc15' }}
                  labelStyle={{ display: 'none' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                />
                <Area type="monotone" dataKey="val" stroke="#facc15" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Movers */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 flex-1">
            <h3 className="text-[10px] font-bold text-yellow-400 mb-6 uppercase tracking-widest">
              Top Gainers
            </h3>
            <div className="space-y-4">
              {topGainers.map(stock => (
                <button 
                  key={stock.symbol}
                  onClick={() => onSelectStock(stock)}
                  className="w-full flex items-center justify-between p-3 border border-zinc-900 hover:border-yellow-400 transition-all group rounded-md"
                >
                  <div className="text-left">
                    <p className="font-bold text-white text-sm uppercase">{stock.symbol}</p>
                    <p className="text-[9px] text-zinc-600 truncate w-24">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-xs">${stock.price.toFixed(2)}</p>
                    <p className={`text-[10px] font-bold ${stock.change >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <button 
            onClick={() => onNavigate('learning')}
            className="bg-yellow-400 text-black p-6 hover:bg-yellow-300 transition-colors text-left group rounded-lg"
          >
            <h4 className="font-bold text-sm mb-1 uppercase flex items-center justify-between">
              Trading Guide
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </h4>
            <p className="text-[10px] font-bold opacity-70">Learn how to build your virtual portfolio.</p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Cash Pool" value={`$${user.cash.toLocaleString()}`} />
        <StatCard label="Total Positions" value={user.holdings.length.toString()} />
        <StatCard label="Global Rank" value={globalRank ? `#${globalRank}` : 'Unranked'} />
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3">{label}</p>
    <p className="text-xl font-bold text-white">{value}</p>
  </div>
);

export default Dashboard;
