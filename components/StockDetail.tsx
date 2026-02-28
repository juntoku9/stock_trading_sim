
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
  const [tradeSuccess, setTradeSuccess] = useState<{
    type: 'BUY' | 'SELL';
    shares: number;
    total: number;
  } | null>(null);

  const holding = user.holdings.find(h => h.symbol === stock.symbol);
  const totalCost = shares * stock.price;
  const canAfford = user.cash >= totalCost;
  const canSell = (holding?.shares || 0) >= shares;
  const isUp = stock.change >= 0;

  useEffect(() => {
    const fetchNews = async () => {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        return;
      }

      setIsNewsLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Find the 3 most recent and relevant news headlines for ${stock.name} (${stock.symbol}). Provide a very short 1-sentence summary for each. Format the output as a list.`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        const text = response.text || "";
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        // Extract links from grounding chunks
        const extractedNews: NewsItem[] = groundingChunks.slice(0, 3).map((chunk: any, idx: number) => ({
          title: chunk.web?.title || `Update on ${stock.symbol}`,
          summary: "Check source for the latest details on market impact and company performance.",
          url: chunk.web?.uri || "#",
          source: chunk.web?.title?.split(' - ')[1] || 'Financial News'
        }));

        setNews(extractedNews);
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
      setTradeSuccess({
        type: tradeType,
        shares,
        total: totalCost,
      });
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Trade failed.');
    } finally {
      setIsSubmittingTrade(false);
    }
  };

  return (
    <div className="animate-fade-in font-mono">
      <div className="flex items-center justify-between mb-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-yellow-400 transition-colors group uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to list
        </button>
        <div className="flex items-center gap-2 text-zinc-600">
          <Zap className="w-3 h-3" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Real-time Pricing</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-10">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-5xl font-bold text-white tracking-tight uppercase">{stock.symbol}</h1>
              <span className="text-[10px] font-bold px-2 py-1 border border-zinc-800 text-zinc-600 rounded-sm">{stock.sector}</span>
            </div>
            <p className="text-sm text-zinc-500 font-bold mb-6">{stock.name}</p>
            <div className="flex items-end gap-6">
              <span className="text-5xl font-bold text-yellow-400 tracking-tight">${stock.price.toFixed(2)}</span>
              <div className={`flex items-center gap-1 mb-2 font-bold text-sm ${isUp ? 'text-yellow-400' : 'text-red-500'}`}>
                {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(stock.changePercent).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="h-96 w-full bg-zinc-950 border border-zinc-900 rounded-lg p-6">
             <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stock.history}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? "#facc15" : "#ef4444"} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={isUp ? "#facc15" : "#ef4444"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#111" />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px', fontFamily: 'JetBrains Mono' }}
                  itemStyle={{ color: isUp ? '#facc15' : '#ef4444' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke={isUp ? "#facc15" : "#ef4444"} 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* News Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Newspaper className="w-4 h-4 text-yellow-400" />
              <h2 className="text-[10px] font-bold text-white uppercase tracking-widest">Latest Headlines</h2>
            </div>
            
            {isNewsLoading ? (
              <div className="flex items-center gap-3 py-10">
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Scanning market news...</p>
              </div>
            ) : news.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {news.map((item, i) => (
                  <a 
                    key={i} 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg hover:border-yellow-400/50 transition-all group"
                  >
                    <p className="text-[10px] text-yellow-400 font-bold uppercase mb-2 group-hover:underline">{item.title}</p>
                    <p className="text-[9px] text-zinc-500 leading-relaxed mb-4">{item.source}</p>
                    <div className="flex items-center gap-2 text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                      <ExternalLink className="w-2 h-2" />
                      Read Article
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest italic">No recent headlines found for this symbol.</p>
            )}
          </div>
        </div>

        <div className="w-full lg:w-96">
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-lg sticky top-24">
            <div className="flex gap-1 mb-8">
               <button 
                 onClick={() => setTradeType('BUY')} 
                 className={`flex-1 py-3 font-bold text-xs uppercase tracking-widest transition-all rounded-sm border ${tradeType === 'BUY' ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-black border-zinc-800 text-zinc-600'}`}
               >
                 Buy
               </button>
               <button 
                 onClick={() => setTradeType('SELL')} 
                 className={`flex-1 py-3 font-bold text-xs uppercase tracking-widest transition-all rounded-sm border ${tradeType === 'SELL' ? 'bg-zinc-100 border-white text-black' : 'bg-black border-zinc-800 text-zinc-600'}`}
               >
                 Sell
               </button>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-4 tracking-widest">Number of Shares</label>
                <div className="flex items-center gap-6 border-b border-zinc-800 pb-2">
                  <button onClick={() => setShares(s => Math.max(1, s - 1))} className="text-zinc-500 hover:text-white font-bold text-2xl">-</button>
                  <input 
                    type="number" 
                    value={shares} 
                    onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 0))} 
                    className="flex-1 bg-transparent text-center text-3xl font-bold text-white focus:outline-none"
                  />
                  <button onClick={() => setShares(s => s + 1)} className="text-zinc-500 hover:text-white font-bold text-2xl">+</button>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex justify-between text-[10px] font-bold text-zinc-600 uppercase">
                  <span>Price per share</span>
                  <span className="text-zinc-300">${stock.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-white">Estimated Total</span>
                  <span className="text-yellow-400">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <button 
                onClick={() => void handleTradeSubmit()}
                disabled={isSubmittingTrade || (tradeType === 'BUY' ? !canAfford : !canSell)} 
                className={`w-full py-5 font-bold text-sm uppercase tracking-widest transition-all rounded-md ${
                  tradeType === 'BUY' 
                    ? 'bg-yellow-400 hover:bg-yellow-300 text-black' 
                    : 'bg-white hover:bg-zinc-200 text-black'
                } disabled:bg-zinc-900 disabled:text-zinc-700 disabled:cursor-not-allowed`}
              >
                {isSubmittingTrade ? 'Processing...' : `Confirm ${tradeType === 'BUY' ? 'Purchase' : 'Sale'}`}
              </button>

              <div className="text-center">
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                  {tradeType === 'BUY' ? `Available Cash: $${user.cash.toLocaleString()}` : `Current Holding: ${holding?.shares || 0} Shares`}
                </p>
                {tradeError && (
                  <p className="mt-3 text-[10px] text-red-500 font-bold uppercase tracking-widest">
                    {tradeError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {tradeSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-zinc-950 border border-yellow-400 rounded-xl p-8 shadow-2xl animate-fade-in">
            <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-[0.3em] mb-3">
              Trade Confirmed
            </p>
            <h2 className="text-3xl font-bold text-white uppercase tracking-tight mb-4">
              {tradeSuccess.type === 'BUY' ? 'Purchase Complete' : 'Sale Complete'}
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Symbol</span>
                <span className="text-white font-bold">{stock.symbol}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Shares</span>
                <span className="text-white font-bold">{tradeSuccess.shares}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Estimated Fill</span>
                <span className="text-yellow-400 font-bold">
                  ${tradeSuccess.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="mt-6 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              Your portfolio and trade history were updated successfully.
            </p>
            <button
              onClick={() => setTradeSuccess(null)}
              className="mt-8 w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 rounded-md uppercase tracking-widest text-sm"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockDetail;
