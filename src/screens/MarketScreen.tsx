import { useState, useEffect } from 'react';
import { fetchMarketData, MarketData } from '../services/gemini';
import { TrendingUp, TrendingDown, Minus, Lock, RefreshCw, ShieldAlert, BarChart3 } from 'lucide-react';
import { ScannedItem } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MarketScreenProps {
  subscriptionStatus: 'inactive' | 'pro' | 'founder';
  items: ScannedItem[];
}

const MOCK_HISTORICAL_DATA = [
  { day: 'Day 1', copper: 3.45, aluminum: 0.58, brass: 1.95 },
  { day: 'Day 5', copper: 3.52, aluminum: 0.60, brass: 2.05 },
  { day: 'Day 10', copper: 3.68, aluminum: 0.62, brass: 2.15 },
  { day: 'Day 15', copper: 3.60, aluminum: 0.65, brass: 2.10 },
  { day: 'Day 20', copper: 3.75, aluminum: 0.63, brass: 2.20 },
  { day: 'Day 25', copper: 3.85, aluminum: 0.65, brass: 2.15 },
];

export default function MarketScreen({ subscriptionStatus, items }: MarketScreenProps) {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'copper' | 'aluminum' | 'brass'>('copper');

  const totalPortfolioValue = items.reduce((sum, item) => sum + (item.resale_value || 0), 0);
  const scrapValue = items.reduce((sum, item) => sum + (item.scrap_value || 0), 0);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchMarketData();
    setMarketData(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [subscriptionStatus]);

  return (
    <div className="h-full bg-zinc-950 flex flex-col font-mono">
      <div className="p-5 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 tracking-widest uppercase font-display drop-shadow-sm">Market Watch</h1>
          <p className="text-[10px] text-emerald-400/80 tracking-widest mt-0.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE AI ANALYSIS
          </p>
        </div>
        <button 
          onClick={loadData}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Portfolio Summary */}
        <div className="bg-zinc-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/5 relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full blur-3xl" />
          <div className="flex justify-between items-end relative z-10">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Portfolio Value</p>
              <p className="text-3xl font-bold text-emerald-400 font-mono drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Scrap Value</p>
              <p className="text-sm font-bold text-emerald-400 font-mono flex items-center justify-end gap-1">
                ${scrapValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Market Trends Chart */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-emerald-400" />
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-widest">30-Day Trends</h3>
            </div>
            <div className="flex gap-1">
              {(['copper', 'aluminum', 'brass'] as const).map((metal) => (
                <button
                  key={metal}
                  onClick={() => setActiveChart(metal)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                    activeChart === metal 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-zinc-950 text-zinc-500 border border-white/5'
                  }`}
                >
                  {metal}
                </button>
              ))}
            </div>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_HISTORICAL_DATA}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#71717a', fontSize: 9 }}
                  dy={10}
                />
                <YAxis 
                  hide 
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                  labelStyle={{ color: '#71717a', fontSize: '9px', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey={activeChart} 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-emerald-400 animate-pulse">
            <p className="font-bold tracking-[0.3em] uppercase mb-3 font-display">Syncing with Markets...</p>
            <p className="text-[10px] opacity-80 tracking-widest">Fetching live metal indices</p>
          </div>
        ) : (
          marketData.map((data, idx) => (
            <div key={idx} className="bg-zinc-900/50 border border-white/5 rounded-3xl p-5 shadow-lg relative overflow-hidden group">
              {/* Background gradient based on recommendation */}
              <div className={`absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20 ${
                data.recommendation === 'Sell' ? 'bg-gradient-to-br from-emerald-500 to-transparent' : 'bg-gradient-to-br from-amber-500 to-transparent'
              }`} />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100 tracking-widest uppercase">{data.metal}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold text-zinc-300">{data.current_price}</span>
                      {data.trend === 'up' && <TrendingUp size={18} className="text-emerald-400" />}
                      {data.trend === 'down' && <TrendingDown size={18} className="text-red-400" />}
                      {data.trend === 'flat' && <Minus size={18} className="text-zinc-400" />}
                    </div>
                  </div>
                  
                  <div className={`px-4 py-2 rounded-xl border font-bold uppercase tracking-widest text-xs ${
                    data.recommendation === 'Sell' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  }`}>
                    {data.recommendation}
                  </div>
                </div>
                
                <div className="bg-zinc-950/50 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert size={14} className="text-purple-400" />
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">AI Rationale</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{data.reasoning}</p>
                </div>

                <div className="flex gap-2 mt-4">
                  <button className="flex-1 py-2.5 rounded-xl font-bold text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm hover:bg-emerald-500/20 transition-colors uppercase tracking-widest flex items-center justify-center gap-2">
                    Buy
                  </button>
                  <button className="flex-1 py-2.5 rounded-xl font-bold text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm hover:bg-red-500/20 transition-colors uppercase tracking-widest flex items-center justify-center gap-2">
                    Sell
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
