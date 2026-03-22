import React from 'react';
import { motion } from 'motion/react';
import { loginWithGoogle } from '../firebase';
import { LogIn, Shield, Zap, Target } from 'lucide-react';

export default function LoginScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-zinc-50 p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
      
      {/* Logo Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 text-center mb-12"
      >
        <div className="w-24 h-24 bg-emerald-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
          <Target size={48} className="text-emerald-400" />
        </div>
        <h1 className="text-5xl font-bold tracking-tighter mb-2 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
          SCRAPSCOUT
        </h1>
        <p className="text-zinc-500 font-mono text-sm tracking-widest uppercase">
          Neural Salvage Network v4.2
        </p>
      </motion.div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-2xl w-full z-10">
        {[
          { icon: Shield, title: "Secure Log", desc: "Encrypted salvage records" },
          { icon: Zap, title: "AI Analysis", desc: "Multimodal material detection" },
          { icon: Target, title: "Precision Hub", desc: "Real-time market tracking" }
        ].map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (i + 1) }}
            className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-sm text-center"
          >
            <f.icon size={20} className="text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
            <p className="text-xs text-zinc-500">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Login Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => loginWithGoogle()}
        className="z-10 flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-semibold shadow-xl shadow-white/10 transition-all hover:bg-zinc-200"
      >
        <LogIn size={20} />
        Initialize Neural Link
      </motion.button>

      <p className="mt-8 text-zinc-600 text-[10px] uppercase tracking-widest font-mono z-10">
        Authorized Personnel Only // System Ready
      </p>
    </div>
  );
}
