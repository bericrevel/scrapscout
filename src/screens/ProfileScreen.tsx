import { useState } from 'react';
import { ShieldAlert, BookOpen, MapPin, Bell, Settings, ChevronRight, Crown, CheckCircle2, Loader2, X, BellOff, LogOut } from 'lucide-react';
import Markdown from 'react-markdown';
import { fetchLaws, fetchTemplates } from '../services/gemini';
import { useFirebase } from '../components/FirebaseProvider';
import { logout } from '../firebase';

interface ProfileScreenProps {
  legalMode: 'legal_only' | 'permission_hunter' | 'all';
  setLegalMode: (mode: 'legal_only' | 'permission_hunter' | 'all') => void;
  searchRadius: number;
  setSearchRadius: (radius: number) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  subscriptionStatus: 'inactive' | 'pro' | 'founder';
}

export default function ProfileScreen({ 
  legalMode, 
  setLegalMode, 
  searchRadius, 
  setSearchRadius, 
  notificationsEnabled, 
  setNotificationsEnabled,
  subscriptionStatus
}: ProfileScreenProps) {
  const { user } = useFirebase();
  const [modalContent, setModalContent] = useState<{ title: string; content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchLaws = async () => {
    try {
      setIsLoading(true);
      setModalContent({ title: 'Texas Salvage Laws', content: '' });
      const text = await fetchLaws();
      setModalContent({ title: 'Texas Salvage Laws', content: text });
    } catch (error) {
      console.error(error);
      setModalContent({ title: 'Texas Salvage Laws', content: 'Failed to load content. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchTemplates = async () => {
    try {
      setIsLoading(true);
      setModalContent({ title: 'Permission Templates', content: '' });
      const text = await fetchTemplates();
      setModalContent({ title: 'Permission Templates', content: text });
    } catch (error) {
      console.error(error);
      setModalContent({ title: 'Permission Templates', content: 'Failed to load content. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const cycleSearchRadius = () => {
    const options = [5, 10, 25, 50, 65, 100, 250];
    const currentIndex = options.indexOf(searchRadius);
    const nextIndex = (currentIndex + 1) % options.length;
    setSearchRadius(options[nextIndex]);
  };

  const cycleLegalMode = () => {
    const options: ('legal_only' | 'permission_hunter' | 'all')[] = ['legal_only', 'permission_hunter', 'all'];
    const currentIndex = options.indexOf(legalMode);
    const nextIndex = (currentIndex + 1) % options.length;
    setLegalMode(options[nextIndex]);
  };

  const getLegalModeLabel = () => {
    if (legalMode === 'legal_only') return <span className="text-sm text-green-600 font-medium">Legal Only</span>;
    if (legalMode === 'permission_hunter') return <span className="text-sm text-yellow-600 font-medium">+ Permission</span>;
    return <span className="text-sm text-red-400 font-medium">All (High Risk)</span>;
  };

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 overflow-y-auto relative font-sans">
      <div className="bg-zinc-950/60 backdrop-blur-2xl px-6 pt-10 pb-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-white/5 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 font-bold text-3xl relative border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)] font-display overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
              ) : (
                user?.displayName?.[0] || 'B'
              )}
              <div className="absolute -bottom-2 -right-2 bg-purple-500/20 text-purple-300 p-1.5 rounded-xl border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.3)] backdrop-blur-md">
                <Crown size={14} className="drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 flex items-center gap-2 font-display uppercase tracking-widest drop-shadow-sm">
                {user?.displayName || 'bericrevel'}
              </h1>
              <p className="text-[10px] text-emerald-400/80 font-mono tracking-[0.2em] uppercase mt-1.5 drop-shadow-[0_0_2px_rgba(16,185,129,0.5)]">San Antonio, TX</p>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="p-3 bg-zinc-900/50 border border-white/5 rounded-2xl text-zinc-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8 pb-24 hide-scrollbar relative z-0">
        {/* Background ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
        
        {/* Scrapper Stats Dashboard */}
        <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
          <div className="bg-zinc-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full blur-2xl" />
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">$1,240</p>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full blur-2xl" />
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">CO2 Offset</p>
            <p className="text-2xl font-bold text-purple-400 font-mono drop-shadow-[0_0_5px_rgba(168,85,247,0.3)]">450 lbs</p>
          </div>
          <div className="col-span-2 bg-zinc-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/5 relative overflow-hidden flex justify-between items-center">
            <div>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Scrapper Level</p>
              <p className="text-xl font-bold text-zinc-100 font-display uppercase tracking-widest">Scrap Lord</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Active Streak</p>
              <p className="text-xl font-bold text-amber-400 font-mono drop-shadow-[0_0_5px_rgba(245,158,11,0.3)]">14 Days</p>
            </div>
          </div>
        </div>

        {/* Active Subscription Banner */}
        {subscriptionStatus !== 'inactive' && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 flex gap-4 shadow-[0_0_30px_rgba(16,185,129,0.1)] mb-6 animate-in slide-in-from-top-4 backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
            <CheckCircle2 className="text-emerald-400 shrink-0 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] relative z-10" size={28} />
            <div className="relative z-10">
              <h3 className="font-bold text-emerald-300 mb-1.5 font-display uppercase tracking-widest text-sm drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">
                {subscriptionStatus === 'founder' ? 'Founder Edition Active' : 'Pro Edition Active'}
              </h3>
              <p className="text-[10px] text-emerald-400/80 leading-relaxed font-mono tracking-wide">
                {subscriptionStatus === 'founder' 
                  ? 'Welcome to the Founder Edition. All premium features are permanently unlocked.' 
                  : 'Welcome to the Pro Edition. Premium features are now unlocked.'}
              </p>
            </div>
          </div>
        )}

        {/* Founder Tier Card */}
        <div className="bg-zinc-900/50 backdrop-blur-md rounded-[2rem] p-8 text-zinc-50 shadow-[0_0_40px_rgba(168,85,247,0.05)] border border-purple-500/20 relative overflow-hidden animate-float group hover:border-purple-500/40 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none group-hover:from-purple-500/10 transition-colors" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-colors" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)] group-hover:border-purple-500/40 transition-colors">
                <Crown size={24} className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-purple-300 font-display uppercase tracking-widest drop-shadow-[0_0_5px_rgba(168,85,247,0.3)]">Founder Edition</h2>
                <p className="text-[10px] text-purple-400/80 font-mono mt-1 tracking-widest uppercase">Limited: 17/100 Spots Left</p>
              </div>
            </div>
            {subscriptionStatus === 'founder' ? (
              <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(168,85,247,0.2)] font-mono">Active</span>
            ) : (
              <span className="bg-zinc-950/80 border border-white/5 text-zinc-500 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] font-mono">Lifetime</span>
            )}
          </div>
          
          <ul className="space-y-4 mb-8 relative z-10">
            <li className="flex items-center gap-4 text-sm text-zinc-300 font-mono tracking-wide">
              <CheckCircle2 size={18} className={subscriptionStatus === 'founder' ? "text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" : "text-zinc-600"} />
              <span className={subscriptionStatus === 'founder' ? "text-zinc-100" : "text-zinc-400"}>Lifetime access to all features</span>
            </li>
            <li className="flex items-center gap-4 text-sm text-zinc-300 font-mono tracking-wide">
              <CheckCircle2 size={18} className={subscriptionStatus === 'founder' ? "text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" : "text-zinc-600"} />
              <span className={subscriptionStatus === 'founder' ? "text-zinc-100" : "text-zinc-400"}>Live Market Watch & AI Price Predictor</span>
            </li>
            <li className="flex items-center gap-4 text-sm text-zinc-300 font-mono tracking-wide">
              <CheckCircle2 size={18} className={subscriptionStatus === 'founder' ? "text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" : "text-zinc-600"} />
              <span className={subscriptionStatus === 'founder' ? "text-zinc-100" : "text-zinc-400"}>AI Negotiation Assistant</span>
            </li>
            <li className="flex items-center gap-4 text-sm text-zinc-300 font-mono tracking-wide">
              <CheckCircle2 size={18} className={subscriptionStatus === 'founder' ? "text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" : "text-zinc-600"} />
              <span className={subscriptionStatus === 'founder' ? "text-zinc-100" : "text-zinc-400"}>"First Strike" Route Optimizer</span>
            </li>
          </ul>

          {subscriptionStatus !== 'founder' && (
            <button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: 'founder' })
                  });
                  const data = await response.json();
                  if (data.url) {
                    window.location.href = data.url;
                  }
                } catch (error) {
                  console.error('Failed to initiate checkout:', error);
                }
              }}
              className="w-full mt-4 bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold py-4 rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-purple-500/30 transition-all shadow-[0_0_20px_rgba(168,85,247,0.15)] relative z-10 flex items-center justify-center gap-2 font-mono active:scale-[0.98]"
            >
              <Crown size={16} className="drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" /> Upgrade to Founder ($250.00)
            </button>
          )}
        </div>

        {/* Pro Tier Card */}
        {subscriptionStatus !== 'founder' && (
          <div className="bg-zinc-900/50 backdrop-blur-md rounded-[2rem] p-8 text-zinc-50 shadow-[0_0_40px_rgba(16,185,129,0.05)] border border-emerald-500/20 relative overflow-hidden animate-float group hover:border-emerald-500/40 transition-colors" style={{ animationDelay: '0.2s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none group-hover:from-emerald-500/10 transition-colors" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:border-emerald-500/40 transition-colors">
                  <Settings size={24} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <h2 className="font-bold text-xl text-emerald-300 font-display uppercase tracking-widest drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">Pro Edition</h2>
              </div>
              {subscriptionStatus === 'pro' ? (
                <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(16,185,129,0.2)] font-mono">Active</span>
              ) : (
                <span className="bg-zinc-950/80 border border-white/5 text-zinc-500 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] font-mono">Inactive</span>
              )}
            </div>
            
            <ul className="space-y-4 mb-8 relative z-10">
              <li className="flex items-center gap-4 text-sm text-zinc-300 font-mono tracking-wide">
                <CheckCircle2 size={18} className={subscriptionStatus === 'pro' ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "text-zinc-600"} />
                <span className={subscriptionStatus === 'pro' ? "text-zinc-100" : "text-zinc-400"}>Live Market Watch</span>
              </li>
              <li className="flex items-center gap-4 text-sm text-zinc-300 font-mono tracking-wide">
                <CheckCircle2 size={18} className={subscriptionStatus === 'pro' ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "text-zinc-600"} />
                <span className={subscriptionStatus === 'pro' ? "text-zinc-100" : "text-zinc-400"}>AI Negotiation Assistant</span>
              </li>
              <li className="flex items-center gap-4 text-sm text-zinc-300 font-mono tracking-wide">
                <CheckCircle2 size={18} className={subscriptionStatus === 'pro' ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "text-zinc-600"} />
                <span className={subscriptionStatus === 'pro' ? "text-zinc-100" : "text-zinc-400"}>"First Strike" Route Optimizer</span>
              </li>
            </ul>

            {subscriptionStatus !== 'pro' && (
              <div className="flex gap-4 mt-4 relative z-10">
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/create-checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plan: 'pro_monthly' })
                      });
                      const data = await response.json();
                      if (data.url) {
                        window.location.href = data.url;
                      }
                    } catch (error) {
                      console.error('Failed to initiate checkout:', error);
                    }
                  }}
                  className="flex-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold py-4 rounded-2xl uppercase tracking-[0.2em] text-[9px] hover:bg-emerald-500/30 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] font-mono active:scale-[0.98]"
                >
                  Monthly ($19.99)
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/create-checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plan: 'pro_yearly' })
                      });
                      const data = await response.json();
                      if (data.url) {
                        window.location.href = data.url;
                      }
                    } catch (error) {
                      console.error('Failed to initiate checkout:', error);
                    }
                  }}
                  className="flex-1 bg-zinc-950/80 text-emerald-400/80 border border-emerald-500/20 font-bold py-4 rounded-2xl uppercase tracking-[0.2em] text-[9px] hover:bg-zinc-900 transition-all hover:text-emerald-400 hover:border-emerald-500/40 font-mono active:scale-[0.98]"
                >
                  Yearly ($99.00)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Legal Warning Card */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-[2rem] p-6 flex gap-5 shadow-[0_0_30px_rgba(239,68,68,0.05)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent pointer-events-none" />
          <ShieldAlert className="text-red-400 shrink-0 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)] relative z-10" size={28} />
          <div className="relative z-10">
            <h3 className="font-bold text-red-300 mb-1.5 font-display uppercase tracking-[0.2em] text-sm drop-shadow-[0_0_5px_rgba(239,68,68,0.3)]">Legal Compliance</h3>
            <p className="text-[10px] text-red-400/80 leading-relaxed font-mono tracking-wide">
              Always respect private property. Commercial container salvaging is prohibited in some Texas cities (e.g., Austin). Stick to green zones (curbside) or ask for permission.
            </p>
          </div>
        </div>

        {/* Settings Groups */}
        <div className="space-y-8">
          <div>
            <h2 className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-[0.2em] mb-4 ml-6 font-mono drop-shadow-[0_0_2px_rgba(16,185,129,0.3)]">Preferences</h2>
            <div className="bg-zinc-900/50 backdrop-blur-md rounded-[2rem] border border-white/5 overflow-hidden shadow-lg">
              <button className="w-full flex items-center justify-between p-6 border-b border-white/5 hover:bg-zinc-900/80 transition-all group" onClick={cycleSearchRadius}>
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-zinc-950/80 rounded-2xl border border-white/5 group-hover:border-emerald-500/30 transition-all shadow-sm">
                    <MapPin className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" size={20} />
                  </div>
                  <span className="font-bold text-zinc-100 font-display text-sm uppercase tracking-widest group-hover:text-emerald-50 transition-colors">Search Radius</span>
                </div>
                <div className="flex items-center gap-4 text-zinc-500">
                  <span className="text-[10px] font-mono font-bold text-emerald-400/80 tracking-[0.2em]">{searchRadius} MILES</span>
                  <ChevronRight size={18} className="group-hover:text-emerald-400 transition-colors" />
                </div>
              </button>
              <button className="w-full flex items-center justify-between p-6 border-b border-white/5 hover:bg-zinc-900/80 transition-all group" onClick={() => setNotificationsEnabled(!notificationsEnabled)}>
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-zinc-950/80 rounded-2xl border border-white/5 group-hover:border-emerald-500/30 transition-all shadow-sm">
                    {notificationsEnabled ? <Bell className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" size={20} /> : <BellOff className="text-zinc-600" size={20} />}
                  </div>
                  <span className="font-bold text-zinc-100 font-display text-sm uppercase tracking-widest group-hover:text-emerald-50 transition-colors">Notifications</span>
                </div>
                <div className="flex items-center gap-4 text-zinc-500">
                  <span className={`text-[10px] font-mono font-bold tracking-[0.2em] ${notificationsEnabled ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]' : 'text-zinc-600'}`}>
                    {notificationsEnabled ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  <ChevronRight size={18} className="group-hover:text-emerald-400 transition-colors" />
                </div>
              </button>
              <button className="w-full flex items-center justify-between p-6 hover:bg-zinc-900/80 transition-all group" onClick={cycleLegalMode}>
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-zinc-950/80 rounded-2xl border border-white/5 group-hover:border-emerald-500/30 transition-all shadow-sm">
                    <Settings className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" size={20} />
                  </div>
                  <span className="font-bold text-zinc-100 font-display text-sm uppercase tracking-widest group-hover:text-emerald-50 transition-colors">Legal Mode</span>
                </div>
                <div className="flex items-center gap-4 text-zinc-500">
                  <span className="font-mono uppercase tracking-[0.2em] text-[10px] font-bold">{getLegalModeLabel()}</span>
                  <ChevronRight size={18} className="group-hover:text-emerald-400 transition-colors" />
                </div>
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-[0.2em] mb-4 ml-6 font-mono drop-shadow-[0_0_2px_rgba(16,185,129,0.3)]">Resources</h2>
            <div className="bg-zinc-900/50 backdrop-blur-md rounded-[2rem] border border-white/5 overflow-hidden shadow-lg">
              <button 
                className="w-full flex items-center justify-between p-6 border-b border-white/5 hover:bg-zinc-900/80 transition-all group"
                onClick={handleFetchLaws}
              >
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-zinc-950/80 rounded-2xl border border-white/5 group-hover:border-emerald-500/30 transition-all shadow-sm">
                    <BookOpen className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" size={20} />
                  </div>
                  <span className="font-bold text-zinc-100 font-display text-sm uppercase tracking-widest group-hover:text-emerald-50 transition-colors">Texas Salvage Laws</span>
                </div>
                <ChevronRight className="text-zinc-500 group-hover:text-emerald-400 transition-colors" size={18} />
              </button>
              <button 
                className="w-full flex items-center justify-between p-6 hover:bg-zinc-900/80 transition-all group"
                onClick={handleFetchTemplates}
              >
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-zinc-950/80 rounded-2xl border border-white/5 group-hover:border-emerald-500/30 transition-all shadow-sm">
                    <ShieldAlert className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" size={20} />
                  </div>
                  <span className="font-bold text-zinc-100 font-display text-sm uppercase tracking-widest group-hover:text-emerald-50 transition-colors">Permission Templates</span>
                </div>
                <ChevronRight className="text-zinc-500 group-hover:text-emerald-400 transition-colors" size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Content Modal */}
      {modalContent && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <h2 className="font-bold text-emerald-400 flex items-center gap-2 tracking-widest uppercase text-xs font-display drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                <BookOpen size={16} className="text-emerald-400" />
                {modalContent.title}
              </h2>
              <button 
                onClick={() => setModalContent(null)}
                className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-emerald-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 relative hide-scrollbar">
              {/* Matrix Background Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-emerald-500 relative z-10">
                  <div className="relative">
                    <Loader2 className="animate-spin mb-4 text-emerald-400 relative z-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" size={40} />
                    <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 animate-pulse" />
                  </div>
                  <p className="text-[10px] font-medium tracking-widest uppercase font-mono animate-pulse text-emerald-400/80">Accessing Databanks...</p>
                </div>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-zinc-300 relative z-10 font-mono text-xs leading-relaxed">
                  <Markdown>{modalContent.content}</Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
