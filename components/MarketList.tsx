
import React, { useState, useEffect } from 'react';
import { Stock } from '../types';
import { Search, ChevronRight, Activity, Newspaper, Loader2, ExternalLink } from 'lucide-react';

interface GlobalNews {
  title: string;
  url: string;
}

interface SearchResult {
  symbol: string;
  name: string;
  sector: string;
}

interface MarketListProps {
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  onAddStock: (symbol: string, name: string, sector: string) => void;
}

const MarketList: React.FC<MarketListProps> = ({ stocks, onSelectStock, onAddStock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [globalNews, setGlobalNews] = useState<GlobalNews[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchGlobalNews = async () => {
      setIsLoadingNews(true);
      try {
        const res = await fetch('/api/market-news');
        const data = await res.json();
        if (data.news?.length) setGlobalNews(data.news);
      } catch (err) {
        console.error("Global news fetch error:", err);
      } finally {
        setIsLoadingNews(false);
      }
    };
    fetchGlobalNews();
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm.trim())}`);
        const data = await res.json();
        setSearchResults(data.quotes ?? []);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 400);
  }, [searchTerm]);

  const filteredStocks = stocks.filter(s =>
    !searchTerm.trim() ||
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddStock = async (result: SearchResult) => {
    setAddingSymbol(result.symbol);
    await onAddStock(result.symbol, result.name, result.sector);
    setAddingSymbol(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleViewStock = (symbol: string) => {
    const stock = stocks.find(s => s.symbol === symbol);
    if (stock) { onSelectStock(stock); setSearchTerm(''); setSearchResults([]); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">Market Explorer</h1>
          <p className="text-sm text-[#a1a1aa]">Live stock quotes when available</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#52525b] w-4 h-4" />
          <input
            type="text"
            placeholder="Search any stock..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#161616] border border-white/[0.06] rounded-lg py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-green-500/50 transition-all placeholder:text-[#52525b]"
          />
          {(isSearching || searchResults.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#161616] border border-white/[0.08] rounded-xl z-50 overflow-hidden shadow-2xl">
              {isSearching && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                  <span className="text-xs text-[#a1a1aa]">Searching...</span>
                </div>
              )}
              {!isSearching && searchResults.map((result) => {
                const alreadyAdded = stocks.some(s => s.symbol === result.symbol);
                return (
                  <div key={result.symbol} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] border-b border-white/[0.04] last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-white">{result.symbol}</p>
                      <p className="text-xs text-[#a1a1aa] truncate max-w-[160px]">{result.name}</p>
                    </div>
                    {alreadyAdded ? (
                      <button onClick={() => handleViewStock(result.symbol)}
                        className="text-xs font-medium px-3 py-1.5 border border-white/[0.1] text-[#a1a1aa] hover:bg-white/[0.05] transition-all rounded-md">
                        View
                      </button>
                    ) : (
                      <button onClick={() => handleAddStock(result)} disabled={addingSymbol === result.symbol}
                        className="text-xs font-medium px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all rounded-md disabled:opacity-50">
                        {addingSymbol === result.symbol ? 'Adding...' : '+ Add'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-6 mb-10">
        <div className="flex items-center gap-3 mb-5">
          <Newspaper className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-semibold text-white">Market Pulse</h2>
        </div>
        {isLoadingNews ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
            <p className="text-sm text-[#a1a1aa]">Gathering global headlines...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {globalNews.map((news, i) => (
              <a key={i} href={news.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 bg-[#0a0a0a] border border-white/[0.06] px-3.5 py-2 rounded-lg hover:border-green-500/40 transition-colors group">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                <span className="text-xs text-[#ededed] font-medium group-hover:text-green-300 transition-colors">
                  {news.title.length > 40 ? news.title.substring(0, 40) + '...' : news.title}
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-[#52525b] group-hover:text-green-400" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#161616] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa]">Symbol</th>
                <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa]">Sector</th>
                <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] text-right">Price</th>
                <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] text-right">Today's Change</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredStocks.map(stock => (
                <tr key={stock.symbol} onClick={() => onSelectStock(stock)}
                  className="group hover:bg-white/[0.02] cursor-pointer transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white group-hover:text-green-300 transition-colors leading-none mb-1">{stock.symbol}</p>
                    <p className="text-xs text-[#a1a1aa] truncate w-32">{stock.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium px-2.5 py-1 border border-white/[0.06] text-[#a1a1aa] rounded-full bg-white/[0.03]">{stock.sector}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-white text-sm">${stock.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <p className={`font-semibold text-xs ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-4 h-4 text-[#52525b] group-hover:text-green-400 group-hover:translate-x-1 transition-all inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredStocks.length === 0 && (
          <div className="p-16 text-center border-t border-white/[0.06]">
            <Activity className="w-10 h-10 text-[#52525b] mx-auto mb-4" />
            <p className="text-[#a1a1aa] text-sm">No matching stocks found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketList;
