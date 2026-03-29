import React from 'react';
import { UserProfile, Stock } from '../types';
import { Briefcase, History, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface PortfolioViewProps {
  user: UserProfile;
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({ user, stocks, onSelectStock }) => {
  const currentHoldings = user.holdings.map(h => {
    const stock = stocks.find(s => s.symbol === h.symbol);
    const currentPrice = stock?.price || 0;
    const totalValue = h.shares * currentPrice;
    const costBasis = h.shares * h.averageCost;
    const pnl = totalValue - costBasis;
    const pnlPercent = (pnl / costBasis) * 100;
    return { ...h, stock, totalValue, pnl, pnlPercent };
  });

  return (
    <div className="animate-fade-in space-y-12">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Portfolio</h1>
        <p className="text-sm text-[#8b8b9e]">Your active positions and trade history</p>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="w-5 h-5 text-violet-400" />
          <h2 className="text-sm font-semibold text-violet-400">Active Positions</h2>
        </div>

        {currentHoldings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentHoldings.map(item => (
              <div key={item.symbol} onClick={() => item.stock && onSelectStock(item.stock)}
                className="bg-[#16161e] border border-white/[0.06] p-6 rounded-2xl hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 cursor-pointer transition-all duration-200 group">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white group-hover:text-violet-300 transition-colors leading-none">{item.symbol}</h3>
                    <p className="text-xs text-[#8b8b9e] mt-1">{item.stock?.name}</p>
                  </div>
                  <div className={`text-right ${item.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <p className="text-sm font-semibold">{item.pnlPercent.toFixed(2)}%</p>
                    <p className="text-xs font-medium mt-1">{item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4">
                  <div>
                    <p className="text-xs text-[#8b8b9e] mb-1">Shares</p>
                    <p className="text-sm font-semibold text-white">{item.shares}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8b8b9e] mb-1">Market Value</p>
                    <p className="text-sm font-semibold text-white">${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#16161e] border border-white/[0.06] border-dashed p-16 text-center rounded-2xl">
            <Briefcase className="w-12 h-12 text-[#4a4a5c] mx-auto mb-4" />
            <p className="text-[#8b8b9e] text-sm">No positions yet. Start trading to build your portfolio!</p>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <History className="w-5 h-5 text-violet-400" />
          <h2 className="text-sm font-semibold text-violet-400">Trade History</h2>
        </div>
        <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl overflow-hidden">
          {user.history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e]">Symbol</th>
                    <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e]">Type</th>
                    <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e] text-right">Shares</th>
                    <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e] text-right">Price</th>
                    <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e] text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {user.history.map(trade => (
                    <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{trade.symbol}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>{trade.type}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-white">{trade.shares}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-[#8b8b9e]">${trade.priceAtTrade.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm text-[#8b8b9e]">{new Date(trade.timestamp).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center text-[#8b8b9e] text-sm">No trades yet</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PortfolioView;
