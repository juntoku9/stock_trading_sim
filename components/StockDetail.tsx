
import React, { useState, useEffect } from 'react';
import { Stock, UserProfile, OrderType, PendingOrder } from '../types';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Zap, ExternalLink, Loader2, Newspaper, Clock, X, ChevronDown, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

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

interface OrderOption {
  type: OrderType;
  label: string;
  sublabel: string;
  tldr: string;
  example: string;
  pro: string;
  con: string;
}

const BUY_ORDERS: OrderOption[] = [
  {
    type: 'MARKET',
    label: 'Buy Now',
    sublabel: 'Market Order',
    tldr: 'Buy immediately at the current price. What you see is (roughly) what you pay.',
    example: 'AAPL is $210. Click buy — you get filled instantly at ~$210.',
    pro: 'Instant. Always fills.',
    con: 'Price can slip a few cents in fast markets.',
  },
  {
    type: 'LIMIT',
    label: 'Buy at Lower Price',
    sublabel: 'Limit Order',
    tldr: 'Set the max price you\'re willing to pay. Your order only fills if the stock drops to that price.',
    example: 'AAPL is $210 but you only want to pay $200. Set a limit at $200 — it waits until the price drops there.',
    pro: 'You control your entry price exactly.',
    con: 'May never fill if the price doesn\'t drop.',
  },
];

const SELL_ORDERS: OrderOption[] = [
  {
    type: 'MARKET',
    label: 'Sell Now',
    sublabel: 'Market Order',
    tldr: 'Sell immediately at the current price. Fast and simple.',
    example: 'You own AAPL at $210. Click sell — you get out instantly at ~$210.',
    pro: 'Instant. Always fills.',
    con: 'Price can slip a few cents in fast markets.',
  },
  {
    type: 'LIMIT',
    label: 'Take Profit',
    sublabel: 'Limit Sell',
    tldr: 'Set a target price to sell at. Your order sits waiting until the stock rises to your goal.',
    example: 'You bought AAPL at $200. Set a take-profit at $230 — it automatically sells when the price hits $230.',
    pro: 'Locks in your profit target automatically.',
    con: 'If price never reaches your target, it won\'t sell.',
  },
  {
    type: 'STOP_LOSS',
    label: 'Stop Loss',
    sublabel: 'Stop Order',
    tldr: 'Set a floor price. If the stock drops to that level, it auto-sells to stop further losses.',
    example: 'You bought AAPL at $200. Set a stop-loss at $185 — if it crashes to $185, it sells automatically before it gets worse.',
    pro: 'Protects you from big losses while you\'re not watching.',
    con: 'Can trigger on a brief dip then recover — you\'d have sold for nothing.',
  },
];

const StockDetail: React.FC<StockDetailProps> = ({ stock, user, onBack, onTrade, onPlaceOrder, pendingOrders, onCancelOrder }) => {
  const [sharesRaw, setSharesRaw] = useState<string>('1');
  const shares = Math.max(0, parseInt(sharesRaw) || 0);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [isSubmittingTrade, setIsSubmittingTrade] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState<{ type: 'BUY' | 'SELL'; orderType: OrderType; shares: number; total: number } | null>(null);
  const [openInfo, setOpenInfo] = useState<OrderType | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1D');
  const [historicalData, setHistoricalData] = useState<{ time: string; price: number }[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(false);

  const holding = user.holdings.find(h => h.symbol === stock.symbol);
  const totalCost = shares * stock.price;
  const canAfford = user.cash >= totalCost;
  const canSell = (holding?.shares || 0) >= shares;
  const isUp = stock.change >= 0;

  // Reset order type to MARKET when switching sides, pre-fill prices
  useEffect(() => {
    setOrderType('MARKET');
    setOpenInfo(null);
  }, [tradeType]);

  useEffect(() => {
    setLimitPrice(stock.price.toFixed(2));
    setStopPrice(stock.price.toFixed(2));
  }, [orderType, stock.symbol]);

  useEffect(() => {
    const fetchNews = async () => {
      setIsNewsLoading(true);
      try {
        const res = await fetch(
          `/api/stock-news?symbol=${encodeURIComponent(stock.symbol)}&name=${encodeURIComponent(stock.name)}`
        );
        const data = await res.json();
        if (data.news?.length) setNews(data.news);
      } catch (error) {
        console.error("News fetch error:", error);
      } finally {
        setIsNewsLoading(false);
      }
    };
    fetchNews();
  }, [stock.symbol]);

  useEffect(() => {
    if (chartPeriod === '1D') {
      setHistoricalData([]);
      return;
    }
    const fetchHistory = async () => {
      setIsChartLoading(true);
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(stock.symbol)}&period=${chartPeriod}&_t=${Date.now()}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (data.points?.length) setHistoricalData(data.points);
      } catch (err) {
        console.error('History fetch error:', err);
      } finally {
        setIsChartLoading(false);
      }
    };
    void fetchHistory();
  }, [chartPeriod, stock.symbol]);

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
                {isUp ? '+' : ''}{stock.change.toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%) today
              </div>
            </div>
          </div>

          <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-[#8b8b9e]">
                {chartPeriod === '1D' ? 'Live (today\'s ticks)' : `Past ${chartPeriod}`}
              </span>
              <div className="flex gap-1">
                {(['1D', '1W', '1M', '3M', '1Y'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                      chartPeriod === p
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                        : 'text-[#8b8b9e] hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72 w-full">
              {isChartLoading ? (
                <div className="flex items-center justify-center h-full gap-3">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span className="text-sm text-[#8b8b9e]">Loading chart…</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartPeriod === '1D' ? stock.history : historicalData}>
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
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                    />
                    <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
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
              <div className="space-y-2">
                {(tradeType === 'BUY' ? BUY_ORDERS : SELL_ORDERS).map(ot => {
                  const isSelected = orderType === ot.type;
                  const isOpen = openInfo === ot.type;
                  return (
                    <div key={`${tradeType}-${ot.type}`}>
                      <button
                        onClick={() => { setOrderType(ot.type); setOpenInfo(null); }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                          isSelected
                            ? tradeType === 'BUY'
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-red-500/10 border-red-500/30'
                            : 'bg-transparent border-white/[0.06] hover:border-white/[0.12]'
                        }`}>
                        <div>
                          <p className={`text-sm font-semibold ${isSelected ? (tradeType === 'BUY' ? 'text-emerald-300' : 'text-red-300') : 'text-white'}`}>
                            {ot.label}
                          </p>
                          <p className="text-[11px] text-[#8b8b9e] mt-0.5">{ot.sublabel}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenInfo(isOpen ? null : ot.type); }}
                          className={`ml-3 flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                            isOpen ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'border-white/[0.08] text-[#4a4a5c] hover:text-[#8b8b9e]'
                          }`}>
                          What's this?
                          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </button>

                      {/* TLDR Dropdown */}
                      {isOpen && (
                        <div className="mx-1 bg-[#0d0d12] border border-violet-500/20 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-white leading-relaxed">{ot.tldr}</p>
                          <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">Example</p>
                            <p className="text-[11px] text-[#c0c0d0] leading-relaxed">{ot.example}</p>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-emerald-400 font-bold mb-0.5">✓ Pro</p>
                              <p className="text-[10px] text-[#c0c0d0] leading-relaxed">{ot.pro}</p>
                            </div>
                            <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-red-400 font-bold mb-0.5">✗ Con</p>
                              <p className="text-[10px] text-[#c0c0d0] leading-relaxed">{ot.con}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              {/* Shares */}
              <div>
                <label className="block text-xs font-medium text-[#8b8b9e] mb-2">Shares</label>
                <div className="flex items-center gap-3 bg-[#0d0d12] border border-white/[0.06] rounded-xl px-4 py-2">
                  <button onClick={() => setSharesRaw(s => String(Math.max(1, (parseInt(s) || 1) - 1)))} className="text-[#8b8b9e] hover:text-white w-8 h-8 flex items-center justify-center text-xl font-bold">−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={sharesRaw}
                    onChange={e => setSharesRaw(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => { if (!sharesRaw || parseInt(sharesRaw) < 1) setSharesRaw('1'); }}
                    className="flex-1 bg-transparent text-center text-2xl font-bold text-white focus:outline-none"
                  />
                  <button onClick={() => setSharesRaw(s => String((parseInt(s) || 0) + 1))} className="text-[#8b8b9e] hover:text-white w-8 h-8 flex items-center justify-center text-xl font-bold">+</button>
                </div>
              </div>

              {/* Stop Price — shown for Stop Loss */}
              {orderType === 'STOP_LOSS' && (
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1">
                    Auto-sell if price drops to
                  </label>
                  <p className="text-[10px] text-[#4a4a5c] mb-2">Current price: ${stock.price.toFixed(2)} — set this below current price</p>
                  <div className="flex items-center bg-[#0d0d12] border border-amber-500/30 rounded-xl px-4 py-3 gap-2">
                    <span className="text-amber-400 font-bold text-sm">$</span>
                    <input type="number" step="0.01" value={stopPrice}
                      onChange={e => setStopPrice(e.target.value)}
                      className="flex-1 bg-transparent text-white font-semibold text-lg focus:outline-none" />
                  </div>
                </div>
              )}

              {/* Limit Price — shown for Limit/Take Profit */}
              {orderType === 'LIMIT' && (
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1">
                    {tradeType === 'BUY' ? 'Buy only if price drops to' : 'Sell when price reaches'}
                  </label>
                  <p className="text-[10px] text-[#4a4a5c] mb-2">
                    Current price: ${stock.price.toFixed(2)} — set this {tradeType === 'BUY' ? 'below' : 'above'} current price
                  </p>
                  <div className="flex items-center bg-[#0d0d12] border border-violet-500/30 rounded-xl px-4 py-3 gap-2">
                    <span className="text-violet-400 font-bold text-sm">$</span>
                    <input type="number" step="0.01" value={limitPrice}
                      onChange={e => setLimitPrice(e.target.value)}
                      className="flex-1 bg-transparent text-white font-semibold text-lg focus:outline-none" />
                  </div>
                </div>
              )}

              {/* Your Position (if holding) */}
              {holding && (
                (() => {
                  const avgCost = holding.averageCost;
                  const heldShares = holding.shares;
                  const totalInvested = avgCost * heldShares;
                  const currentValue = stock.price * heldShares;
                  const unrealisedPnL = currentValue - totalInvested;
                  const unrealisedPct = (unrealisedPnL / totalInvested) * 100;
                  const sellProceeds = shares * stock.price;
                  const sellCost = shares * avgCost;
                  const sellPnL = sellProceeds - sellCost;
                  const isGain = unrealisedPnL >= 0;
                  return (
                    <div className="bg-[#0d0d12] border border-white/[0.06] rounded-xl p-4 space-y-3 text-sm">
                      <p className="text-[10px] font-semibold text-[#8b8b9e] uppercase tracking-wider">Your Position</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[#8b8b9e]">
                          <span>Shares held</span>
                          <span className="text-white font-medium">{heldShares}</span>
                        </div>
                        <div className="flex justify-between text-[#8b8b9e]">
                          <span>Avg. buy price</span>
                          <span className="text-white font-medium">${avgCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#8b8b9e]">
                          <span>Total invested</span>
                          <span className="text-white font-medium">${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[#8b8b9e]">
                          <span>Current value</span>
                          <span className="text-white font-medium">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t border-white/[0.06] pt-2">
                          <span className="text-[#8b8b9e]">Unrealised P&L</span>
                          <span className={isGain ? 'text-emerald-400' : 'text-red-400'}>
                            {isGain ? '+' : ''}${unrealisedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({isGain ? '+' : ''}{unrealisedPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                      {tradeType === 'SELL' && shares > 0 && shares <= heldShares && (
                        <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
                          <p className="text-[10px] font-semibold text-[#8b8b9e] uppercase tracking-wider">If you sell {shares} share{shares !== 1 ? 's' : ''}</p>
                          <div className="flex justify-between text-[#8b8b9e]">
                            <span>Proceeds</span>
                            <span className="text-white font-medium">${sellProceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-[#8b8b9e]">Realised P&L</span>
                            <span className={sellPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {sellPnL >= 0 ? '+' : ''}${sellPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Summary */}
              <div className="bg-[#0d0d12] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#8b8b9e]">
                  <span>Market Price</span>
                  <span className="text-white font-medium">${stock.price.toFixed(2)}</span>
                </div>
                {orderType === 'MARKET' && (
                  <div className="flex justify-between font-bold">
                    <span className="text-white">{tradeType === 'BUY' ? 'Est. Cost' : 'Est. Proceeds'}</span>
                    <span className="text-violet-400">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#8b8b9e]">
                  <span>Available Cash</span>
                  <span className="text-white">${user.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                {isSubmittingTrade ? 'Processing...' : (() => {
                  if (orderType === 'MARKET') return tradeType === 'BUY' ? 'Buy Now' : 'Sell Now';
                  const opts = tradeType === 'BUY' ? BUY_ORDERS : SELL_ORDERS;
                  return `Place ${opts.find(o => o.type === orderType)?.label} Order`;
                })()}
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
                        <span className="text-xs font-semibold text-violet-300">{(order.side === 'BUY' ? BUY_ORDERS : SELL_ORDERS).find(o => o.type === order.orderType)?.label ?? order.orderType}</span>
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
                : `${(tradeSuccess.type === 'BUY' ? BUY_ORDERS : SELL_ORDERS).find(o => o.type === tradeSuccess.orderType)?.label ?? tradeSuccess.orderType} Order Active`
              }
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#8b8b9e]"><span>Symbol</span><span className="text-white font-semibold">{stock.symbol}</span></div>
              <div className="flex justify-between text-[#8b8b9e]"><span>Side</span><span className={`font-semibold ${tradeSuccess.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{tradeSuccess.type}</span></div>
              <div className="flex justify-between text-[#8b8b9e]"><span>Order Type</span><span className="text-violet-300 font-semibold">{(tradeSuccess.type === 'BUY' ? BUY_ORDERS : SELL_ORDERS).find(o => o.type === tradeSuccess.orderType)?.label ?? tradeSuccess.orderType}</span></div>
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
