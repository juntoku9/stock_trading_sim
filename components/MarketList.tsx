
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
      if (!apiKey) {
        return;
      }

      setIsLoadingNews(true);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: "Summarize the top 5 global stock market news headlines from the last 24 hours.",
          config: {
            tools: [{ googleSearch: {} }],
          },
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
    <div className="animate-fade-in font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Market Explorer</h1>
          <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Live stock quotes when available</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search symbols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-900 rounded-sm py-3 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-yellow-400 transition-all placeholder:text-zinc-800"
          />
        </div>
      </div>

      {/* Global Pulse Section */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Newspaper className="w-4 h-4 text-yellow-400" />
          <h2 className="text-[10px] font-bold text-white uppercase tracking-widest">Market Pulse</h2>
        </div>
        
        {isLoadingNews ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Gathering global headlines...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {globalNews.map((news, i) => (
              <a 
                key={i} 
                href={news.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-black border border-zinc-900 px-4 py-2 rounded-md hover:border-yellow-400 transition-all group"
              >
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                <span className="text-[10px] text-zinc-300 font-bold uppercase group-hover:text-yellow-400 transition-colors">
                  {news.title.length > 40 ? news.title.substring(0, 40) + '...' : news.title}
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-zinc-700 group-hover:text-yellow-400" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-900">
                <th className="px-6 py-5 text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Symbol</th>
                <th className="px-6 py-5 text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Sector</th>
                <th className="px-6 py-5 text-[10px] font-bold text-yellow-400 uppercase tracking-widest text-right">Price</th>
                <th className="px-6 py-5 text-[10px] font-bold text-yellow-400 uppercase tracking-widest text-right">Change (24h)</th>
                <th className="px-6 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {filteredStocks.map(stock => (
                <tr 
                  key={stock.symbol} 
                  onClick={() => onSelectStock(stock)}
                  className="group hover:bg-black cursor-pointer transition-colors"
                >
                  <td className="px-6 py-5">
                    <div>
                      <p className="font-bold text-white group-hover:text-yellow-400 transition-colors uppercase leading-none mb-1">{stock.symbol}</p>
                      <p className="text-[9px] text-zinc-600 truncate w-32">{stock.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-bold px-2 py-0.5 border border-zinc-800 text-zinc-500 rounded-sm">{stock.sector}</span>
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-white text-sm">
                    ${stock.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className={`font-bold text-xs ${stock.change >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredStocks.length === 0 && (
          <div className="p-16 text-center border-t border-zinc-900">
            <Activity className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">No matching stocks found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketList;
