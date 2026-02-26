
import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronLeft
} from 'lucide-react';
import { Stock, UserProfile } from './types';
import { initializeStocks, updateStockPrices, getInitialUser, executeTrade } from './services/stockEngine';
import { PRICE_UPDATE_INTERVAL } from './constants';
import Dashboard from './components/Dashboard';
import MarketList from './components/MarketList';
import PortfolioView from './components/PortfolioView';
import Leaderboard from './components/Leaderboard';
import StockDetail from './components/StockDetail';
import Tutorials from './components/Tutorials';
import AIAssistant from './components/AIAssistant';

const STORAGE_KEY = 'paperTrade_local_profile_v1';

const TradingApp: React.FC<{ 
  userProfile: UserProfile, 
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>,
  onLogout: () => void 
}> = ({ userProfile, setUserProfile, onLogout }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'market' | 'portfolio' | 'leaderboard' | 'learning'>('dashboard');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const initial = await initializeStocks();
        setStocks(initial);
      } catch (err) {
        console.error("Failed to init stocks", err);
      }
    };
    init();
  }, []);

  // Performance Tracking & Price Updates
  useEffect(() => {
    if (stocks.length === 0 || !userProfile) return;

    const timer = setInterval(async () => {
      try {
        const updated = await updateStockPrices(stocks, selectedStock?.symbol);
        setStocks(updated);
        setIsLive(true);

        // Calculate New Total Net Worth for the history chart
        const holdingsValue = userProfile.holdings.reduce((acc, h) => {
          const stock = updated.find(s => s.symbol === h.symbol);
          return acc + (h.shares * (stock?.price || 0));
        }, 0);
        const currentTotal = holdingsValue + userProfile.cash;

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const newPerformanceHistory = [
          ...userProfile.performanceHistory,
          { time: now, price: currentTotal }
        ].slice(-50); // Keep last 50 data points

        const updatedUser = {
          ...userProfile,
          performanceHistory: newPerformanceHistory
        };

        setUserProfile(updatedUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
        
      } catch (err) {
        setIsLive(false);
      }
    }, PRICE_UPDATE_INTERVAL);

    return () => clearInterval(timer);
  }, [stocks, selectedStock, userProfile]);

  const handleTrade = (stock: Stock, shares: number, type: 'BUY' | 'SELL') => {
    if (!userProfile) return;
    try {
      const newUser = executeTrade(userProfile, stock, shares, type);
      
      // Also update performance history immediately upon trade
      const holdingsValue = newUser.holdings.reduce((acc, h) => {
        const s = stocks.find(st => st.symbol === h.symbol);
        return acc + (h.shares * (s?.price || 0));
      }, 0);
      const nowTotal = holdingsValue + newUser.cash;

      newUser.performanceHistory = [
        ...newUser.performanceHistory,
        { time: 'Trade', price: nowTotal }
      ].slice(-50);

      setUserProfile(newUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const portfolioValue = useMemo(() => {
    if (!userProfile) return 0;
    const holdingsValue = userProfile.holdings.reduce((acc, h) => {
      const stock = stocks.find(s => s.symbol === h.symbol);
      return acc + (h.shares * (stock?.price || 0));
    }, 0);
    return holdingsValue + userProfile.cash;
  }, [userProfile, stocks]);

  const navigateTo = (tab: any) => {
    setActiveTab(tab);
    setSelectedStock(null);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-black text-zinc-100 overflow-hidden font-mono">
      <aside className="hidden md:flex flex-col w-64 bg-black border-r border-zinc-900">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-yellow-400 rounded-sm flex items-center justify-center">
              <TrendingUp className="text-black w-5 h-5" />
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

        <div className="mt-auto p-6 border-t border-zinc-900">
          <div className="mb-4">
            <p className="text-[10px] text-yellow-400 font-bold mb-1">CASH BALANCE</p>
            <p className="text-lg font-bold text-white">${userProfile.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="flex items-center justify-between gap-3 p-3 bg-zinc-950 rounded-lg border border-zinc-900">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-sm bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-bold text-white truncate leading-tight">{userProfile.realName}</p>
                <p className="text-[9px] text-zinc-500 truncate">@{userProfile.username}</p>
              </div>
            </div>
            <button onClick={onLogout} className="text-zinc-600 hover:text-red-500 transition-colors" title="Log Out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-20 bg-black/95 border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
          <div className="md:hidden flex items-center gap-3">
             <button onClick={() => setIsMobileMenuOpen(true)}>
               <Menu className="text-white w-6 h-6" />
             </button>
             <span className="text-lg font-bold text-yellow-400">PaperTrade</span>
          </div>

          <div className="hidden md:flex items-center bg-zinc-950 border border-zinc-900 rounded-sm px-4 py-2 w-96">
            <Search className="text-zinc-600 w-4 h-4 mr-2" />
            <input type="text" placeholder="Search stocks..." className="bg-transparent text-xs text-white focus:outline-none w-full placeholder:text-zinc-700" />
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden lg:flex items-center gap-2">
              {isLive ? <Wifi className="w-3 h-3 text-yellow-400" /> : <WifiOff className="w-3 h-3 text-red-500" />}
              <span className="text-[9px] font-bold text-zinc-500">Market Live</span>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-500 font-bold">NET WORTH</p>
              <p className="text-sm font-bold text-yellow-400">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {selectedStock ? (
            <StockDetail stock={selectedStock} user={userProfile} onBack={() => setSelectedStock(null)} onTrade={handleTrade} />
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard user={userProfile} stocks={stocks} onSelectStock={setSelectedStock} portfolioValue={portfolioValue} onNavigate={navigateTo} />}
              {activeTab === 'market' && <MarketList stocks={stocks} onSelectStock={setSelectedStock} />}
              {activeTab === 'portfolio' && <PortfolioView user={userProfile} stocks={stocks} onSelectStock={setSelectedStock} />}
              {activeTab === 'leaderboard' && <Leaderboard user={userProfile} portfolioValue={portfolioValue} />}
              {activeTab === 'learning' && <Tutorials />}
            </>
          )}
        </div>

        <AIAssistant user={userProfile} stocks={stocks} portfolioValue={portfolioValue} />
      </main>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col p-6 animate-fade-in border-2 border-yellow-400">
          <div className="flex justify-between items-center mb-12">
            <span className="text-2xl font-bold text-yellow-400">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-8 h-8 text-white" /></button>
          </div>
          <nav className="space-y-6">
            <MobileNavItem label="Dashboard" onClick={() => navigateTo('dashboard')} active={activeTab === 'dashboard'} />
            <MobileNavItem label="Markets" onClick={() => navigateTo('market')} active={activeTab === 'market'} />
            <MobileNavItem label="Portfolio" onClick={() => navigateTo('portfolio')} active={activeTab === 'portfolio'} />
            <MobileNavItem label="Leaderboard" onClick={() => navigateTo('leaderboard')} active={activeTab === 'leaderboard'} />
            <MobileNavItem label="Learning" onClick={() => navigateTo('learning')} active={activeTab === 'learning'} />
            <button onClick={onLogout} className="text-xl font-bold text-red-500 mt-12 border-t border-zinc-900 pt-6 block w-full text-left uppercase">Log Out</button>
          </nav>
        </div>
      )}
    </div>
  );
};

const SidebarItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-100 ${active ? 'bg-yellow-400 text-black' : 'text-zinc-500 hover:text-yellow-400 hover:bg-zinc-950'}`}>
    {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
    <span className="text-sm font-semibold tracking-wide">{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ label: string, onClick: () => void, active: boolean }> = ({ label, onClick, active }) => (
  <button onClick={onClick} className={`block w-full text-left text-2xl font-bold ${active ? 'text-yellow-400' : 'text-white'}`}>{label}</button>
);

const LandingPage: React.FC<{ onComplete: (username: string, realName: string, league: { name: string, type: 'public' | 'private' }) => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [realName, setRealName] = useState('');
  const [leagueType, setLeagueType] = useState<'public' | 'private'>('public');
  const [leagueName, setLeagueName] = useState('Global Arena');

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && realName.trim()) {
      setStep(2);
    }
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(username.trim(), realName.trim(), {
      name: leagueType === 'public' ? 'Global PaperTrade Arena' : leagueName.trim(),
      type: leagueType
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6 font-mono">
      <div className="flex flex-col lg:flex-row items-center gap-16 max-w-6xl w-full">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="w-16 h-16 bg-yellow-400 rounded-sm flex items-center justify-center mx-auto lg:mx-0">
            <TrendingUp className="text-black w-10 h-10" />
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-white tracking-tight">
            Trade with <br />
            <span className="text-yellow-400 italic">the World</span>
          </h1>
          <p className="text-lg text-zinc-500 max-w-lg mx-auto lg:mx-0">
            Start with $100,000 in virtual capital. Join public global leagues or create a private arena for your friends.
          </p>
        </div>
        
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-8 rounded-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-yellow-400 uppercase">
              {step === 1 ? 'Step 1: Identity' : 'Step 2: League'}
            </h2>
            <span className="text-[10px] font-bold text-zinc-700">Step {step} of 2</span>
          </div>
          
          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="Enter your name" 
                    required
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-yellow-400 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest">Username</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    placeholder="Choose a handle" 
                    required
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-yellow-400 transition-all text-sm"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 rounded-sm transition-all flex items-center justify-center gap-2 group uppercase tracking-widest"
              >
                Continue
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleFinish} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setLeagueType('public')}
                  className={`p-4 border-2 flex flex-col items-center gap-3 transition-all rounded-md ${leagueType === 'public' ? 'border-yellow-400 bg-yellow-400/10' : 'border-zinc-800 bg-black text-zinc-500'}`}
                >
                  <Globe className={`w-8 h-8 ${leagueType === 'public' ? 'text-yellow-400' : 'text-zinc-700'}`} />
                  <span className="text-[10px] font-bold uppercase">Public Arena</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setLeagueType('private')}
                  className={`p-4 border-2 flex flex-col items-center gap-3 transition-all rounded-md ${leagueType === 'private' ? 'border-yellow-400 bg-yellow-400/10' : 'border-zinc-800 bg-black text-zinc-500'}`}
                >
                  <Lock className={`w-8 h-8 ${leagueType === 'private' ? 'text-yellow-400' : 'text-zinc-700'}`} />
                  <span className="text-[10px] font-bold uppercase">Private Room</span>
                </button>
              </div>

              {leagueType === 'private' && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest">League Name</label>
                  <input 
                    type="text" 
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    placeholder="Wolf Pack, Rivals, etc." 
                    required
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-yellow-400 transition-all text-sm"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-zinc-800 hover:border-zinc-500 text-zinc-500 py-4 rounded-sm transition-all flex items-center justify-center uppercase font-bold text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <button 
                  type="submit"
                  className="flex-[2] bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 rounded-sm transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
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

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setUserProfile(JSON.parse(saved));
    }
    setIsLoaded(true);
  }, []);

  const handleStart = (username: string, realName: string, league: { name: string, type: 'public' | 'private' }) => {
    const newUser = getInitialUser(username, realName, league);
    setUserProfile(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out? Your virtual progress will be cleared.")) {
      localStorage.removeItem(STORAGE_KEY);
      setUserProfile(null);
    }
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono">
      <div className="flex flex-col items-center">
        <TrendingUp className="text-yellow-400 w-12 h-12 mb-4 animate-pulse" />
        <span className="text-yellow-400 font-bold uppercase tracking-[0.2em] text-xs">Syncing data...</span>
      </div>
    </div>
  );

  return userProfile ? (
    <TradingApp userProfile={userProfile} setUserProfile={setUserProfile} onLogout={handleLogout} />
  ) : (
    <LandingPage onComplete={handleStart} />
  );
}

export default App;
