
import React, { useState, useEffect } from 'react';
import { Stock, UserProfile } from '../types';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Zap, ExternalLink, Loader2, Newspaper } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { GoogleGenAI } from "@google/genai";

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
}

interface StockDetailProps {
  stock: Stock;
  user: UserProfile;
  onBack: () => void;
  onTrade: (stock: Stock, shares: number, type: 'BUY' | 'SELL') => Promise<void>;
}

const StockDetail: React.FC<StockDetailProps> = ({ stock, user, onBack, onTrade }) => {
  const [shares, setShares] = useState(1);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [isSubmittingTrade, setIsSubmittingTrade] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState<{ type: 'BUY' | 'SELL'; shares: number; total: number } | null>(null);

  const holding = user.holdings.find(h => h.symbol === stock.symbol);
  const totalCost = shares * stock.price;
  const canAfford = user.cash >= totalCost;
  const canSell = (holding?.shares || 0) >= shares;
  const isUp = stock.change >= 0;

  useEffect(() => {
    const fetchNews = async () => {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return;
      setIsNewsLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Find the 3 most recent and relevant news headlines for ${stock.name} (${stock.symbol}). Provide a very short 1-sentence summary for each. Format the output as a list.`,
          config: { tools: [{ googleSearch: {} }] },
        });
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        setNews(groundingChunks.slice(0, 3).map((chunk: any) => ({
          title: chunk.web?.title || `Update on ${stock.symbol}`,
          summary: "Check source for the latest details on market impact and company performance.",
          url: chunk.web?.uri || "#",
          source: chunk.web?.title?.split(' - ')[1] || 'Financial News'
        })));
      } catch (error) {
        console.error("News fetch error:", error);
      } finally {
        setIsNewsLoading(false);
      }
    };
    fetchNews();
  }, [stock.symbol]);

  const handleTradeSubmit = async () => {
    setIsSubmittingTrade(true);
    setTradeError('');
    try {
      await onTrade(stock, shares, tradeType);
      setTradeSuccess({ type: tradeType, shares, total: totalCost });
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Trade failed.');
    } finally {
      setIsSubmittingTrade(false);
    }
  };

  const chartColor = isUp ? "#4ADE80" : "#F87171";

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[#8b8b9e] hover:text-violet-300 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to list
        </button>
        <div className="flex items-center gap-2 text-[#8b8b9e]">
          <Zap className="w-3 h-3" />
          <span className="text-xs font-medium">Real-time Pricing</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-5xl font-bold text-white tracking-tight">{stock.symbol}</h1>
              <span className="text-xs font-medium px-3 py-1 border border-white/[0.06] text-[#8b8b9e] rounded-full">{stock.sector}</span>
            </div>
            <p className="text-sm text-[#8b8b9e] mb-4">{stock.name}</p>
            <div className="flex items-end gap-4">
              <span className="text-5xl font-bold text-white tracking-tight">${stock.price.toFixed(2)}</span>
              <div className={`flex items-center gap-1 mb-2 font-semibold text-sm ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(stock.changePercent).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="h-96 w-full bg-[#16161e] border border-white/[0.06] rounded-2xl p-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stock.history}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1c28', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontFamily: 'Inter' }}
                  itemStyle={{ color: chartColor }}
                />
                <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Newspaper className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Latest Headlines</h2>
            </div>
            {isNewsLoading ? (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                <p className="text-sm text-[#8b8b9e]">Scanning market news...</p>
              </div>
            ) : news.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {news.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="bg-[#16161e] border border-white/[0.06] p-4 rounded-xl hover:border-violet-500/30 transition-all group">
                    <p className="text-xs text-violet-300 font-semibold mb-2 group-hover:underline">{item.title}</p>
                    <p className="text-xs text-[#8b8b9e] leading-relaxed mb-3">{item.source}</p>
                    <div className="flex items-center gap-2 text-xs font-medium text-[#4a4a5c]">
                      <ExternalLink className="w-3 h-3" /> Read Article
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#8b8b9e] italic">No recent headlines found for this symbol.</p>
            )}
          </div>
        </div>

        <div className="w-full lg:w-96">
          <div className="bg-[#16161e] border border-white/[0.06] p-6 rounded-2xl sticky top-24">
            <div className="flex gap-1 mb-6">
              <button onClick={() => setTradeType('BUY')}
                className={`flex-1 py-3 font-semibold text-sm transition-all rounded-lg border ${tradeType === 'BUY' ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-transparent border-white/[0.06] text-[#8b8b9e]'}`}>
                Buy
              </button>
              <button onClick={() => setTradeType('SELL')}
                className={`flex-1 py-3 font-semibold text-sm transition-all rounded-lg border ${tradeType === 'SELL' ? 'bg-red-500 border-red-500 text-white' : 'bg-transparent border-white/[0.06] text-[#8b8b9e]'}`}>
                Sell
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-[#8b8b9e] mb-3">Number of Shares</label>
                <div className="flex items-center gap-4 border-b border-white/[0.06] pb-2">
                  <button onClick={() => setShares(s => Math.max(1, s - 1))} className="text-[#8b8b9e] hover:text-white font-bold text-2xl w-10 h-10 rounded-lg hover:bg-white/[0.04] transition-all flex items-center justify-center">-</button>
                  <input type="number" value={shares} onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 0))}
                    className="flex-1 bg-transparent text-center text-3xl font-bold text-white focus:outline-none" />
                  <button onClick={() => setShares(s => s + 1)} className="text-[#8b8b9e] hover:text-white font-bold text-2xl w-10 h-10 rounded-lg hover:bg-white/[0.04] transition-all flex items-center justify-center">+</button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm text-[#8b8b9e]">
                  <span>Price per share</span>
                  <span className="text-white font-medium">${stock.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-white">Estimated Total</span>
                  <span className="text-violet-400">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <button onClick={() => void handleTradeSubmit()}
                disabled={isSubmittingTrade || (tradeType === 'BUY' ? !canAfford : !canSell)}
                className={`w-full py-4 font-semibold text-sm transition-all rounded-xl ${
                  tradeType === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-red-500 hover:bg-red-400 text-white'
                } disabled:bg-[#2a2a3c] disabled:text-[#4a4a5c] disabled:cursor-not-allowed`}>
                {isSubmittingTrade ? 'Processing...' : `Confirm ${tradeType === 'BUY' ? 'Purchase' : 'Sale'}`}
              </button>

              <div className="text-center">
                <p className="text-xs text-[#8b8b9e]">
                  {tradeType === 'BUY' ? `Available Cash: $${user.cash.toLocaleString()}` : `Current Holding: ${holding?.shares || 0} Shares`}
                </p>
                {tradeError && <p className="mt-3 text-xs text-red-400 font-medium">{tradeError}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {tradeSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-[#16161e] border border-violet-500/30 rounded-2xl p-8 shadow-2xl animate-fade-in">
            <p className="text-sm font-semibold text-violet-400 mb-2">Trade Confirmed</p>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-6">
              {tradeSuccess.type === 'BUY' ? 'Purchase Complete' : 'Sale Complete'}
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#8b8b9e]"><span>Symbol</span><span className="text-white font-semibold">{stock.symbol}</span></div>
              <div className="flex justify-between text-[#8b8b9e]"><span>Shares</span><span className="text-white font-semibold">{tradeSuccess.shares}</span></div>
              <div className="flex justify-between text-[#8b8b9e]"><span>Estimated Fill</span><span className="text-violet-400 font-semibold">${tradeSuccess.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>
            <p className="mt-6 text-xs text-[#8b8b9e]">Your portfolio and trade history were updated successfully.</p>
            <button onClick={() => setTradeSuccess(null)}
              className="mt-6 w-full bg-violet-500 hover:bg-violet-400 text-white font-semibold py-4 rounded-xl transition-all text-sm">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockDetail;
