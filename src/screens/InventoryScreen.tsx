import { useState, useEffect } from 'react';
import { ScannedItem } from '../types';
import { PackageOpen, DollarSign, Loader2, X, MapPin, ShieldAlert, Cpu, Download, MessageSquare, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { findBuyers as fetchBuyers, generateNegotiationScript } from '../services/gemini';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InventoryScreenProps {
  items: ScannedItem[];
  subscriptionStatus: 'inactive' | 'pro' | 'founder';
  onDeleteItem: (id: string) => void;
}

const getRarity = (value: number) => {
  if (value >= 100) return { name: 'LEGENDARY', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-950/30', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]' };
  if (value >= 25) return { name: 'RARE', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-950/30', shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]' };
  return { name: 'COMMON', color: 'text-zinc-400', border: 'border-zinc-800', bg: 'bg-zinc-950', shadow: '' };
};

const DecryptText = ({ text, isDecrypting }: { text: string, isDecrypting: boolean }) => {
  const [display, setDisplay] = useState(text);
  
  useEffect(() => {
    if (!isDecrypting) {
      setDisplay(text);
      return;
    }
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
    let iterations = 0;
    const interval = setInterval(() => {
      setDisplay(text.split('').map((char, index) => {
        if (index < iterations) return char;
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      
      if (iterations >= text.length) clearInterval(interval);
      iterations += 1;
    }, 20);
    
    return () => clearInterval(interval);
  }, [text, isDecrypting]);

  return <span>{display}</span>;
};

export default function InventoryScreen({ items, subscriptionStatus, onDeleteItem }: InventoryScreenProps) {
  const [buyerContent, setBuyerContent] = useState<{ itemName: string; content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  
  // Negotiation State
  const [negotiationItem, setNegotiationItem] = useState<ScannedItem | null>(null);
  const [askingPrice, setAskingPrice] = useState('');
  const [negotiationScript, setNegotiationScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  const totalValue = items.reduce((sum, item) => sum + (item.resale_value || 0), 0);
  const totalScrap = items.reduce((sum, item) => sum + (item.scrap_value || 0), 0);

  const findBuyers = async (item: ScannedItem) => {
    try {
      setIsLoading(true);
      setIsDecrypting(true);
      setBuyerContent({ itemName: item.item_name, content: 'DECRYPTING DATA...' });
      const text = await fetchBuyers(item.item_name, item.material);
      setBuyerContent({ itemName: item.item_name, content: text });
      
      // Stop decrypting after a short delay to let the effect finish
      setTimeout(() => setIsDecrypting(false), text.length * 20 + 500);
    } catch (error) {
      console.error(error);
      setBuyerContent({ itemName: item.item_name, content: 'DECRYPTION FAILED. CONNECTION LOST.' });
      setIsDecrypting(false);
    } finally {
      setIsLoading(false);
    }
  };

  const generateManifest = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text('SCRAPSCOUT HAUL MANIFEST', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Items: ${items.length}`, 14, 36);
    doc.text(`Total Est. Resale: $${totalValue}`, 14, 42);
    doc.text(`Total Est. Scrap: $${totalScrap}`, 14, 48);

    // Table Data
    const tableData = items.map(item => [
      item.item_name,
      item.material,
      item.condition,
      `$${item.resale_value || 0}`,
      `$${item.scrap_value || 0}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Item Name', 'Material', 'Condition', 'Resale Value', 'Scrap Value']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
      styles: { fontSize: 9 },
    });

    doc.save('scrapscout-haul-manifest.pdf');
  };

  const handleNegotiate = async () => {
    if (!negotiationItem || !askingPrice) return;
    setIsGeneratingScript(true);
    try {
      const script = await generateNegotiationScript(negotiationItem, askingPrice);
      setNegotiationScript(script);
    } catch (error) {
      console.error(error);
      setNegotiationScript("Failed to generate script.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 relative font-sans">
      <div className="bg-zinc-950/60 backdrop-blur-2xl px-6 pt-8 pb-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-10 border-b border-white/5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 tracking-widest uppercase flex items-center gap-2 font-display drop-shadow-sm">
            <Cpu className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            Data Vault
          </h1>
          <p className="text-[10px] text-emerald-400/80 mt-1 tracking-widest font-mono">[{items.length}] ASSETS SECURED</p>
        </div>
        {items.length > 0 && (
          <button 
            onClick={generateManifest}
            className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center gap-2"
            title="Export Haul Manifest"
          >
            <Download size={18} />
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Manifest</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 perspective-1000 hide-scrollbar">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/5 relative overflow-hidden animate-float" style={{ animationDelay: '0s' }}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full blur-2xl animate-pulse" />
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Resale</p>
            <p className="text-3xl font-bold text-emerald-400 font-mono drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">${totalValue}</p>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/5 relative overflow-hidden animate-float" style={{ animationDelay: '0.5s' }}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Scrap</p>
            <p className="text-3xl font-bold text-emerald-400 font-mono drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">${totalScrap}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
            <PackageOpen size={64} className="mb-4 opacity-50" />
            <p className="font-bold text-lg tracking-widest uppercase font-display">Vault Empty</p>
            <p className="text-[10px] mt-2 font-mono uppercase tracking-widest">Awaiting scan data input.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {items.map(item => {
              const rarity = getRarity(Math.max(item.resale_value || 0, item.scrap_value || 0));
              
              return (
                <div 
                  key={item.id} 
                  className={`relative bg-zinc-900/50 backdrop-blur-md rounded-3xl overflow-hidden border ${rarity.border} ${rarity.shadow} flex flex-col group transform transition-all duration-300 hover:scale-[1.02] hover:-rotate-y-2 hover:rotate-x-2`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Holographic Glare Effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out z-20 pointer-events-none" />
                  
                  <div className="flex h-32 relative z-10">
                    <div className="w-32 h-full bg-zinc-950 shrink-0 relative overflow-hidden">
                      <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover opacity-80 transition-all group-hover:opacity-100 group-hover:scale-110 duration-500" />
                      <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay" />
                      <div className={`absolute top-0 left-0 px-2 py-1 text-[8px] font-bold tracking-widest ${rarity.bg} ${rarity.color} border-b border-r ${rarity.border} backdrop-blur-md`}>
                        {rarity.name}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between bg-zinc-900/30">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-zinc-100 line-clamp-1 tracking-widest font-display uppercase text-sm">{item.item_name}</h3>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1 font-mono">{item.material} // {item.condition}</p>
                          {item.repair_needs && item.repair_needs.toLowerCase() !== 'none' && (
                            <p className="text-[8px] text-amber-500/80 uppercase tracking-widest mt-0.5 font-mono italic">! REPAIR: {item.repair_needs}</p>
                          )}
                          {item.extracted_text && item.extracted_text.toLowerCase() !== 'none' && (
                            <p className="text-[8px] text-blue-400/80 uppercase tracking-widest mt-0.5 font-mono truncate">SN: {item.extracted_text}</p>
                          )}
                        </div>
                        <button 
                          onClick={() => onDeleteItem(item.id)}
                          className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">Resale</p>
                          <p className="font-bold text-emerald-400 font-mono">${item.resale_value}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-0.5">Scrap</p>
                          <p className="font-semibold text-emerald-400/80 font-mono">${item.scrap_value}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`bg-zinc-950/80 border-t ${rarity.border} p-3 flex justify-end gap-2 relative z-10`}>
                    <button 
                      onClick={() => setNegotiationItem(item)}
                      className="flex items-center gap-2 bg-purple-500/10 text-purple-400 px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-purple-500/20 transition-colors border border-purple-500/20 uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                    >
                      <MessageSquare size={14} />
                      AI Negotiator
                    </button>
                    <button 
                      onClick={() => findBuyers(item)}
                      className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 uppercase tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    >
                      <DollarSign size={14} />
                      Locate Buyers
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Content Modal */}
      {buyerContent && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <h2 className="font-bold text-emerald-400 flex items-center gap-2 tracking-widest uppercase text-xs font-display drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                <MapPin size={16} className="text-emerald-400" />
                Buyer Intel: {buyerContent.itemName}
              </h2>
              <button 
                onClick={() => setBuyerContent(null)}
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
                  <p className="text-[10px] font-medium tracking-widest uppercase animate-pulse text-emerald-400/80 font-mono">Accessing Local Networks...</p>
                </div>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-zinc-300 relative z-10 font-mono text-xs leading-relaxed">
                  {isDecrypting ? (
                    <p className="text-emerald-400 font-bold tracking-widest drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                      <DecryptText text={buyerContent.content} isDecrypting={isDecrypting} />
                    </p>
                  ) : (
                    <Markdown>{buyerContent.content}</Markdown>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Negotiation Modal */}
      {negotiationItem && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-purple-500/20 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-purple-500/20 flex justify-between items-center bg-zinc-900/50">
              <h2 className="font-bold text-purple-400 flex items-center gap-2 tracking-widest uppercase text-xs font-display drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">
                <MessageSquare size={16} className="text-purple-400" />
                AI Negotiator: {negotiationItem.item_name}
              </h2>
              <button 
                onClick={() => { setNegotiationItem(null); setNegotiationScript(null); setAskingPrice(''); }}
                className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-purple-400"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 relative hide-scrollbar">
              {subscriptionStatus === 'inactive' ? (
                <div className="flex flex-col items-center justify-center text-center h-full space-y-4">
                  <ShieldAlert size={48} className="text-zinc-600" />
                  <p className="text-zinc-400 font-mono text-sm">AI Negotiator requires Pro or Founder access.</p>
                  <button className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-purple-500/20 transition-colors">
                    Upgrade Access
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono">Seller's Asking Price ($)</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={askingPrice}
                        onChange={(e) => setAskingPrice(e.target.value)}
                        placeholder="e.g. 50"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 font-mono focus:outline-none focus:border-purple-500/50"
                      />
                      <button 
                        onClick={handleNegotiate}
                        disabled={isGeneratingScript || !askingPrice}
                        className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingScript ? <Loader2 size={16} className="animate-spin" /> : 'Analyze'}
                      </button>
                    </div>
                  </div>

                  {negotiationScript && (
                    <div className="bg-purple-950/10 border border-purple-500/20 p-5 rounded-2xl">
                      <div className="prose prose-invert prose-sm prose-p:font-mono prose-p:text-xs prose-p:leading-relaxed prose-headings:font-display prose-headings:tracking-widest prose-headings:uppercase prose-a:text-purple-400 max-w-none">
                        <Markdown>{negotiationScript}</Markdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
