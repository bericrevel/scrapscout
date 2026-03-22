import { Lock, Crown, Zap, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface PaywallScreenProps {
  featureName: string;
  onClose?: () => void;
}

export default function PaywallScreen({ featureName, onClose }: PaywallScreenProps) {
  const handleUpgrade = (plan: 'pro_monthly' | 'pro_yearly' | 'founder') => {
    // Check if Web2wave is configured
    const web2waveUrl = import.meta.env.VITE_WEB2WAVE_URL;
    
    if (web2waveUrl) {
      // Redirect to Web2wave funnel
      // We append the plan and a return URL so the user comes back after payment
      const returnUrl = encodeURIComponent(`${window.location.origin}?success=true&plan=${plan}`);
      const funnelUrl = web2waveUrl.includes('?') 
        ? `${web2waveUrl}&plan=${plan}&return_url=${returnUrl}`
        : `${web2waveUrl}?plan=${plan}&return_url=${returnUrl}`;
      
      window.location.href = funnelUrl;
      return;
    }

    // Fallback to local Stripe integration
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) {
          window.location.href = data.url;
        }
      })
      .catch((err) => console.error('Error:', err));
  };

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col font-sans relative overflow-y-auto hide-scrollbar">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-900/20 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center pt-16 pb-24 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative">
          <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping opacity-20" />
          <Lock size={32} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        </div>
        
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 tracking-widest uppercase font-display mb-4">
          Unlock {featureName}
        </h1>
        
        <p className="text-zinc-400 max-w-sm mb-10 font-mono text-sm leading-relaxed">
          You've discovered a premium feature. Upgrade your scanner to access real-time market data, AI predictions, and advanced filters.
        </p>

        <div className="w-full max-w-md space-y-4">
          {/* Pro Plan */}
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 text-left relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <h3 className="text-xl font-bold text-zinc-100 tracking-widest uppercase font-display flex items-center gap-2">
                  <Zap size={20} className="text-emerald-400" />
                  Pro Edition
                </h3>
                <p className="text-emerald-400 font-mono mt-1">$19.99 / month</p>
              </div>
            </div>

            <ul className="space-y-3 mb-6 relative z-10">
              {['Unlimited AI Scans', 'Live Market Watch', 'Temporal Log (Calendar)', 'AI Negotiator Scripts'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-300 font-mono">
                  <CheckCircle2 size={16} className="text-emerald-500/70 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              onClick={() => handleUpgrade('pro_monthly')}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm hover:bg-emerald-500/20 transition-colors uppercase tracking-widest relative z-10 flex items-center justify-center gap-2"
            >
              Start Pro Subscription <ArrowRight size={16} />
            </button>
          </div>

          {/* Founder Plan */}
          <div className="bg-gradient-to-br from-purple-900/20 to-zinc-900/50 backdrop-blur-md border border-purple-500/30 rounded-3xl p-6 text-left relative overflow-hidden group hover:border-purple-500/50 transition-colors shadow-[0_0_30px_rgba(168,85,247,0.1)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full blur-2xl group-hover:bg-purple-500/20 transition-colors" />
            
            <div className="absolute -top-3 -right-3 bg-purple-500 text-white text-[10px] font-bold uppercase tracking-widest px-6 py-1.5 rotate-45 shadow-lg">
              LIFETIME
            </div>

            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <h3 className="text-xl font-bold text-zinc-100 tracking-widest uppercase font-display flex items-center gap-2">
                  <Crown size={20} className="text-purple-400" />
                  Founder Edition
                </h3>
                <p className="text-purple-400 font-mono mt-1">$250.00 one-time</p>
                <div className="mt-2 inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 px-2 py-1 rounded text-[10px] font-bold text-purple-300 uppercase tracking-widest font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Only 17/100 Spots Left
                </div>
              </div>
            </div>

            <ul className="space-y-3 mb-6 relative z-10">
              {['Everything in Pro', 'Lifetime Access (No Sub)', '2-Hour Early Event Access', 'Priority Support'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-300 font-mono">
                  <ShieldCheck size={16} className="text-purple-500/70 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              onClick={() => handleUpgrade('founder')}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:bg-purple-500/30 transition-colors uppercase tracking-widest relative z-10 flex items-center justify-center gap-2"
            >
              Become a Founder <ArrowRight size={16} />
            </button>
          </div>
        </div>
        
        {onClose && (
          <button 
            onClick={onClose}
            className="mt-8 text-zinc-500 hover:text-zinc-300 font-mono text-xs uppercase tracking-widest underline underline-offset-4"
          >
            Return to Map
          </button>
        )}
      </div>
    </div>
  );
}
