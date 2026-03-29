
import React, { useState, useEffect } from 'react';
import { Stock } from '../types';
import { Search, ChevronRight, Activity, Newspaper, Loader2, ExternalLink } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface GlobalNews {
  title: string;
  url: string;
}

interface MarketListProps {
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
}

const MarketList: React.FC<MarketListProps> = ({ stocks, onSelectStock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [globalNews, setGlobalNews] = useState<GlobalNews[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  useEffect(() => {
    const fetchGlobalNews = async () => {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return;

      setIsLoadingNews(true);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: "Summarize the top 5 global stock market news headlines from the last 24 hours.",
          config: { tools: [{ googleSearch: {} }] },
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const extracted = groundingChunks.slice(0, 5).map((chunk: any) => ({
          title: chunk.web?.title || 'Market Update',
          url: chunk.web?.uri || '#'
        }));
        setGlobalNews(extracted);
      } catch (err) {
        console.error("Global news fetch error:", err);
      } finally {
        setIsLoadingNews(false);
      }
    };
    fetchGlobalNews();
  }, []);

  const filteredStocks = stocks.filter(s =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Market Explorer</h1>
          <p className="text-sm text-[#8b8b9e]">Live stock quotes when available</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4a5c] w-4 h-4" />
          <input
            type="text"
            placeholder="Search symbols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#16161e] border border-white/[0.06] rounded-full py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-[#4a4a5c]"
          />
        </div>
      </div>

      <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl p-6 mb-10">
        <div className="flex items-center gap-3 mb-5">
          <Newspaper className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Market Pulse</h2>
        </div>
        {isLoadingNews ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
            <p className="text-sm text-[#8b8b9e]">Gathering global headlines...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {globalNews.map((news, i) => (
              <a key={i} href={news.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-[#0d0d12] border border-white/[0.06] px-4 py-2.5 rounded-full hover:border-violet-500/40 transition-all group">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse flex-shrink-0" />
                <span className="text-xs text-[#e8e8ed] font-medium group-hover:text-violet-300 transition-colors">
                  {news.title.length > 40 ? news.title.substring(0, 40) + '...' : news.title}
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-[#4a4a5c] group-hover:text-violet-400" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e]">Symbol</th>
                <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e]">Sector</th>
                <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e] text-right">Price</th>
                <th className="px-6 py-4 text-xs font-medium text-[#8b8b9e] text-right">Change (24h)</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredStocks.map(stock => (
                <tr key={stock.symbol} onClick={() => onSelectStock(stock)}
                  className="group hover:bg-white/[0.02] cursor-pointer transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white group-hover:text-violet-300 transition-colors leading-none mb-1">{stock.symbol}</p>
                    <p className="text-xs text-[#8b8b9e] truncate w-32">{stock.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium px-2.5 py-1 border border-white/[0.06] text-[#8b8b9e] rounded-full bg-white/[0.03]">{stock.sector}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-white text-sm">${stock.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <p className={`font-semibold text-xs ${stock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-4 h-4 text-[#4a4a5c] group-hover:text-violet-400 group-hover:translate-x-1 transition-all inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredStocks.length === 0 && (
          <div className="p-16 text-center border-t border-white/[0.06]">
            <Activity className="w-10 h-10 text-[#4a4a5c] mx-auto mb-4" />
            <p className="text-[#8b8b9e] text-sm">No matching stocks found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketList;
