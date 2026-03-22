import { useState, useEffect } from 'react';
import { Opportunity } from '../types';
import { Calendar as CalendarIcon, MapPin, Loader2, Crown, Sparkles, Trash2, Home, Gavel } from 'lucide-react';
import { fetchOpportunities } from '../services/gemini';

interface CalendarScreenProps {
  legalMode: 'legal_only' | 'permission_hunter' | 'all';
  searchRadius: number;
}

export default function CalendarScreen({ legalMode, searchRadius }: CalendarScreenProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOpportunities = async (lat?: number, lng?: number) => {
      try {
        setIsLoading(true);
        const data = await fetchOpportunities(lat, lng, searchRadius);
        
        // Sort by date
        const sorted = data.sort((a: Opportunity, b: Opportunity) => {
          if (!a.start_date) return 1;
          if (!b.start_date) return -1;
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        });
        
        setOpportunities(sorted);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to fetch real-time opportunities');
      } finally {
        setIsLoading(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          loadOpportunities(latitude, longitude);
        },
        (error) => {
          console.warn("Geolocation error:", error);
          loadOpportunities();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      loadOpportunities();
    }
  }, [searchRadius]);

  const getCategoryIcon = (category: string) => {
    if (category.includes('bulk_trash')) return <Trash2 size={18} className="text-emerald-500" />;
    if (category.includes('estate_sale')) return <Home size={18} className="text-pink-500" />;
    if (category.includes('auction')) return <Gavel size={18} className="text-orange-500" />;
    if (category.includes('dumpster') || category.includes('retail')) return <Sparkles size={18} className="text-purple-500" />;
    return <MapPin size={18} className="text-gray-500" />;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Date TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const filteredOpportunities = opportunities.filter(opp => {
    if (legalMode === 'legal_only') return opp.legal_status === 'green';
    if (legalMode === 'permission_hunter') return opp.legal_status === 'green' || opp.legal_status === 'yellow';
    return true;
  });

  // Group opportunities by date
  const groupedOpportunities = filteredOpportunities.reduce((acc, opp) => {
    const date = opp.start_date || 'Upcoming';
    if (!acc[date]) acc[date] = [];
    acc[date].push(opp);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 font-sans relative">
      <div className="bg-zinc-950/60 backdrop-blur-2xl px-6 pt-10 pb-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-10 border-b border-white/5 sticky top-0">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 flex items-center gap-3 font-display uppercase tracking-widest drop-shadow-sm">
          <CalendarIcon className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" size={28} />
          Temporal Log
        </h1>
        <p className="text-[10px] text-emerald-400/80 mt-1.5 font-mono uppercase tracking-widest drop-shadow-[0_0_2px_rgba(16,185,129,0.5)]">Upcoming events & AI predictions</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative z-0 hide-scrollbar">
        {/* Background ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 relative z-10">
            <div className="relative mb-6">
              <Loader2 className="animate-spin text-emerald-400 relative z-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" size={48} />
              <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 animate-pulse" />
            </div>
            <p className="font-bold tracking-[0.2em] uppercase font-display text-zinc-400 animate-pulse drop-shadow-sm text-lg">Syncing Timeline...</p>
            <p className="text-[10px] text-zinc-600 font-mono mt-2 tracking-widest">Analyzing schedules & predictions</p>
          </div>
        ) : error ? (
          <div className="text-center text-red-400 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl shadow-[0_0_30px_rgba(239,68,68,0.1)] backdrop-blur-md relative z-10">
            <p className="font-bold mb-3 font-display uppercase tracking-[0.2em] drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">Sync Failed</p>
            <p className="text-xs font-mono">{error}</p>
          </div>
        ) : (
          <div className="space-y-8 pb-24 relative z-10">
            {Object.entries(groupedOpportunities).map(([date, opps]) => (
              <div key={date} className="relative">
                <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl py-3 mb-4 border-b border-white/5 -mx-6 px-6">
                  <h2 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] font-mono flex items-center gap-2 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {formatDate(date)}
                  </h2>
                </div>
                <div className="space-y-4">
                  {opps.map((opp, index) => (
                    <div 
                      key={opp.id} 
                      className="bg-zinc-900/50 backdrop-blur-md rounded-3xl p-5 shadow-lg border border-white/5 relative overflow-hidden transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-float group hover:-translate-y-1"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {/* Hover glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent rounded-3xl transition-colors duration-500 pointer-events-none" />
                      
                      {/* Left color bar indicating legal status */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 shadow-[0_0_10px_currentColor] ${
                        opp.legal_status === 'green' ? 'bg-emerald-400 text-emerald-400' :
                        opp.legal_status === 'yellow' ? 'bg-amber-400 text-amber-400' : 'bg-red-400 text-red-400'
                      }`} />
                      
                      <div className="pl-4 relative z-10">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-zinc-950/80 border border-white/5 shadow-sm group-hover:border-emerald-500/20 transition-colors">
                              {getCategoryIcon(opp.category)}
                            </div>
                            <h3 className="font-bold text-zinc-100 leading-tight font-display uppercase tracking-widest text-lg group-hover:text-emerald-50 transition-colors">{opp.title}</h3>
                          </div>
                          {opp.is_founder_exclusive && (
                            <div className="bg-purple-500/10 text-purple-400 p-2 rounded-xl border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)] backdrop-blur-md">
                              <Crown size={16} className="drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
                            </div>
                          )}
                        </div>
                        
                        <p className="text-xs text-zinc-400 mb-4 line-clamp-3 font-mono leading-relaxed group-hover:text-zinc-300 transition-colors">{opp.description}</p>
                        
                        <div className="flex items-center justify-between border-t border-white/5 pt-4">
                          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em] bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-white/5">
                            <MapPin size={12} className="text-emerald-400" />
                            <span className="truncate max-w-[150px]">{opp.city}, {opp.county}</span>
                          </div>
                          
                          {opp.estimated_total_value && (
                            <div className="text-right bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                              <span className="text-[8px] font-bold text-emerald-500/80 uppercase tracking-[0.2em] block font-mono mb-0.5">Est. Value</span>
                              <span className="font-bold text-emerald-400 font-mono text-sm drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">${opp.estimated_total_value}</span>
                            </div>
                          )}
                        </div>
                        
                        {opp.category.includes('dumpster') && (
                          <div className="mt-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3 shadow-[0_0_15px_rgba(168,85,247,0.05)] backdrop-blur-md">
                            <Sparkles size={16} className="text-purple-400 mt-0.5 shrink-0 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
                            <p className="text-[10px] text-purple-300/80 font-mono leading-relaxed tracking-wide">
                              <span className="font-bold text-purple-400 tracking-[0.2em]">AI PREDICTION:</span> High probability of valuable retail discards based on historical patterns and seasonal changes.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
