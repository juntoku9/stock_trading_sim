
import React, { useState, useEffect } from 'react';
import { Stock, UserProfile, OrderType, PendingOrder } from '../types';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Zap, ExternalLink, Loader2, Newspaper, Clock, X, ChevronDown, Info } from 'lucide-react';
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
  onPlaceOrder: (symbol: string, side: 'BUY' | 'SELL', orderType: OrderType, shares: number, limitPrice?: number, stopPrice?: number) => Promise<void>;
  pendingOrders: PendingOrder[];
  onCancelOrder: (orderId: string) => void;
}

const ORDER_TYPES: { type: OrderType; label: string; desc: string }[] = [
  { type: 'MARKET',     label: 'Market',     desc: 'Execute immediately at the current market price.' },
  { type: 'LIMIT',      label: 'Limit',      desc: 'Execute only at your specified price or better.' },
  { type: 'STOP_LOSS',  label: 'Stop-Loss',  desc: 'Triggers a market order when the stop price is reached.' },
  { type: 'STOP_LIMIT', label: 'Stop-Limit', desc: 'Triggers a limit order when the stop price is reached.' },
];

const StockDetail: React.FC<StockDetailProps> = ({ stock, user, onBack, onTrade, onPlaceOrder, pendingOrders, onCancelOrder }) => {
  const [shares, setShares] = useState(1);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [isSubmittingTrade, setIsSubmittingTrade] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState<{ type: 'BUY' | 'SELL'; orderType: OrderType; shares: number; total: number } | null>(null);

  const holding = user.holdings.find(h => h.symbol === stock.symbol);
  const totalCost = shares * stock.price;
  const canAfford = user.cash >= totalCost;
  const canSell = (holding?.shares || 0) >= shares;
  const isUp = stock.change >= 0;

  // Pre-fill limit/stop prices when switching order types
  useEffect(() => {
    setLimitPrice(stock.price.toFixed(2));
    setStopPrice(stock.price.toFixed(2));
  }, [orderType, stock.symbol]);

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
      const lp = parseFloat(limitPrice);
      const sp = parseFloat(stopPrice);

      if (orderType === 'LIMIT' && (isNaN(lp) || lp <= 0)) throw new Error('Enter a valid limit price.');
      if (orderType === 'STOP_LOSS' && (isNaN(sp) || sp <= 0)) throw new Error('Enter a valid stop price.');
      if (orderType === 'STOP_LIMIT' && (isNaN(sp) || sp <= 0 || isNaN(lp) || lp <= 0)) throw new Error('Enter valid stop and limit prices.');

      await onPlaceOrder(stock.symbol, tradeType, orderType, shares,
        (orderType === 'LIMIT' || orderType === 'STOP_LIMIT') ? lp : undefined,
        (orderType === 'STOP_LOSS' || orderType === 'STOP_LIMIT') ? sp : undefined,
      );
      setTradeSuccess({ type: tradeType, orderType, shares, total: totalCost });
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Order failed.');
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

        <div className="w-full lg:w-96 space-y-4">
          {/* Trade Panel */}
          <div className="bg-[#16161e] border border-white/[0.06] p-6 rounded-2xl sticky top-24">
            {/* Buy / Sell Toggle */}
            <div className="flex gap-1 mb-5">
              <button onClick={() => setTradeType('BUY')}
                className={`flex-1 py-2.5 font-semibold text-sm transition-all rounded-lg border ${tradeType === 'BUY' ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-transparent border-white/[0.06] text-[#8b8b9e]'}`}>
                Buy
              </button>
              <button onClick={() => setTradeType('SELL')}
                className={`flex-1 py-2.5 font-semibold text-sm transition-all rounded-lg border ${tradeType === 'SELL' ? 'bg-red-500 border-red-500 text-white' : 'bg-transparent border-white/[0.06] text-[#8b8b9e]'}`}>
                Sell
              </button>
            </div>

            {/* Order Type Selector */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-[#8b8b9e] mb-2">Order Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {ORDER_TYPES.map(ot => (
                  <button key={ot.type} onClick={() => setOrderType(ot.type)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border text-left ${orderType === ot.type ? 'bg-violet-500/20 border-violet-500/50 text-violet-300' : 'bg-transparent border-white/[0.06] text-[#8b8b9e] hover:border-white/[0.15]'}`}>
                    {ot.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#8b8b9e] mt-2 leading-relaxed">
                {ORDER_TYPES.find(o => o.type === orderType)?.desc}
              </p>
            </div>

            <div className="space-y-4">
              {/* Shares */}
              <div>
                <label className="block text-xs font-medium text-[#8b8b9e] mb-2">Shares</label>
                <div className="flex items-center gap-3 bg-[#0d0d12] border border-white/[0.06] rounded-xl px-4 py-2">
                  <button onClick={() => setShares(s => Math.max(1, s - 1))} className="text-[#8b8b9e] hover:text-white w-8 h-8 flex items-center justify-center text-xl font-bold">−</button>
                  <input type="number" value={shares} onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 bg-transparent text-center text-2xl font-bold text-white focus:outline-none" />
                  <button onClick={() => setShares(s => s + 1)} className="text-[#8b8b9e] hover:text-white w-8 h-8 flex items-center justify-center text-xl font-bold">+</button>
                </div>
              </div>

              {/* Stop Price */}
              {(orderType === 'STOP_LOSS' || orderType === 'STOP_LIMIT') && (
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-2">
                    Stop Price
                    <span className="ml-2 text-[10px] text-amber-400">
                      {tradeType === 'BUY' ? `triggers when price rises to` : `triggers when price falls to`}
                    </span>
                  </label>
                  <div className="flex items-center bg-[#0d0d12] border border-amber-500/30 rounded-xl px-4 py-3 gap-2">
                    <span className="text-[#8b8b9e] text-sm">$</span>
                    <input type="number" step="0.01" value={stopPrice}
                      onChange={e => setStopPrice(e.target.value)}
                      className="flex-1 bg-transparent text-white font-semibold text-sm focus:outline-none" />
                  </div>
                </div>
              )}

              {/* Limit Price */}
              {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-2">
                    Limit Price
                    <span className="ml-2 text-[10px] text-violet-400">
                      {tradeType === 'BUY' ? `buy at or below` : `sell at or above`}
                    </span>
                  </label>
                  <div className="flex items-center bg-[#0d0d12] border border-violet-500/30 rounded-xl px-4 py-3 gap-2">
                    <span className="text-[#8b8b9e] text-sm">$</span>
                    <input type="number" step="0.01" value={limitPrice}
                      onChange={e => setLimitPrice(e.target.value)}
                      className="flex-1 bg-transparent text-white font-semibold text-sm focus:outline-none" />
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-[#0d0d12] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#8b8b9e]">
                  <span>Market Price</span>
                  <span className="text-white font-medium">${stock.price.toFixed(2)}</span>
                </div>
                {orderType === 'MARKET' && (
                  <div className="flex justify-between font-bold">
                    <span className="text-white">Est. Total</span>
                    <span className="text-violet-400">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#8b8b9e]">
                  <span>{tradeType === 'BUY' ? 'Available Cash' : 'Shares Held'}</span>
                  <span className="text-white">{tradeType === 'BUY' ? `$${user.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `${holding?.shares || 0}`}</span>
                </div>
              </div>

              {tradeError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{tradeError}</p>
              )}

              <button onClick={() => void handleTradeSubmit()}
                disabled={isSubmittingTrade || (orderType === 'MARKET' && (tradeType === 'BUY' ? !canAfford : !canSell))}
                className={`w-full py-3.5 font-semibold text-sm transition-all rounded-xl ${
                  tradeType === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-red-500 hover:bg-red-400 text-white'
                } disabled:bg-[#2a2a3c] disabled:text-[#4a4a5c] disabled:cursor-not-allowed`}>
                {isSubmittingTrade ? 'Processing...' : orderType === 'MARKET'
                  ? `Place Market ${tradeType === 'BUY' ? 'Buy' : 'Sell'}`
                  : `Place ${ORDER_TYPES.find(o => o.type === orderType)?.label} Order`
                }
              </button>
            </div>
          </div>

          {/* Pending Orders for this stock */}
          {pendingOrders.length > 0 && (
            <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Pending Orders</h3>
                <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
              </div>
              <div className="space-y-2">
                {pendingOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between bg-[#0d0d12] border border-white/[0.04] rounded-xl px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{order.side}</span>
                        <span className="text-xs font-semibold text-violet-300">{ORDER_TYPES.find(o => o.type === order.orderType)?.label}</span>
                        {order.stopTriggered && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Stop Hit</span>}
                      </div>
                      <p className="text-xs text-[#8b8b9e]">
                        {order.shares} shares
                        {order.stopPrice && <span> · Stop ${order.stopPrice.toFixed(2)}</span>}
                        {order.limitPrice && <span> · Limit ${order.limitPrice.toFixed(2)}</span>}
                      </p>
                    </div>
                    <button onClick={() => onCancelOrder(order.id)}
                      className="text-[#4a4a5c] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {tradeSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-[#16161e] border border-violet-500/30 rounded-2xl p-8 shadow-2xl animate-fade-in">
            <p className="text-sm font-semibold text-violet-400 mb-2">
              {tradeSuccess.orderType === 'MARKET' ? 'Order Filled' : 'Order Placed'}
            </p>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-6">
              {tradeSuccess.orderType === 'MARKET'
                ? (tradeSuccess.type === 'BUY' ? 'Purchase Complete' : 'Sale Complete')
                : `${ORDER_TYPES.find(o => o.type === tradeSuccess.orderType)?.label} Order Active`
              }
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#8b8b9e]"><span>Symbol</span><span className="text-white font-semibold">{stock.symbol}</span></div>
              <div className="flex justify-between text-[#8b8b9e]"><span>Side</span><span className={`font-semibold ${tradeSuccess.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{tradeSuccess.type}</span></div>
              <div className="flex justify-between text-[#8b8b9e]"><span>Order Type</span><span className="text-violet-300 font-semibold">{ORDER_TYPES.find(o => o.type === tradeSuccess.orderType)?.label}</span></div>
              <div className="flex justify-between text-[#8b8b9e]"><span>Shares</span><span className="text-white font-semibold">{tradeSuccess.shares}</span></div>
              {tradeSuccess.orderType === 'MARKET' && (
                <div className="flex justify-between text-[#8b8b9e]"><span>Total</span><span className="text-violet-400 font-semibold">${tradeSuccess.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              )}
            </div>
            <p className="mt-6 text-xs text-[#8b8b9e]">
              {tradeSuccess.orderType === 'MARKET'
                ? 'Your portfolio has been updated.'
                : 'Your order is queued and will execute automatically when conditions are met.'}
            </p>
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
