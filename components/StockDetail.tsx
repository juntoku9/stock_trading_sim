
import React, { useState, useEffect } from 'react';
import { Stock, UserProfile, OrderType, PendingOrder, Trade } from '../types';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Zap, ExternalLink, Loader2, Newspaper, Clock, X, ChevronDown, AlertTriangle } from 'lucide-react';
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
  /** Resolves with the executed trade (server fill) so the UI can show the real price. */
  onTrade: (stock: Stock, shares: number, type: 'BUY' | 'SELL') => Promise<Trade | null>;
  onPlaceOrder: (symbol: string, side: 'BUY' | 'SELL', orderType: OrderType, shares: number, limitPrice?: number, stopPrice?: number) => Promise<Trade | null>;
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
  {
    type: 'STOP_LOSS',
    label: 'Buy on Breakout',
    sublabel: 'Stop Order',
    tldr: 'Set a trigger above the current price. If the stock breaks out to that level, it auto-buys to catch the momentum.',
    example: 'AAPL is $210. Set a buy stop at $220 — if it rallies through $220, you\'re bought in automatically.',
    pro: 'Catches upward momentum while you\'re away.',
    con: 'You pay more than today\'s price by design.',
  },
  {
    type: 'STOP_LIMIT',
    label: 'Breakout with Max Price',
    sublabel: 'Stop-Limit Order',
    tldr: 'Like a breakout buy, but with a ceiling: after the stop triggers, it only fills at or below your limit price.',
    example: 'Stop at $220, limit at $222 — buys on the breakout, but never pays more than $222.',
    pro: 'Momentum entry with a hard price cap.',
    con: 'A fast spike through your limit means no fill.',
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
  {
    type: 'STOP_LIMIT',
    label: 'Stop with Floor Price',
    sublabel: 'Stop-Limit Order',
    tldr: 'Like a stop-loss, but with a floor: after the stop triggers, it only sells at or above your limit price.',
    example: 'Stop at $185, limit at $183 — sells on the drop, but never for less than $183.',
    pro: 'No panic-selling below your acceptable price.',
    con: 'If the crash blows through your limit, you\'re still holding.',
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
  const [tradeSuccess, setTradeSuccess] = useState<{ type: 'BUY' | 'SELL'; orderType: OrderType; shares: number; total: number; fillPrice?: number } | null>(null);
  const [openInfo, setOpenInfo] = useState<OrderType | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1D');
  const [historicalData, setHistoricalData] = useState<{ time: string; price: number }[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(false);

  const holding = user.holdings.find(h => h.symbol === stock.symbol);
  const heldShares = holding?.shares ?? 0;
  const totalCost = shares * stock.price;
  const canAfford = user.cash >= totalCost;
  const canSell = heldShares >= shares;
  const isUp = stock.change >= 0;

  const needsLimitInput = orderType === 'LIMIT' || orderType === 'STOP_LIMIT';
  const needsStopInput = orderType === 'STOP_LOSS' || orderType === 'STOP_LIMIT';

  // Reset order type to MARKET when switching sides, pre-fill prices
  useEffect(() => {
    setOrderType('MARKET');
    setOpenInfo(null);
  }, [tradeType]);

  useEffect(() => {
    setLimitPrice(stock.price.toFixed(2));
    setStopPrice(stock.price.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [stock.symbol, stock.name]);

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

      // Client-side validation — the server re-validates everything, but
      // failing fast here gives instant feedback.
      if (shares < 1) throw new Error('Enter at least 1 share.');
      if (tradeType === 'SELL' && shares > heldShares) {
        throw new Error(`You only hold ${heldShares} share${heldShares === 1 ? '' : 's'}.`);
      }
      if (needsLimitInput && (isNaN(lp) || lp <= 0)) throw new Error('Enter a valid limit price.');
      if (needsStopInput && (isNaN(sp) || sp <= 0)) throw new Error('Enter a valid stop price.');

      const executed = await onPlaceOrder(stock.symbol, tradeType, orderType, shares,
        needsLimitInput ? lp : undefined,
        needsStopInput ? sp : undefined,
      );
      // Show the REAL fill (server-side quote), not the client's estimate.
      setTradeSuccess({
        type: tradeType,
        orderType,
        shares: executed?.shares ?? shares,
        total: executed ? executed.shares * executed.priceAtTrade : totalCost,
        fillPrice: executed?.priceAtTrade,
      });
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Order failed.');
    } finally {
      setIsSubmittingTrade(false);
    }
  };

  const chartColor = isUp ? "#4ADE80" : "#F87171";
  const showTickPlaceholder = chartPeriod === '1D' && stock.history.length < 2;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[#a1a1aa] hover:text-green-300 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to list
        </button>
        <div className="flex items-center gap-2 text-[#a1a1aa]">
          <Zap className="w-3 h-3" />
          <span className="text-xs font-medium">Real-time Pricing</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl font-semibold text-white tracking-tight">{stock.symbol}</h1>
              <span className="text-xs font-medium px-3 py-1 border border-white/[0.06] text-[#a1a1aa] rounded-full">{stock.sector}</span>
            </div>
            <p className="text-sm text-[#a1a1aa] mb-4">{stock.name}</p>
            <div className="flex items-end gap-4">
              <span className="text-4xl font-semibold text-white tracking-tight">${stock.price.toFixed(2)}</span>
              <div className={`flex items-center gap-1 mb-2 font-semibold text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {isUp ? '+' : ''}{stock.change.toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%) today
              </div>
            </div>
          </div>

          <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-[#a1a1aa]">
                {chartPeriod === '1D' ? 'Live (today\'s ticks)' : `Past ${chartPeriod}`}
              </span>
              <div className="flex gap-1">
                {(['1D', '1W', '1M', '3M', '1Y'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                      chartPeriod === p
                        ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                        : 'text-[#a1a1aa] hover:text-white'
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
                  <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                  <span className="text-sm text-[#a1a1aa]">Loading chart…</span>
                </div>
              ) : showTickPlaceholder ? (
                // No fabricated flat lines: be honest that live ticks are still accumulating.
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                  <span className="text-sm text-[#a1a1aa]">Collecting live ticks — the intraday chart builds as prices update.</span>
                  <span className="text-xs text-[#52525b]">Switch to 1W or 1M for historical prices.</span>
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
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontFamily: 'Inter' }}
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
              <Newspaper className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-semibold text-white">Latest Headlines</h2>
            </div>
            {isNewsLoading ? (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                <p className="text-sm text-[#a1a1aa]">Scanning market news...</p>
              </div>
            ) : news.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {news.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="bg-[#161616] border border-white/[0.06] p-4 rounded-xl hover:border-green-500/30 transition-all group">
                    <p className="text-xs text-green-300 font-semibold mb-2 group-hover:underline">{item.title}</p>
                    <p className="text-xs text-[#a1a1aa] leading-relaxed mb-3">{item.source}</p>
                    <div className="flex items-center gap-2 text-xs font-medium text-[#52525b]">
                      <ExternalLink className="w-3 h-3" /> Read Article
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#a1a1aa] italic">No recent headlines found for this symbol.</p>
            )}
          </div>
        </div>

        <div className="w-full lg:w-96 space-y-4">
          {/* Trade Panel */}
          <div className="bg-[#161616] border border-white/[0.06] p-6 rounded-xl sticky top-24">
            {/* Buy / Sell Toggle */}
            <div className="flex gap-1 mb-5">
              <button onClick={() => setTradeType('BUY')}
                className={`flex-1 py-2.5 font-semibold text-sm transition-all rounded-lg border ${tradeType === 'BUY' ? 'bg-green-500 border-green-500 text-black' : 'bg-transparent border-white/[0.06] text-[#a1a1aa]'}`}>
                Buy
              </button>
              <button onClick={() => setTradeType('SELL')}
                className={`flex-1 py-2.5 font-semibold text-sm transition-all rounded-lg border ${tradeType === 'SELL' ? 'bg-red-500 border-red-500 text-white' : 'bg-transparent border-white/[0.06] text-[#a1a1aa]'}`}>
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
                      {/* div+role instead of nested <button> — a button inside a
                          button is invalid HTML and broke hydration/clicks. */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => { setOrderType(ot.type); setOpenInfo(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOrderType(ot.type);
                            setOpenInfo(null);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left cursor-pointer ${
                          isSelected
                            ? tradeType === 'BUY'
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-red-500/10 border-red-500/30'
                            : 'bg-transparent border-white/[0.06] hover:border-white/[0.12]'
                        }`}>
                        <div>
                          <p className={`text-sm font-semibold ${isSelected ? (tradeType === 'BUY' ? 'text-green-300' : 'text-red-300') : 'text-white'}`}>
                            {ot.label}
                          </p>
                          <p className="text-[11px] text-[#a1a1aa] mt-0.5">{ot.sublabel}</p>
                        </div>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={`Explain ${ot.label}`}
                          onClick={(e) => { e.stopPropagation(); setOpenInfo(isOpen ? null : ot.type); }}
                          className={`ml-3 flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                            isOpen ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'border-white/[0.08] text-[#52525b] hover:text-[#a1a1aa]'
                          }`}>
                          What's this?
                          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* TLDR Dropdown */}
                      {isOpen && (
                        <div className="mx-1 bg-[#0a0a0a] border border-green-500/20 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-white leading-relaxed">{ot.tldr}</p>
                          <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1">Example</p>
                            <p className="text-[11px] text-[#d4d4d8] leading-relaxed">{ot.example}</p>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-green-400 font-bold mb-0.5">✓ Pro</p>
                              <p className="text-[10px] text-[#d4d4d8] leading-relaxed">{ot.pro}</p>
                            </div>
                            <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-red-400 font-bold mb-0.5">✗ Con</p>
                              <p className="text-[10px] text-[#d4d4d8] leading-relaxed">{ot.con}</p>
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
                <label className="block text-xs font-medium text-[#a1a1aa] mb-2">Shares</label>
                <div className="flex items-center gap-3 bg-[#0a0a0a] border border-white/[0.06] rounded-xl px-4 py-2">
                  <button onClick={() => setSharesRaw(s => String(Math.max(1, (parseInt(s) || 1) - 1)))} aria-label="Decrease shares" className="text-[#a1a1aa] hover:text-white w-8 h-8 flex items-center justify-center text-xl font-bold">−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Number of shares"
                    value={sharesRaw}
                    onChange={e => setSharesRaw(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => { if (!sharesRaw || parseInt(sharesRaw) < 1) setSharesRaw('1'); }}
                    className="flex-1 bg-transparent text-center text-2xl font-bold text-white focus:outline-none"
                  />
                  <button onClick={() => setSharesRaw(s => String((parseInt(s) || 0) + 1))} aria-label="Increase shares" className="text-[#a1a1aa] hover:text-white w-8 h-8 flex items-center justify-center text-xl font-bold">+</button>
                </div>
              </div>

              {/* Stop Price — Stop Loss & Stop-Limit */}
              {needsStopInput && (
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">
                    {tradeType === 'BUY' ? 'Trigger a buy if price rises to' : 'Auto-sell if price drops to'}
                  </label>
                  <p className="text-[10px] text-[#52525b] mb-2">
                    Current price: ${stock.price.toFixed(2)} — set this {tradeType === 'BUY' ? 'above' : 'below'} current price
                  </p>
                  <div className="flex items-center bg-[#0a0a0a] border border-amber-500/30 rounded-xl px-4 py-3 gap-2">
                    <span className="text-amber-400 font-bold text-sm">$</span>
                    <input type="number" step="0.01" value={stopPrice} aria-label="Stop price"
                      onChange={e => setStopPrice(e.target.value)}
                      className="flex-1 bg-transparent text-white font-semibold text-lg focus:outline-none" />
                  </div>
                </div>
              )}

              {/* Limit Price — Limit & Stop-Limit */}
              {needsLimitInput && (
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">
                    {orderType === 'STOP_LIMIT'
                      ? (tradeType === 'BUY' ? 'Maximum price you\'ll pay' : 'Minimum price you\'ll accept')
                      : (tradeType === 'BUY' ? 'Buy only if price drops to' : 'Sell when price reaches')}
                  </label>
                  <p className="text-[10px] text-[#52525b] mb-2">
                    Current price: ${stock.price.toFixed(2)}
                    {orderType === 'LIMIT' && ` — set this ${tradeType === 'BUY' ? 'below' : 'above'} current price`}
                  </p>
                  <div className="flex items-center bg-[#0a0a0a] border border-green-500/30 rounded-xl px-4 py-3 gap-2">
                    <span className="text-green-400 font-bold text-sm">$</span>
                    <input type="number" step="0.01" value={limitPrice} aria-label="Limit price"
                      onChange={e => setLimitPrice(e.target.value)}
                      className="flex-1 bg-transparent text-white font-semibold text-lg focus:outline-none" />
                  </div>
                </div>
              )}

              {/* Your Position (if holding) */}
              {holding && (
                (() => {
                  const avgCost = holding.averageCost;
                  const totalInvested = avgCost * heldShares;
                  const currentValue = stock.price * heldShares;
                  const unrealisedPnL = currentValue - totalInvested;
                  const unrealisedPct = totalInvested > 0 ? (unrealisedPnL / totalInvested) * 100 : 0;
                  const sellProceeds = shares * stock.price;
                  const sellCost = shares * avgCost;
                  const sellPnL = sellProceeds - sellCost;
                  const isGain = unrealisedPnL >= 0;
                  return (
                    <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl p-4 space-y-3 text-sm">
                      <p className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Your Position</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[#a1a1aa]">
                          <span>Shares held</span>
                          <span className="text-white font-medium">{heldShares}</span>
                        </div>
                        <div className="flex justify-between text-[#a1a1aa]">
                          <span>Avg. buy price</span>
                          <span className="text-white font-medium">${avgCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#a1a1aa]">
                          <span>Total invested</span>
                          <span className="text-white font-medium">${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[#a1a1aa]">
                          <span>Current value</span>
                          <span className="text-white font-medium">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t border-white/[0.06] pt-2">
                          <span className="text-[#a1a1aa]">Unrealised P&L</span>
                          <span className={isGain ? 'text-green-400' : 'text-red-400'}>
                            {isGain ? '+' : ''}${unrealisedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({isGain ? '+' : ''}{unrealisedPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                      {tradeType === 'SELL' && shares > 0 && shares <= heldShares && (
                        <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
                          <p className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wider">If you sell {shares} share{shares !== 1 ? 's' : ''}</p>
                          <div className="flex justify-between text-[#a1a1aa]">
                            <span>Proceeds</span>
                            <span className="text-white font-medium">${sellProceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-[#a1a1aa]">Realised P&L</span>
                            <span className={sellPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
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
              <div className="bg-[#0a0a0a] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#a1a1aa]">
                  <span>Market Price</span>
                  <span className="text-white font-medium">${stock.price.toFixed(2)}</span>
                </div>
                {orderType === 'MARKET' && (
                  <div className="flex justify-between font-bold">
                    <span className="text-white">{tradeType === 'BUY' ? 'Est. Cost' : 'Est. Proceeds'}</span>
                    <span className="text-green-400">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#a1a1aa]">
                  <span>Available Cash</span>
                  <span className="text-white">${user.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {tradeError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{tradeError}</p>
              )}

              <button onClick={() => void handleTradeSubmit()}
                disabled={isSubmittingTrade || shares < 1 || (orderType === 'MARKET' && (tradeType === 'BUY' ? !canAfford : !canSell))}
                className={`w-full py-3.5 font-semibold text-sm transition-all rounded-xl ${
                  tradeType === 'BUY' ? 'bg-green-500 hover:bg-green-400 text-black' : 'bg-red-500 hover:bg-red-400 text-white'
                } disabled:bg-[#27272a] disabled:text-[#52525b] disabled:cursor-not-allowed`}>
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
            <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Pending Orders</h3>
                <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
              </div>
              <div className="space-y-2">
                {pendingOrders.map(order => (
                  <div key={order.id} className="bg-[#0a0a0a] border border-white/[0.04] rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.side === 'BUY' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{order.side}</span>
                          <span className="text-xs font-semibold text-green-300">{(order.side === 'BUY' ? BUY_ORDERS : SELL_ORDERS).find(o => o.type === order.orderType)?.label ?? order.orderType}</span>
                          {order.stopTriggered && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Stop Hit</span>}
                        </div>
                        <p className="text-xs text-[#a1a1aa]">
                          {order.shares} shares
                          {order.stopPrice && <span> · Stop ${order.stopPrice.toFixed(2)}</span>}
                          {order.limitPrice && <span> · Limit ${order.limitPrice.toFixed(2)}</span>}
                        </p>
                      </div>
                      <button onClick={() => onCancelOrder(order.id)} aria-label={`Cancel ${order.side} order for ${order.shares} shares`}
                        className="text-[#52525b] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {order.lastError && (
                      <div className="mt-2 flex items-start gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>Last attempt failed: {order.lastError}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {tradeSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-[#161616] border border-green-500/30 rounded-xl p-8 shadow-2xl animate-fade-in">
            <p className="text-sm font-semibold text-green-400 mb-2">
              {tradeSuccess.orderType === 'MARKET' ? 'Order Filled' : 'Order Placed'}
            </p>
            <h2 className="text-2xl font-semibold text-white tracking-tight mb-6">
              {tradeSuccess.orderType === 'MARKET'
                ? (tradeSuccess.type === 'BUY' ? 'Purchase Complete' : 'Sale Complete')
                : `${(tradeSuccess.type === 'BUY' ? BUY_ORDERS : SELL_ORDERS).find(o => o.type === tradeSuccess.orderType)?.label ?? tradeSuccess.orderType} Order Active`
              }
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#a1a1aa]"><span>Symbol</span><span className="text-white font-semibold">{stock.symbol}</span></div>
              <div className="flex justify-between text-[#a1a1aa]"><span>Side</span><span className={`font-semibold ${tradeSuccess.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{tradeSuccess.type}</span></div>
              <div className="flex justify-between text-[#a1a1aa]"><span>Order Type</span><span className="text-green-300 font-semibold">{(tradeSuccess.type === 'BUY' ? BUY_ORDERS : SELL_ORDERS).find(o => o.type === tradeSuccess.orderType)?.label ?? tradeSuccess.orderType}</span></div>
              <div className="flex justify-between text-[#a1a1aa]"><span>Shares</span><span className="text-white font-semibold">{tradeSuccess.shares}</span></div>
              {tradeSuccess.orderType === 'MARKET' && tradeSuccess.fillPrice !== undefined && (
                <div className="flex justify-between text-[#a1a1aa]"><span>Fill Price</span><span className="text-white font-semibold">${tradeSuccess.fillPrice.toFixed(2)}</span></div>
              )}
              {tradeSuccess.orderType === 'MARKET' && (
                <div className="flex justify-between text-[#a1a1aa]"><span>Total</span><span className="text-green-400 font-semibold">${tradeSuccess.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              )}
            </div>
            <p className="mt-6 text-xs text-[#a1a1aa]">
              {tradeSuccess.orderType === 'MARKET'
                ? 'Your portfolio has been updated.'
                : 'Your order is saved and will execute automatically when conditions are met — even if you close this tab.'}
            </p>
            <button onClick={() => setTradeSuccess(null)}
              className="mt-6 w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-4 rounded-xl transition-all text-sm">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockDetail;
