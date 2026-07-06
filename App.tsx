import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClerkLoaded,
  ClerkLoading,
  SignIn,
  SignUp,
  UserButton,
  useClerk,
  useUser,
} from '@clerk/nextjs';
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Trophy,
  Menu,
  X,
  Wifi,
  WifiOff,
  BookOpen,
  ArrowRight,
  User,
  LogOut,
  Globe,
  Lock,
  ChevronLeft,
  KeyRound,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { LeaderboardEntry, OrderType, PendingOrder, PricePoint, Stock, Trade, UserProfile } from './types';
import { initializeStocks, updateStockPrices } from './services/stockEngine';
import { fetchStockQuote } from './services/marketData';
import { PRICE_UPDATE_INTERVAL } from './constants';
import { orderLimitFills, orderStopTriggers } from './services/tradeMath';
import {
  createPendingOrder,
  createTradingProfile,
  deletePendingOrder,
  executeMarketTrade,
  fetchPendingOrders,
  fetchTradingProfile,
  updatePendingOrder,
} from './services/tradingApi';
import Dashboard from './components/Dashboard';
import MarketList from './components/MarketList';
import PortfolioView from './components/PortfolioView';
import Leaderboard from './components/Leaderboard';
import StockDetail from './components/StockDetail';
import Tutorials from './components/Tutorials';
import AIAssistant from './components/AIAssistant';

type AuthContext = {
  userId: string;
  username: string;
  realName: string;
};

type Toast = {
  id: string;
  kind: 'success' | 'error';
  message: string;
};

type ProfileResponse = {
  profile: UserProfile | null;
  leaderboard: LeaderboardEntry[];
};

const MAX_PERFORMANCE_POINTS = 500;

const loadingScreen = (
  <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
    <div className="flex flex-col items-center">
      <TrendingUp className="text-green-400 w-12 h-12 mb-4 animate-pulse" />
      <span className="text-sm font-medium text-[#a1a1aa]">Loading...</span>
    </div>
  </div>
);

const sanitizeUsername = (value: string) => (
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
);

const getPreferredName = (user: ReturnType<typeof useUser>['user']) => (
  user?.fullName ||
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
  'Trader'
);

const getPreferredUsername = (user: ReturnType<typeof useUser>['user']) => {
  if (user?.username) {
    return sanitizeUsername(user.username);
  }

  const email = user?.primaryEmailAddress?.emailAddress;
  if (email) {
    return sanitizeUsername(email.split('@')[0]);
  }

  return sanitizeUsername(getPreferredName(user));
};

const livePoint = (price: number): PricePoint => ({
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  price,
  ts: Date.now(),
});

/**
 * Merge the freshly fetched server snapshot list into the locally accumulated
 * history (which includes intraday live ticks). Previously the server list
 * simply REPLACED local state after every trade, so the dashboard chart
 * visibly collapsed to a handful of sparse snapshots mid-session.
 */
const mergePerformanceHistory = (local: PricePoint[], server: PricePoint[]): PricePoint[] => {
  const seen = new Set(local.map((p) => p.ts).filter(Boolean));
  const additions = server.filter((p) => p.ts && !seen.has(p.ts));
  return [...local, ...additions]
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
    .slice(-MAX_PERFORMANCE_POINTS);
};

const ORDER_LABELS: Record<Exclude<OrderType, 'MARKET'>, string> = {
  LIMIT: 'Limit',
  STOP_LOSS: 'Stop',
  STOP_LIMIT: 'Stop-limit',
};

const SidebarItem: React.FC<{ icon: React.ReactElement<{ className?: string }>; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-green-500/10 text-green-400' : 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.04]'}`}>
    {React.cloneElement(icon, { className: 'w-4 h-4' })}
    <span className="text-sm font-medium">{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ label: string; onClick: () => void; active: boolean }> = ({ label, onClick, active }) => (
  <button onClick={onClick} className={`block w-full text-left text-2xl font-bold ${active ? 'text-green-400' : 'text-white'}`}>{label}</button>
);

const ToastStack: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed bottom-6 left-6 z-[60] space-y-2 max-w-sm" aria-live="polite">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`animate-slide-up flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl bg-[#161616] ${
          toast.kind === 'success' ? 'border-green-500/40' : 'border-red-500/40'
        }`}
      >
        {toast.kind === 'success'
          ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
        <p className="text-xs text-[#ededed] leading-relaxed flex-1">{toast.message}</p>
        <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification"
          className="text-[#52525b] hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
  </div>
);

const TradingApp: React.FC<{
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  leaderboard: LeaderboardEntry[];
  setLeaderboard: React.Dispatch<React.SetStateAction<LeaderboardEntry[]>>;
  onSignOut: () => Promise<void>;
}> = ({ userProfile, setUserProfile, leaderboard, setLeaderboard, onSignOut }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'market' | 'portfolio' | 'leaderboard' | 'learning'>('dashboard');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs let the single long-lived interval read fresh state without being
  // torn down and recreated on every tick (the old effect depended on
  // [selectedStock, stocks] and rebuilt the timer every 15 seconds).
  const stocksRef = useRef<Stock[]>([]);
  const selectedSymbolRef = useRef<string | undefined>(undefined);
  const pendingOrdersRef = useRef<PendingOrder[]>([]);
  const didInitializeStocks = useRef(false);

  useEffect(() => { stocksRef.current = stocks; }, [stocks]);
  useEffect(() => { selectedSymbolRef.current = selectedStock?.symbol; }, [selectedStock]);
  useEffect(() => { pendingOrdersRef.current = pendingOrders; }, [pendingOrders]);

  const pushToast = useCallback((kind: Toast['kind'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applyProfileResponse = useCallback((response: ProfileResponse) => {
    if (response.profile) {
      const profile = response.profile;
      setUserProfile((prev) => prev
        ? { ...profile, performanceHistory: mergePerformanceHistory(prev.performanceHistory, profile.performanceHistory) }
        : profile);
    }
    setLeaderboard(response.leaderboard);
  }, [setLeaderboard, setUserProfile]);

  // Initial stock universe = default list + anything the user already holds.
  // Held symbols outside the default list previously valued at $0 after a
  // refresh, showing -100% P&L and understating net worth.
  useEffect(() => {
    if (didInitializeStocks.current) return;
    didInitializeStocks.current = true;
    const init = async () => {
      try {
        const initial = await initializeStocks();
        const known = new Set(initial.map((s) => s.symbol));
        const heldUnknown = userProfile.holdings.filter((h) => !known.has(h.symbol));
        const restored: Stock[] = await Promise.all(heldUnknown.map(async (holding) => {
          const quote = await fetchStockQuote(holding.symbol);
          // Last resort is cost basis — a stale-but-plausible value beats $0.
          const price = quote?.price ?? holding.averageCost;
          return {
            symbol: holding.symbol,
            name: quote?.name ?? holding.symbol,
            sector: '—',
            price,
            change: quote?.change ?? 0,
            changePercent: quote?.changePercent ?? 0,
            history: [livePoint(price)],
          };
        }));
        setStocks([...initial, ...restored]);
      } catch (error) {
        console.error('Failed to init stocks', error);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore server-persisted conditional orders (they survive refresh now).
  useEffect(() => {
    fetchPendingOrders()
      .then(setPendingOrders)
      .catch((error) => console.error('Failed to load pending orders', error));
  }, []);

  const executePendingOrder = useCallback(async (order: PendingOrder) => {
    try {
      const response = await executeMarketTrade({
        symbol: order.symbol,
        shares: order.shares,
        type: order.side,
        // The server refuses to fill through the limit even if the live quote
        // moved past what the client saw.
        limitPrice: order.orderType === 'LIMIT' || order.orderType === 'STOP_LIMIT'
          ? order.limitPrice
          : undefined,
      });
      applyProfileResponse(response);
      setPendingOrders((prev) => prev.filter((o) => o.id !== order.id));
      void deletePendingOrder(order.id).catch(() => { /* already removed locally */ });
      const executed = response.profile?.history?.[0];
      pushToast('success',
        `${ORDER_LABELS[order.orderType]} order filled: ${order.side === 'BUY' ? 'bought' : 'sold'} ` +
        `${order.shares} ${order.symbol}${executed ? ` @ $${executed.priceAtTrade.toFixed(2)}` : ''}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order execution failed.';
      // Keep the order visible with its error instead of silently deleting it —
      // a student relying on a stop-loss must know it didn't go through.
      if (order.lastError !== message) {
        pushToast('error', `${order.symbol} ${ORDER_LABELS[order.orderType].toLowerCase()} order not filled: ${message}`);
      }
      setPendingOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, lastError: message } : o)));
      void updatePendingOrder({ id: order.id, lastError: message }).catch(() => {});
    }
  }, [applyProfileResponse, pushToast]);

  const processPendingOrders = useCallback(async (updated: Stock[]) => {
    for (const order of pendingOrdersRef.current) {
      const stock = updated.find((s) => s.symbol === order.symbol);
      if (!stock) continue;
      const price = stock.price;

      if (order.orderType === 'LIMIT') {
        if (orderLimitFills(order.side, order.limitPrice!, price)) {
          await executePendingOrder(order);
        }
      } else if (order.orderType === 'STOP_LOSS') {
        if (orderStopTriggers(order.side, order.stopPrice!, price)) {
          await executePendingOrder(order);
        }
      } else if (order.orderType === 'STOP_LIMIT') {
        if (!order.stopTriggered) {
          if (orderStopTriggers(order.side, order.stopPrice!, price)) {
            setPendingOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, stopTriggered: true } : o)));
            void updatePendingOrder({ id: order.id, stopTriggered: true }).catch(() => {});
          }
        } else if (orderLimitFills(order.side, order.limitPrice!, price)) {
          await executePendingOrder(order);
        }
      }
    }
  }, [executePendingOrder]);

  // One long-lived price loop; per-order state changes are applied with
  // functional updates so orders placed mid-tick are never clobbered.
  useEffect(() => {
    const timer = setInterval(async () => {
      const current = stocksRef.current;
      if (current.length === 0) return;
      try {
        const { stocks: updated, liveDataReceived } = await updateStockPrices(current, selectedSymbolRef.current);
        setStocks(updated);
        setIsLive(liveDataReceived);

        // Push live portfolio value into performanceHistory for the dashboard chart.
        setUserProfile((prev) => {
          if (!prev) return prev;
          const liveValue = prev.holdings.reduce((acc, h) => {
            const s = updated.find((st) => st.symbol === h.symbol);
            return acc + h.shares * (s?.price ?? h.averageCost);
          }, prev.cash);
          const trimmed = prev.performanceHistory.slice(-(MAX_PERFORMANCE_POINTS - 1));
          return { ...prev, performanceHistory: [...trimmed, livePoint(liveValue)] };
        });

        await processPendingOrders(updated);
      } catch (error) {
        console.error('Price update failed', error);
        setIsLive(false);
      }
    }, PRICE_UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [processPendingOrders, setUserProfile]);

  const handleTrade = async (stock: Stock, shares: number, type: 'BUY' | 'SELL'): Promise<Trade | null> => {
    const response = await executeMarketTrade({ symbol: stock.symbol, shares, type });
    applyProfileResponse(response);
    // The actual fill (server-side quote) — lets the UI show the real price.
    return response.profile?.history?.[0] ?? null;
  };

  const handlePlaceOrder = async (
    symbol: string, side: 'BUY' | 'SELL', orderType: OrderType,
    shares: number, limitPrice?: number, stopPrice?: number
  ): Promise<Trade | null> => {
    if (orderType === 'MARKET') {
      const stock = stocks.find(s => s.symbol === symbol);
      if (!stock) throw new Error('Stock not found.');
      return handleTrade(stock, shares, side);
    }
    const order = await createPendingOrder({ symbol, side, orderType, shares, limitPrice, stopPrice });
    setPendingOrders(prev => [...prev, order]);
    return null;
  };

  const handleCancelOrder = async (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    try {
      await deletePendingOrder(orderId);
    } catch (error) {
      pushToast('error', 'Could not cancel the order on the server — it may still be active.');
      console.error('Cancel order failed', error);
    }
  };

  const handleAddStock = async (symbol: string, name: string, sector: string): Promise<boolean> => {
    if (stocks.some(s => s.symbol === symbol)) return true;
    const liveData = await fetchStockQuote(symbol);
    if (!liveData) {
      // Refuse to add with a fabricated price (the old code fell back to $100).
      pushToast('error', `Couldn't fetch a live price for ${symbol}. Try again in a moment.`);
      return false;
    }
    setStocks(prev => [...prev, {
      symbol,
      name: name || liveData.name || symbol,
      sector,
      price: liveData.price,
      change: liveData.change,
      changePercent: liveData.changePercent,
      history: [livePoint(liveData.price)],
    }]);
    return true;
  };

  const portfolioValue = useMemo(() => {
    const holdingsValue = userProfile.holdings.reduce((acc, holding) => {
      const stock = stocks.find((candidate) => candidate.symbol === holding.symbol);
      // Cost basis fallback — never value a held position at $0.
      return acc + (holding.shares * (stock?.price ?? holding.averageCost));
    }, 0);
    return holdingsValue + userProfile.cash;
  }, [stocks, userProfile]);

  const currentUserRank = useMemo(
    () => leaderboard.find((entry) => entry.username === userProfile.username)?.rank ?? null,
    [leaderboard, userProfile.username]
  );

  const navigateTo = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSelectedStock(null);
    setIsMobileMenuOpen(false);
  };

  const copyRoomCode = async () => {
    const code = userProfile.league.roomCode;
    if (!code) return;
    try {
      await navigator.clipboard?.writeText(code);
      pushToast('success', `Room code ${code} copied — share it with friends to let them join.`);
    } catch {
      pushToast('error', 'Could not copy the room code.');
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#ededed] overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 bg-[#0a0a0a] border-r border-white/[0.06]">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-black w-5 h-5" />
            </div>
            <span className="text-base font-semibold text-white tracking-tight">PaperTrade</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
            <SidebarItem icon={<TrendingUp />} label="Markets" active={activeTab === 'market'} onClick={() => navigateTo('market')} />
            <SidebarItem icon={<Briefcase />} label="Portfolio" active={activeTab === 'portfolio'} onClick={() => navigateTo('portfolio')} />
            <SidebarItem icon={<Trophy />} label="Leaderboard" active={activeTab === 'leaderboard'} onClick={() => navigateTo('leaderboard')} />
            <SidebarItem icon={<BookOpen />} label="Learning" active={activeTab === 'learning'} onClick={() => navigateTo('learning')} />
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/[0.06]">
          <div className="mb-4">
            <p className="text-xs text-[#a1a1aa] font-medium mb-1">Cash Balance</p>
            <p className="text-lg font-bold text-white">${userProfile.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="space-y-3 p-3 bg-[#161616] rounded-xl border border-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-green-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate leading-tight">{userProfile.realName}</p>
                  <p className="text-xs text-[#a1a1aa] truncate">@{userProfile.username}</p>
                </div>
              </div>
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-8 h-8',
                  },
                }}
              />
            </div>
            <button
              onClick={() => void onSignOut()}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-[#a1a1aa] hover:text-red-400 transition-colors border border-white/[0.06] rounded-lg py-2"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-20 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div className="md:hidden flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Open navigation menu">
              <Menu className="text-white w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-green-400">PaperTrade</span>
          </div>


          <div className="flex items-center gap-8">
            {userProfile.league.type === 'private' && userProfile.league.roomCode && (
              <button
                type="button"
                onClick={() => void copyRoomCode()}
                className="hidden sm:flex items-center gap-2 border border-green-500/30 bg-green-500/10 text-green-200 px-3 py-2 rounded-lg text-xs font-semibold tracking-[0.18em] hover:border-green-400/60 transition-colors"
                title="Copy room code"
              >
                <KeyRound className="w-3 h-3" />
                {userProfile.league.roomCode}
                <Copy className="w-3 h-3" />
              </button>
            )}
            <div className="hidden lg:flex items-center gap-2">
              {isLive ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
              <span className="text-xs font-medium text-[#a1a1aa]">{isLive ? 'Market Live' : 'Prices delayed'}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#a1a1aa] font-medium">Net Worth</p>
              <p className="text-sm font-bold text-green-400">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {selectedStock ? (
            <StockDetail stock={selectedStock} user={userProfile} onBack={() => setSelectedStock(null)} onTrade={handleTrade} onPlaceOrder={handlePlaceOrder} pendingOrders={pendingOrders.filter(o => o.symbol === selectedStock.symbol)} onCancelOrder={handleCancelOrder} />
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard user={userProfile} stocks={stocks} onSelectStock={setSelectedStock} portfolioValue={portfolioValue} onNavigate={navigateTo} globalRank={currentUserRank} />}
              {activeTab === 'market' && <MarketList stocks={stocks} onSelectStock={setSelectedStock} onAddStock={handleAddStock} />}
              {activeTab === 'portfolio' && <PortfolioView user={userProfile} stocks={stocks} onSelectStock={setSelectedStock} pendingOrders={pendingOrders} onCancelOrder={handleCancelOrder} />}
              {activeTab === 'leaderboard' && <Leaderboard user={userProfile} portfolioValue={portfolioValue} entries={leaderboard} />}
              {activeTab === 'learning' && <Tutorials />}
            </>
          )}
        </div>

        <AIAssistant user={userProfile} stocks={stocks} portfolioValue={portfolioValue} />
      </main>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-12">
            <span className="text-2xl font-bold text-green-400">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation menu">
              <X className="w-8 h-8 text-white" />
            </button>
          </div>
          <nav className="space-y-6">
            <MobileNavItem label="Dashboard" onClick={() => navigateTo('dashboard')} active={activeTab === 'dashboard'} />
            <MobileNavItem label="Markets" onClick={() => navigateTo('market')} active={activeTab === 'market'} />
            <MobileNavItem label="Portfolio" onClick={() => navigateTo('portfolio')} active={activeTab === 'portfolio'} />
            <MobileNavItem label="Leaderboard" onClick={() => navigateTo('leaderboard')} active={activeTab === 'leaderboard'} />
            <MobileNavItem label="Learning" onClick={() => navigateTo('learning')} active={activeTab === 'learning'} />
            <button onClick={() => void onSignOut()} className="text-xl font-bold text-red-400 mt-12 border-t border-white/[0.06] pt-6 block w-full text-left">
              Sign Out
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

const LandingPage: React.FC<{
  auth: AuthContext;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  setLeaderboard: React.Dispatch<React.SetStateAction<LeaderboardEntry[]>>;
  onSignOut: () => Promise<void>;
}> = ({ auth, setUserProfile, setLeaderboard, onSignOut }) => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState(auth.username);
  const [realName, setRealName] = useState(auth.realName);
  const [leagueType, setLeagueType] = useState<'public' | 'private'>('public');
  const [roomMode, setRoomMode] = useState<'create' | 'join'>('create');
  const [leagueName, setLeagueName] = useState('Global Arena');
  const [roomCode, setRoomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleNext = (event: React.FormEvent) => {
    event.preventDefault();
    if (username.trim() && realName.trim()) setStep(2);
  };

  const handleFinish = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError('');
    try {
      const response = await createTradingProfile(
        { username: username.trim(), realName: realName.trim() },
        {
          name: leagueType === 'public' ? 'Global PaperTrade Arena' : leagueName.trim(),
          type: leagueType,
          roomMode: leagueType === 'private' ? roomMode : undefined,
          roomCode: leagueType === 'private' && roomMode === 'join' ? roomCode.trim() : undefined,
        }
      );
      setUserProfile(response.profile);
      setLeaderboard(response.leaderboard);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6">
      <div className="flex flex-col lg:flex-row items-center gap-16 max-w-6xl w-full">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mx-auto lg:mx-0">
            <TrendingUp className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl lg:text-6xl font-semibold text-white tracking-tight">
            Trade with <br />
            <span className="text-green-400">the World</span>
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-lg mx-auto lg:mx-0">
            Build a real account-backed paper portfolio, place market trades, and learn the mechanics of investing without risking real money.
          </p>
        </div>

        <div className="w-full max-w-md bg-[#161616] border border-white/[0.06] p-8 rounded-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-green-400">
              {step === 1 ? 'Step 1: Identity' : 'Step 2: League'}
            </h2>
            <button type="button" onClick={() => void onSignOut()} className="text-xs font-medium text-[#a1a1aa] hover:text-red-400 transition-colors">
              Switch account
            </button>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-2">Full Name</label>
                  <input type="text" value={realName} onChange={(event) => setRealName(event.target.value)} placeholder="Enter your name" required
                    className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/50 transition-all text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-2">Username</label>
                  <input type="text" value={username} onChange={(event) => setUsername(sanitizeUsername(event.target.value))} placeholder="Choose a handle" required
                    className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/50 transition-all text-sm" />
                </div>
              </div>
              <button type="submit"
                className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 group">
                Continue <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleFinish} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setLeagueType('public')}
                  className={`p-4 border-2 flex flex-col items-center gap-3 transition-all rounded-xl ${leagueType === 'public' ? 'border-green-500 bg-green-500/10' : 'border-white/[0.06] bg-[#0a0a0a] text-[#a1a1aa]'}`}>
                  <Globe className={`w-8 h-8 ${leagueType === 'public' ? 'text-green-400' : 'text-[#52525b]'}`} />
                  <span className="text-xs font-semibold">Public Arena</span>
                </button>
                <button type="button" onClick={() => setLeagueType('private')}
                  className={`p-4 border-2 flex flex-col items-center gap-3 transition-all rounded-xl ${leagueType === 'private' ? 'border-green-500 bg-green-500/10' : 'border-white/[0.06] bg-[#0a0a0a] text-[#a1a1aa]'}`}>
                  <Lock className={`w-8 h-8 ${leagueType === 'private' ? 'text-green-400' : 'text-[#52525b]'}`} />
                  <span className="text-xs font-semibold">Friend Room</span>
                </button>
              </div>

              {leagueType === 'private' && (
                <div className="animate-fade-in space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setRoomMode('create')}
                      className={`p-3 border flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all ${roomMode === 'create' ? 'border-green-500 bg-green-500/10 text-green-300' : 'border-white/[0.06] bg-[#0a0a0a] text-[#a1a1aa]'}`}>
                      <Lock className="w-4 h-4" />
                      Create Room
                    </button>
                    <button type="button" onClick={() => setRoomMode('join')}
                      className={`p-3 border flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all ${roomMode === 'join' ? 'border-green-500 bg-green-500/10 text-green-300' : 'border-white/[0.06] bg-[#0a0a0a] text-[#a1a1aa]'}`}>
                      <KeyRound className="w-4 h-4" />
                      Join Code
                    </button>
                  </div>

                  {roomMode === 'create' ? (
                    <div>
                      <label className="block text-xs font-medium text-[#a1a1aa] mb-2">Room Name</label>
                      <input type="text" value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder="Study Group, Rivals, etc." required
                        className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/50 transition-all text-sm" />
                      <p className="mt-2 text-xs text-[#a1a1aa]">A random room code will be created after you start.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-[#a1a1aa] mb-2">Room Code</label>
                      <input type="text" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" required minLength={6}
                        className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/50 transition-all text-sm uppercase tracking-[0.3em]" />
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-white/[0.06] hover:border-white/[0.12] text-[#a1a1aa] py-4 rounded-lg transition-all flex items-center justify-center font-medium text-sm">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-[2] bg-green-500 hover:bg-green-400 text-black font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60">
                  {isSubmitting ? 'Setting up…' : 'Start Simulator'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 max-w-6xl w-full items-center">
        <div className="space-y-8 text-center lg:text-left">
          <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mx-auto lg:mx-0">
            <TrendingUp className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl lg:text-6xl font-semibold text-white tracking-tight">
            Learn Markets <br />
            <span className="text-green-400">By Doing</span>
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-xl mx-auto lg:mx-0">
            This project is a stock learning app for students. Sign in to practice paper trading, track portfolio history, and compete on a persistent global leaderboard.
          </p>
          <div className="flex gap-3 justify-center lg:justify-start">
            <button onClick={() => setMode('sign-in')}
              className={`px-5 py-3 text-sm font-semibold border rounded-lg transition-colors ${mode === 'sign-in' ? 'bg-green-500 border-green-500 text-black' : 'border-white/[0.06] text-[#a1a1aa] hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={() => setMode('sign-up')}
              className={`px-5 py-3 text-sm font-semibold border rounded-lg transition-colors ${mode === 'sign-up' ? 'bg-green-500 border-green-500 text-black' : 'border-white/[0.06] text-[#a1a1aa] hover:text-white'}`}>
              Create Account
            </button>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-4 flex justify-center">
          {mode === 'sign-in' ? <SignIn routing="virtual" /> : <SignUp routing="virtual" />}
        </div>
      </div>
    </div>
  );
};

const AppShell: React.FC = () => {
  const { isLoaded: isAuthLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(false);

  const auth = useMemo<AuthContext | null>(() => {
    if (!user) return null;
    return {
      userId: user.id,
      username: getPreferredUsername(user),
      realName: getPreferredName(user),
    };
  }, [user]);

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (!isSignedIn || !auth) {
      setUserProfile(null);
      setLeaderboard([]);
      setIsBootstrapping(false);
      return;
    }
    const bootstrap = async () => {
      setIsBootstrapping(true);
      setBootstrapError(false);
      try {
        const response = await fetchTradingProfile();
        setUserProfile(response.profile);
        setLeaderboard(response.leaderboard);
      } catch (error) {
        console.error('Failed to load trading profile', error);
        // Distinguish "no profile yet" from "request failed" — otherwise a
        // network blip dropped existing users back onto the onboarding form.
        setBootstrapError(true);
      } finally {
        setIsBootstrapping(false);
      }
    };
    void bootstrap();
  }, [auth, isAuthLoaded, isSignedIn]);

  const handleSignOut = async () => {
    await signOut();
  };

  if (!isAuthLoaded || isBootstrapping) return loadingScreen;
  if (!isSignedIn || !auth) return <AuthScreen />;
  if (bootstrapError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <WifiOff className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-semibold text-white">Couldn't reach the server</h1>
          <p className="text-sm text-[#a1a1aa]">Your portfolio is safe — we just couldn't load it. Check your connection and try again.</p>
          <button onClick={() => window.location.reload()}
            className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-lg text-sm transition-all">
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!userProfile) {
    return (
      <LandingPage auth={auth} setUserProfile={setUserProfile} setLeaderboard={setLeaderboard} onSignOut={handleSignOut} />
    );
  }

  return (
    <TradingApp userProfile={userProfile} setUserProfile={setUserProfile} leaderboard={leaderboard} setLeaderboard={setLeaderboard} onSignOut={handleSignOut} />
  );
};

const App: React.FC = () => (
  <>
    <ClerkLoading>{loadingScreen}</ClerkLoading>
    <ClerkLoaded>
      <AppShell />
    </ClerkLoaded>
  </>
);

export default App;
