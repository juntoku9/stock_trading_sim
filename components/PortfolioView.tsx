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
    
    return {
      ...h,
      stock,
      totalValue,
      pnl,
      pnlPercent
    };
  });

  return (
    <div className="animate-fade-in space-y-16 font-mono">
      <div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">PORTFOLIO_STATUS</h1>
        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Analysis of active inventory and historical execution...</p>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-8">
          <Briefcase className="w-5 h-5 text-yellow-400" />
          <h2 className="text-[11px] font-black text-yellow-400 uppercase tracking-[0.3em]">ACTIVE_POSITIONS</h2>
        </div>

        {currentHoldings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentHoldings.map(item => (
              <div 
                key={item.symbol}
                onClick={() => item.stock && onSelectStock(item.stock)}
                className="bg-black border border-zinc-900 p-6 hover:border-yellow-400 cursor-pointer transition-all group shadow-[5px_5px_0px_#111] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-white group-hover:text-yellow-400 transition-colors uppercase leading-none">{item.symbol}</h3>
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-2">{item.stock?.name}</p>
                  </div>
                  <div className={`text-right ${item.pnl >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                    <p className="text-xs font-black flex items-center justify-end gap-1 uppercase">
                      {item.pnlPercent.toFixed(2)}%
                    </p>
                    <p className="text-[10px] font-black mt-1">
                      {item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(2)}_USD
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 border-t border-zinc-900 pt-6">
                  <div>
                    <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest mb-1">UNITS</p>
                    <p className="text-sm font-black text-white">{item.shares}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest mb-1">MKT_VALUE</p>
                    <p className="text-sm font-black text-white">${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-950/30 border border-zinc-900 p-24 text-center border-dashed">
             <Briefcase className="w-12 h-12 text-zinc-800 mx-auto mb-6" />
             <p className="text-zinc-600 font-black uppercase tracking-widest text-xs">ERR_INVENTORY_EMPTY: NO_ACTIVE_POSITIONS</p>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-8">
          <History className="w-5 h-5 text-yellow-400" />
          <h2 className="text-[11px] font-black text-yellow-400 uppercase tracking-[0.3em]">EXECUTION_HISTORY</h2>
        </div>

        <div className="bg-black border border-zinc-900 rounded-sm overflow-hidden">
          {user.history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950">
                    <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">SYMBOL</th>
                    <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">ACTION</th>
                    <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] text-right">UNITS</th>
                    <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] text-right">PRICE_EXEC</th>
                    <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] text-right">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {user.history.map(trade => (
                    <tr key={trade.id} className="hover:bg-zinc-950 transition-colors">
                      <td className="px-6 py-4 font-black text-white uppercase">{trade.symbol}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                          trade.type === 'BUY' ? 'border-yellow-400/30 text-yellow-400 bg-yellow-400/5' : 'border-zinc-100/30 text-zinc-100 bg-zinc-100/5'
                        }`}>
                          {trade.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-white uppercase">{trade.shares}_SH</td>
                      <td className="px-6 py-4 text-right text-xs font-black text-zinc-400 tracking-tighter">${trade.priceAtTrade.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-[10px] text-zinc-700 font-bold uppercase">
                        {new Date(trade.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center text-zinc-800 font-black uppercase tracking-[0.2em] text-[10px]">NULL_HISTORY: LOG_CLEAN</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PortfolioView;