import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Search,
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
} from 'lucide-react';
import type { LeaderboardEntry, OrderType, PendingOrder, Stock, UserProfile } from './types';
import { initializeStocks, updateStockPrices } from './services/stockEngine';
import { fetchStockQuote } from './services/marketData';
import { PRICE_UPDATE_INTERVAL } from './constants';
import { createTradingProfile, executeMarketTrade, fetchTradingProfile } from './services/tradingApi';
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

const loadingScreen = (
  <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center">
    <div className="flex flex-col items-center">
      <TrendingUp className="text-violet-400 w-12 h-12 mb-4 animate-pulse" />
      <span className="text-sm font-medium text-[#8b8b9e]">Loading...</span>
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

const SidebarItem: React.FC<{ icon: React.ReactElement<{ className?: string }>; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-violet-500/10 text-violet-400' : 'text-[#8b8b9e] hover:text-white hover:bg-white/[0.04]'}`}>
    {React.cloneElement(icon, { className: 'w-4 h-4' })}
    <span className="text-sm font-medium">{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ label: string; onClick: () => void; active: boolean }> = ({ label, onClick, active }) => (
  <button onClick={onClick} className={`block w-full text-left text-2xl font-bold ${active ? 'text-violet-400' : 'text-white'}`}>{label}</button>
);

const TradingApp: React.FC<{
  auth: AuthContext;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  leaderboard: LeaderboardEntry[];
  setLeaderboard: React.Dispatch<React.SetStateAction<LeaderboardEntry[]>>;
  onSignOut: () => Promise<void>;
}> = ({ auth, userProfile, setUserProfile, leaderboard, setLeaderboard, onSignOut }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'market' | 'portfolio' | 'leaderboard' | 'learning'>('dashboard');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const pendingOrdersRef = useRef<PendingOrder[]>([]);
  const didInitializeStocks = useRef(false);

  // Keep ref in sync so interval can access latest orders without stale closure
  useEffect(() => { pendingOrdersRef.current = pendingOrders; }, [pendingOrders]);

  useEffect(() => {
    if (didInitializeStocks.current) return;
    didInitializeStocks.current = true;
    const init = async () => {
      try {
        const initial = await initializeStocks();
        setStocks(initial);
      } catch (error) {
        console.error('Failed to init stocks', error);
      }
    };
    void init();
  }, []);

  useEffect(() => {
    if (stocks.length === 0) return;
    const timer = setInterval(async () => {
      try {
        const updated = await updateStockPrices(stocks, selectedStock?.symbol);
        setStocks(updated);
        setIsLive(true);

        // Push live portfolio value into performanceHistory so the dashboard chart updates in real-time
        setUserProfile(prev => {
          if (!prev) return prev;
          const liveValue = prev.holdings.reduce((acc, h) => {
            const s = updated.find(st => st.symbol === h.symbol);
            return acc + h.shares * (s?.price ?? 0);
          }, prev.cash);
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            price: liveValue,
          };
          // Keep up to 200 points (≈50 min of ticks at 15s)
          const trimmed = prev.performanceHistory.slice(-199);
          return { ...prev, performanceHistory: [...trimmed, newPoint] };
        });

        // Check pending orders against new prices
        const orders = pendingOrdersRef.current;
        if (orders.length === 0) return;

        const toExecute: PendingOrder[] = [];
        const toUpdate: PendingOrder[] = [];
        const remaining: PendingOrder[] = [];

        for (const order of orders) {
          const stock = updated.find(s => s.symbol === order.symbol);
          if (!stock) { remaining.push(order); continue; }
          const price = stock.price;

          if (order.orderType === 'LIMIT') {
            const fills = order.side === 'BUY' ? price <= order.limitPrice! : price >= order.limitPrice!;
            fills ? toExecute.push(order) : remaining.push(order);
          } else if (order.orderType === 'STOP_LOSS') {
            const triggers = order.side === 'BUY' ? price >= order.stopPrice! : price <= order.stopPrice!;
            triggers ? toExecute.push(order) : remaining.push(order);
          } else if (order.orderType === 'STOP_LIMIT') {
            if (!order.stopTriggered) {
              const triggers = order.side === 'BUY' ? price >= order.stopPrice! : price <= order.stopPrice!;
              triggers ? toUpdate.push({ ...order, stopTriggered: true }) : remaining.push(order);
            } else {
              const fills = order.side === 'BUY' ? price <= order.limitPrice! : price >= order.limitPrice!;
              fills ? toExecute.push(order) : remaining.push({ ...order, stopTriggered: true });
            }
          }
        }

        for (const order of toExecute) {
          const stock = updated.find(s => s.symbol === order.symbol);
          if (!stock) continue;
          try {
            const response = await executeMarketTrade(auth, { symbol: order.symbol, shares: order.shares, type: order.side });
            setUserProfile(response.profile);
            setLeaderboard(response.leaderboard);
          } catch {}
        }

        setPendingOrders([...remaining, ...toUpdate]);
      } catch (error) {
        setIsLive(false);
      }
    }, PRICE_UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [selectedStock, stocks]);

  const handleTrade = async (stock: Stock, shares: number, type: 'BUY' | 'SELL') => {
    const response = await executeMarketTrade(auth, { symbol: stock.symbol, shares, type });
    setUserProfile(response.profile);
    setLeaderboard(response.leaderboard);
  };

  const handlePlaceOrder = async (
    symbol: string, side: 'BUY' | 'SELL', orderType: OrderType,
    shares: number, limitPrice?: number, stopPrice?: number
  ) => {
    if (orderType === 'MARKET') {
      const stock = stocks.find(s => s.symbol === symbol);
      if (stock) await handleTrade(stock, shares, side);
      return;
    }
    const order: PendingOrder = {
      id: Math.random().toString(36).substr(2, 9),
      symbol, side, orderType, shares, limitPrice, stopPrice,
      placedAt: Date.now(), stopTriggered: false,
    };
    setPendingOrders(prev => [...prev, order]);
  };

  const handleCancelOrder = (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleAddStock = async (symbol: string, name: string, sector: string) => {
    if (stocks.some(s => s.symbol === symbol)) return;
    const liveData = await fetchStockQuote(symbol);
    const basePrice = liveData?.price ?? 100;
    const history = Array.from({ length: 20 }).map((_, idx) => ({
      time: new Date(Date.now() - (20 - idx) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: basePrice,
    }));
    setStocks(prev => [...prev, { symbol, name, sector, price: basePrice, change: liveData?.change ?? 0, changePercent: liveData?.changePercent ?? 0, history }]);
  };

  const handleRemoveStock = (symbol: string) => {
    // Don't remove if user holds a position
    if (userProfile.holdings.some(h => h.symbol === symbol)) return;
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
    if (selectedStock?.symbol === symbol) setSelectedStock(null);
  };

  const portfolioValue = useMemo(() => {
    const holdingsValue = userProfile.holdings.reduce((acc, holding) => {
      const stock = stocks.find((candidate) => candidate.symbol === holding.symbol);
      return acc + (holding.shares * (stock?.price || 0));
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

  return (
    <div className="flex h-screen bg-[#0d0d12] text-[#e8e8ed] overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 bg-[#0d0d12] border-r border-white/[0.06]">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">PaperTrade Pro</span>
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
            <p className="text-xs text-[#8b8b9e] font-medium mb-1">Cash Balance</p>
            <p className="text-lg font-bold text-white">${userProfile.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="space-y-3 p-3 bg-[#16161e] rounded-xl border border-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-violet-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate leading-tight">{userProfile.realName}</p>
                  <p className="text-xs text-[#8b8b9e] truncate">@{userProfile.username}</p>
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
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-[#8b8b9e] hover:text-red-400 transition-colors border border-white/[0.06] rounded-lg py-2"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-20 bg-[#0d0d12]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div className="md:hidden flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="text-white w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-violet-400">PaperTrade</span>
          </div>


          <div className="flex items-center gap-8">
            <div className="hidden lg:flex items-center gap-2">
              {isLive ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
              <span className="text-xs font-medium text-[#8b8b9e]">Market Live</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#8b8b9e] font-medium">Net Worth</p>
              <p className="text-sm font-bold text-violet-400">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {selectedStock ? (
            <StockDetail stock={selectedStock} user={userProfile} onBack={() => setSelectedStock(null)} onTrade={handleTrade} onPlaceOrder={handlePlaceOrder} pendingOrders={pendingOrders.filter(o => o.symbol === selectedStock.symbol)} onCancelOrder={handleCancelOrder} />
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard user={userProfile} stocks={stocks} onSelectStock={setSelectedStock} portfolioValue={portfolioValue} onNavigate={navigateTo} globalRank={currentUserRank} />}
              {activeTab === 'market' && <MarketList stocks={stocks} onSelectStock={setSelectedStock} onAddStock={handleAddStock} onRemoveStock={handleRemoveStock} heldSymbols={new Set(userProfile.holdings.map(h => h.symbol))} />}
              {activeTab === 'portfolio' && <PortfolioView user={userProfile} stocks={stocks} onSelectStock={setSelectedStock} />}
              {activeTab === 'leaderboard' && <Leaderboard user={userProfile} portfolioValue={portfolioValue} entries={leaderboard} />}
              {activeTab === 'learning' && <Tutorials />}
            </>
          )}
        </div>

        <AIAssistant user={userProfile} stocks={stocks} portfolioValue={portfolioValue} />
      </main>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#0d0d12] flex flex-col p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-12">
            <span className="text-2xl font-bold text-violet-400">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)}>
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
  const [leagueName, setLeagueName] = useState('Global Arena');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = (event: React.FormEvent) => {
    event.preventDefault();
    if (username.trim() && realName.trim()) setStep(2);
  };

  const handleFinish = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await createTradingProfile(
        { ...auth, username: username.trim(), realName: realName.trim() },
        { name: leagueType === 'public' ? 'Global PaperTrade Arena' : leagueName.trim(), type: leagueType }
      );
      setUserProfile(response.profile);
      setLeaderboard(response.leaderboard);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d12] p-6">
      <div className="flex flex-col lg:flex-row items-center gap-16 max-w-6xl w-full">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto lg:mx-0">
            <TrendingUp className="text-white w-10 h-10" />
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-white tracking-tight">
            Trade with <br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">the World</span>
          </h1>
          <p className="text-lg text-[#8b8b9e] max-w-lg mx-auto lg:mx-0">
            Build a real account-backed paper portfolio, place market trades, and learn the mechanics of investing without risking real money.
          </p>
        </div>

        <div className="w-full max-w-md bg-[#16161e] border border-white/[0.06] p-8 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-violet-400">
              {step === 1 ? 'Step 1: Identity' : 'Step 2: League'}
            </h2>
            <button type="button" onClick={() => void onSignOut()} className="text-xs font-medium text-[#8b8b9e] hover:text-red-400 transition-colors">
              Switch account
            </button>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-2">Full Name</label>
                  <input type="text" value={realName} onChange={(event) => setRealName(event.target.value)} placeholder="Enter your name" required
                    className="w-full bg-[#0d0d12] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-all text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-2">Username</label>
                  <input type="text" value={username} onChange={(event) => setUsername(sanitizeUsername(event.target.value))} placeholder="Choose a handle" required
                    className="w-full bg-[#0d0d12] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-all text-sm" />
                </div>
              </div>
              <button type="submit"
                className="w-full bg-violet-500 hover:bg-violet-400 text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 group">
                Continue <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleFinish} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setLeagueType('public')}
                  className={`p-4 border-2 flex flex-col items-center gap-3 transition-all rounded-xl ${leagueType === 'public' ? 'border-violet-500 bg-violet-500/10' : 'border-white/[0.06] bg-[#0d0d12] text-[#8b8b9e]'}`}>
                  <Globe className={`w-8 h-8 ${leagueType === 'public' ? 'text-violet-400' : 'text-[#4a4a5c]'}`} />
                  <span className="text-xs font-semibold">Public Arena</span>
                </button>
                <button type="button" onClick={() => setLeagueType('private')}
                  className={`p-4 border-2 flex flex-col items-center gap-3 transition-all rounded-xl ${leagueType === 'private' ? 'border-violet-500 bg-violet-500/10' : 'border-white/[0.06] bg-[#0d0d12] text-[#8b8b9e]'}`}>
                  <Lock className={`w-8 h-8 ${leagueType === 'private' ? 'text-violet-400' : 'text-[#4a4a5c]'}`} />
                  <span className="text-xs font-semibold">Private Room</span>
                </button>
              </div>

              {leagueType === 'private' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-2">League Name</label>
                  <input type="text" value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder="Wolf Pack, Rivals, etc." required
                    className="w-full bg-[#0d0d12] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-all text-sm" />
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-white/[0.06] hover:border-white/[0.12] text-[#8b8b9e] py-4 rounded-lg transition-all flex items-center justify-center font-medium text-sm">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-[2] bg-violet-500 hover:bg-violet-400 text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60">
                  Start Simulator
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
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d12] p-6">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 max-w-6xl w-full items-center">
        <div className="space-y-8 text-center lg:text-left">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto lg:mx-0">
            <TrendingUp className="text-white w-10 h-10" />
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-white tracking-tight">
            Learn Markets <br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">By Doing</span>
          </h1>
          <p className="text-lg text-[#8b8b9e] max-w-xl mx-auto lg:mx-0">
            This project is a stock learning app for students. Sign in to practice paper trading, track portfolio history, and compete on a persistent global leaderboard.
          </p>
          <div className="flex gap-3 justify-center lg:justify-start">
            <button onClick={() => setMode('sign-in')}
              className={`px-5 py-3 text-sm font-semibold border rounded-lg transition-colors ${mode === 'sign-in' ? 'bg-violet-500 border-violet-500 text-white' : 'border-white/[0.06] text-[#8b8b9e] hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={() => setMode('sign-up')}
              className={`px-5 py-3 text-sm font-semibold border rounded-lg transition-colors ${mode === 'sign-up' ? 'bg-violet-500 border-violet-500 text-white' : 'border-white/[0.06] text-[#8b8b9e] hover:text-white'}`}>
              Create Account
            </button>
          </div>
        </div>

        <div className="bg-[#16161e] border border-white/[0.06] rounded-2xl p-4 flex justify-center">
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
      try {
        const response = await fetchTradingProfile(auth);
        setUserProfile(response.profile);
        setLeaderboard(response.leaderboard);
      } catch (error) {
        console.error('Failed to load trading profile', error);
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
  if (!userProfile) {
    return (
      <LandingPage auth={auth} setUserProfile={setUserProfile} setLeaderboard={setLeaderboard} onSignOut={handleSignOut} />
    );
  }

  return (
    <TradingApp auth={auth} userProfile={userProfile} setUserProfile={setUserProfile} leaderboard={leaderboard} setLeaderboard={setLeaderboard} onSignOut={handleSignOut} />
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
