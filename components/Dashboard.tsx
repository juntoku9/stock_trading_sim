
import React, { useMemo } from 'react';
import { Stock, UserProfile } from '../types';
import { ArrowRight, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardProps {
  user: UserProfile;
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  portfolioValue: number;
  onNavigate: (tab: string) => void;
  globalRank: number | null;
}

interface ChartPoint {
  time: string;
  val: number;
  event: 'BUY' | 'SELL' | 'START' | null;
  tradeTs?: number; // unix ms timestamp of the trade
}

const relativeTime = (ms: number): string => {
  const diff = Date.now() - ms;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  const weeks = Math.floor(days / 7);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (weeks <  5) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Custom dot: only renders a visible marker on trade events
const TradeEventDot = (props: any) => {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ChartPoint };
  if (!payload.event || payload.event === 'START') return <g />;
  const isBuy = payload.event === 'BUY';
  const color = isBuy ? '#4ADE80' : '#F87171';

  // Triangle pointing up for buy, down for sell
  const size = 6;
  const points = isBuy
    ? `${cx},${cy - size} ${cx - size},${cy + size * 0.6} ${cx + size},${cy + size * 0.6}`
    : `${cx},${cy + size} ${cx - size},${cy - size * 0.6} ${cx + size},${cy - size * 0.6}`;

  return (
    <g>
      <polygon points={points} fill={color} stroke="#1a1a1a" strokeWidth={1.5} />
    </g>
  );
};

// Custom tooltip: shows trade event label when hovering a trade point
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartPoint;
  const isBuy = d.event === 'BUY';
  const isSell = d.event === 'SELL';
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      padding: '10px 14px',
      fontFamily: 'Inter',
      minWidth: '140px',
    }}>
      <p style={{ color: '#a1a1aa', fontSize: '11px', marginBottom: '4px' }}>Portfolio Value</p>
      <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '14px' }}>
        ${d.val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
      {(isBuy || isSell) && (
        <div style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ color: isBuy ? '#4ADE80' : '#F87171', fontSize: '11px', fontWeight: 600 }}>
            {isBuy ? '▲ BUY' : '▼ SELL'}
          </p>
          {d.tradeTs && (
            <p style={{ color: '#a1a1aa', fontSize: '10px', marginTop: '2px' }}>
              {relativeTime(d.tradeTs)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, stocks, onSelectStock, portfolioValue, onNavigate, globalRank }) => {
  const topGainers = useMemo(() => [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3), [stocks]);

  // Match trade timestamps from user.history onto the chart points.
  // DB snapshots are ASC: [Start, trade0, trade1, ...] — trades in history are DESC.
  // So performanceHistory[1] = user.history[last], performanceHistory[2] = user.history[last-1], etc.
  const reversedHistory = [...user.history].reverse(); // oldest → newest
  let tradeIdx = 0;

  const chartData: ChartPoint[] = user.performanceHistory.map(p => {
    const label = p.time;
    const event: ChartPoint['event'] =
      label === 'Buy' ? 'BUY' :
      label === 'Sell' ? 'SELL' :
      label === 'Start' ? 'START' :
      null;

    let tradeTs: number | undefined;
    if (event === 'BUY' || event === 'SELL') {
      tradeTs = reversedHistory[tradeIdx]?.timestamp;
      tradeIdx++;
    }

    return { time: label, val: p.price, event, tradeTs };
  });

  const dailyChangePercent = useMemo(() => {
    if (user.performanceHistory.length < 2) return 0;
    const initial = user.performanceHistory[0].price;
    const current = portfolioValue;
    return ((current - initial) / initial) * 100;
  }, [user.performanceHistory, portfolioValue]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-[#161616] border border-white/[0.06] rounded-xl p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm font-medium text-[#a1a1aa] mb-1">Portfolio Value</p>
              <h2 className="text-3xl font-semibold text-white tracking-tight">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className={`px-3 py-1.5 text-xs font-semibold rounded-full ${dailyChangePercent >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {dailyChangePercent >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}% Overall
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polygon points="5,0 0,10 10,10" fill="#4ADE80" />
              </svg>
              Buy
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polygon points="5,10 0,0 10,0" fill="#F87171" />
              </svg>
              Sell
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="val"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVal)"
                  dot={<TradeEventDot />}
                  activeDot={{ r: 4, fill: '#22c55e', stroke: '#1a1a1a', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="w-full md:w-80 flex flex-col gap-4">
          <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-6 flex-1">
            <h3 className="text-xs font-semibold text-[#a1a1aa] mb-5">Top Gainers</h3>
            <div className="space-y-3">
              {topGainers.map(stock => (
                <button
                  key={stock.symbol}
                  onClick={() => onSelectStock(stock)}
                  className="w-full flex items-center justify-between p-3 border border-white/[0.06] hover:border-green-500/40 transition-all duration-200 group rounded-xl"
                >
                  <div className="text-left">
                    <p className="font-semibold text-white text-sm">{stock.symbol}</p>
                    <p className="text-xs text-[#a1a1aa] truncate w-24">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white text-sm">${stock.price.toFixed(2)}</p>
                    <p className={`text-xs font-semibold ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('learning')}
            className="bg-[#161616] border border-white/[0.06] p-6 hover:border-green-500/40 transition-colors text-left group rounded-xl"
          >
            <h4 className="font-semibold text-sm text-white mb-1 flex items-center justify-between">
              Trading Guide
              <ArrowRight className="w-4 h-4 text-green-400 group-hover:translate-x-1 transition-transform" />
            </h4>
            <p className="text-xs text-[#a1a1aa]">Learn how to build your virtual portfolio.</p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Cash Pool" value={`$${user.cash.toLocaleString()}`} />
        <StatCard label="Total Positions" value={user.holdings.length.toString()} />
        <StatCard label="Global Rank" value={globalRank ? `#${globalRank}` : 'Unranked'} />
      </div>

      {/* Recent Activity */}
      <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          </div>
          {user.history.length > 5 && (
            <button
              onClick={() => onNavigate('portfolio')}
              className="flex items-center gap-1 text-xs font-medium text-green-400 hover:text-green-300 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {user.history.length === 0 ? (
          <p className="text-sm text-[#a1a1aa] text-center py-6">No trades yet — buy your first stock!</p>
        ) : (
          <div className="space-y-2">
            {user.history.slice(0, 5).map(trade => {
              const isBuy = trade.type === 'BUY';
              const total = trade.shares * trade.priceAtTrade;
              const d = new Date(trade.timestamp);
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={trade.id} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isBuy ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {trade.type}
                    </span>
                    <span className="text-sm font-semibold text-white">{trade.symbol}</span>
                    <span className="text-xs text-[#a1a1aa]">{trade.shares} shares @ ${trade.priceAtTrade.toFixed(2)}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={`text-sm font-semibold ${isBuy ? 'text-red-400' : 'text-green-400'}`}>
                      {isBuy ? '−' : '+'}${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-[#a1a1aa]">{dateStr} · {timeStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-6">
    <p className="text-xs font-medium text-[#a1a1aa] mb-3">{label}</p>
    <p className="text-xl font-bold text-white">{value}</p>
  </div>
);

export default Dashboard;
