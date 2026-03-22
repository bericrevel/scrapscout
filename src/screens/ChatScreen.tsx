import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Sparkles, Loader2, Terminal, ShieldCheck, Zap } from 'lucide-react';
import Markdown from 'react-markdown';
import { getGeminiClient } from '../services/gemini';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Scout-AI Online. I'm your tactical salvage assistant. How can I help you optimize your haul today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: input,
        config: {
          systemInstruction: "You are Scout-AI, a tactical salvage and scrap metal expert. You help users identify high-value scrap, understand market trends, and optimize their salvage routes. Be concise, professional, and slightly futuristic/tactical in your tone.",
        },
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "I'm sorry, I couldn't process that request. Signal interference detected.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "CRITICAL ERROR: Connection to neural link lost. Please check your uplink.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] font-mono relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-950/50 backdrop-blur-xl relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Bot size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-[0.2em] uppercase text-zinc-100">Scout-AI</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-emerald-400/80 tracking-widest uppercase font-bold">Neural Link Active</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Signal Strength</span>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`w-1 h-2 rounded-full ${i <= 3 ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  message.role === 'user' 
                    ? 'bg-zinc-900 border-white/10 text-zinc-400' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-zinc-900 border border-white/5 text-zinc-100 rounded-tr-none'
                    : 'bg-zinc-900/50 backdrop-blur-md border border-white/5 text-zinc-300 rounded-tl-none'
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none prose-emerald">
                    <Markdown>{message.content}</Markdown>
                  </div>
                  <div className={`text-[8px] mt-2 uppercase tracking-widest opacity-30 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-white/5 text-emerald-400/60 italic text-xs tracking-widest flex items-center gap-2">
                <Terminal size={12} className="animate-pulse" />
                Processing neural data...
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-zinc-950/80 backdrop-blur-2xl border-t border-white/5 relative z-10 pb-32">
        <div className="max-w-3xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
          <div className="relative flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-2xl p-2 pl-4 shadow-2xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Query Scout-AI..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-100 placeholder:text-zinc-600 tracking-wide"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading
                  ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-90'
                  : 'bg-zinc-800 text-zinc-600'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide max-w-3xl mx-auto">
          {[
            { label: 'Market Analysis', icon: TrendingUp },
            { label: 'Identify Material', icon: Sparkles },
            { label: 'Safety Check', icon: ShieldCheck },
            { label: 'Power Up', icon: Zap },
          ].map((action, i) => (
            <button
              key={i}
              onClick={() => setInput(action.label)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-zinc-900/50 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center gap-2"
            >
              <action.icon size={10} />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mock icon for TrendingUp if not imported from lucide-react in this scope
const TrendingUp = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);
