
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

  const chartData = user.performanceHistory.map(p => ({
    time: p.time,
    val: p.price
  }));

  const dailyChangePercent = useMemo(() => {
    if (user.performanceHistory.length < 2) return 0;
    const initial = user.performanceHistory[0].price;
    const current = portfolioValue;
    return ((current - initial) / initial) * 100;
  }, [user.performanceHistory, portfolioValue]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-[#16161e] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-sm font-medium text-[#8b8b9e] mb-1">Portfolio Value</p>
              <h2 className="text-4xl font-bold text-white tracking-tight">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className={`px-3 py-1.5 text-xs font-semibold rounded-full ${dailyChangePercent >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {dailyChangePercent >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}% Overall
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1c28', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontFamily: 'Inter' }}
                  itemStyle={{ color: '#8B5CF6' }}
                  labelStyle={{ display: 'none' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                />
                <Area type="monotone" dataKey="val" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="w-full md:w-80 flex flex-col gap-4">
          <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl p-6 flex-1">
            <h3 className="text-xs font-semibold text-[#8b8b9e] mb-5">Top Gainers</h3>
            <div className="space-y-3">
              {topGainers.map(stock => (
                <button
                  key={stock.symbol}
                  onClick={() => onSelectStock(stock)}
                  className="w-full flex items-center justify-between p-3 border border-white/[0.06] hover:border-violet-500/40 transition-all duration-200 group rounded-xl"
                >
                  <div className="text-left">
                    <p className="font-semibold text-white text-sm">{stock.symbol}</p>
                    <p className="text-xs text-[#8b8b9e] truncate w-24">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white text-sm">${stock.price.toFixed(2)}</p>
                    <p className={`text-xs font-semibold ${stock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('learning')}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-6 hover:brightness-110 transition-all text-left group rounded-2xl"
          >
            <h4 className="font-bold text-sm mb-1 flex items-center justify-between">
              Trading Guide
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </h4>
            <p className="text-xs font-medium text-white/70">Learn how to build your virtual portfolio.</p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Cash Pool" value={`$${user.cash.toLocaleString()}`} />
        <StatCard label="Total Positions" value={user.holdings.length.toString()} />
        <StatCard label="Global Rank" value={globalRank ? `#${globalRank}` : 'Unranked'} />
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl p-6">
    <p className="text-xs font-medium text-[#8b8b9e] mb-3">{label}</p>
    <p className="text-xl font-bold text-white">{value}</p>
  </div>
);

export default Dashboard;
