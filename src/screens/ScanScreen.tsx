import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, Loader2, Upload, Sparkles, Copy, X, Eye, Thermometer, Zap, Video, Play, AlertTriangle, Info, DollarSign, Settings, ChevronRight, ChevronLeft, Layers, MapPin } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiClient, generateListing, generateRestorationGuide, findNearbyScrapYards } from '../services/gemini';
import { GoogleGenAI, Type } from "@google/genai";
import { ScannedItem, ScrapYard } from '../types';

interface ScanScreenProps {
  onSaveItem: (item: ScannedItem) => void;
}

export default function ScanScreen({ onSaveItem }: ScanScreenProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Partial<ScannedItem>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visionMode, setVisionMode] = useState<'normal' | 'night' | 'thermal'>('normal');
  const [zoom, setZoom] = useState<number>(1);
  const [matrixText, setMatrixText] = useState<string>('');
  
  // Listing Generation State
  const [isGeneratingListing, setIsGeneratingListing] = useState(false);
  const [generatedListing, setGeneratedListing] = useState<string | null>(null);
  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedItemForListing, setSelectedItemForListing] = useState<Partial<ScannedItem> | null>(null);

  // Veo Video Generation State
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isRestorationActive, setIsRestorationActive] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  // Restoration Guide State
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [restorationGuide, setRestorationGuide] = useState<string | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Scrap Yard Locator State
  const [isFindingYards, setIsFindingYards] = useState(false);
  const [nearbyYards, setNearbyYards] = useState<any[]>([]);
  const [showYardsModal, setShowYardsModal] = useState(false);
  
  // UI State
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'value' | 'details' | 'actions'>('value');

  // Matrix decoding effect
  useEffect(() => {
    if (!isAnalyzing) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
    const interval = setInterval(() => {
      let text = '';
      for (let i = 0; i < 150; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
        if (i % 30 === 0) text += '\n';
      }
      setMatrixText(text);
    }, 50);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImageSrc(imageSrc);
      setZoom(1); // Reset zoom on capture so they see the full frame
      analyzeImage(imageSrc);
    }
  }, [webcamRef]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImageSrc(result);
        analyzeImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);
    setGeneratedListing(null);

    try {
      const ai = getGeminiClient();
      
      // Extract just the base64 data part
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];

      const prompt = `
        Analyze this image of salvaged or discarded items. 
        Identify ALL distinct valuable or recyclable items in the image.
        For each item, provide a highly accurate assessment of its current market value.
        Consider the brand, model, vintage/antique status, and current condition.
        Provide realistic 'resale_value' (if sold online or at a flea market) and 'scrap_value' (if sold for raw materials).
        The 'estimated_value_low' and 'estimated_value_high' should represent the realistic range of the resale value.
        
        CRITICAL: Provide a detailed assessment of the item's condition and any potential repair needs.
        If repairs are needed, specify what they are (e.g., "needs new power cord", "cracked screen", "rust removal required").
        
        OCR: Extract any visible text from labels, serial numbers, model numbers, or manufacturer markings on the item.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item_name: { type: Type.STRING, description: "Specific name of the item, including brand or model if visible" },
                material: { type: Type.STRING, description: "Primary material (e.g., Copper, Wood, Steel, Electronics)" },
                condition: { type: Type.STRING, description: "Detailed condition assessment" },
                repair_needs: { type: Type.STRING, description: "Specific repairs needed, or 'None' if in good working order" },
                extracted_text: { type: Type.STRING, description: "Text extracted from labels, serial numbers, or markings. Use 'None' if no text is visible." },
                estimated_value_low: { type: Type.NUMBER, description: "Lowest expected resale value in USD" },
                estimated_value_high: { type: Type.NUMBER, description: "Highest expected resale value in USD" },
                resale_value: { type: Type.NUMBER, description: "Most likely resale value in USD" },
                scrap_value: { type: Type.NUMBER, description: "Estimated scrap/recycling value in USD" },
                bounding_box: { 
                  type: Type.ARRAY, 
                  items: { type: Type.INTEGER }, 
                  description: "Bounding box coordinates in [ymin, xmin, ymax, xmax] format, normalized to 0-1000" 
                }
              },
              required: ["item_name", "material", "condition", "repair_needs", "extracted_text", "estimated_value_low", "estimated_value_high", "resale_value", "scrap_value", "bounding_box"]
            }
          }
        }
      });

      let text = response.text || "[]";
      // Clean up potential markdown formatting
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const data = JSON.parse(text);
      
      // Ensure it's an array
      const resultsArray = Array.isArray(data) ? data : [data];
      setAnalysisResults(resultsArray);

    } catch (err: any) {
      console.error("Analysis failed:", err);
      const errorStr = JSON.stringify(err).toLowerCase();
      const isQuotaError = 
        errorStr.includes("429") || 
        errorStr.includes("quota") || 
        errorStr.includes("resource_exhausted") ||
        err?.status === "RESOURCE_EXHAUSTED" ||
        err?.code === 429;

      if (isQuotaError) {
        setError("SCRAPSCOUT CORE OFFLINE: API Quota Exceeded. Awaiting bandwidth allocation.");
      } else {
        setError(err.message || "Failed to analyze image.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateListing = async (item: Partial<ScannedItem>) => {
    setSelectedItemForListing(item);
    setIsGeneratingListing(true);
    setShowListingModal(true);
    try {
      const listing = await generateListing(item);
      setGeneratedListing(listing);
    } catch (err) {
      console.error(err);
      setGeneratedListing("Failed to generate listing. Please try again.");
    } finally {
      setIsGeneratingListing(false);
    }
  };

  const handleGenerateRestorationGuide = async (item: Partial<ScannedItem>) => {
    setIsGeneratingGuide(true);
    setShowGuideModal(true);
    try {
      const guide = await generateRestorationGuide(item);
      setRestorationGuide(guide);
    } catch (err) {
      console.error(err);
      setRestorationGuide("Failed to generate restoration guide. Please try again.");
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  const handleFindScrapYards = async (item: Partial<ScannedItem>) => {
    setIsFindingYards(true);
    setShowYardsModal(true);
    try {
      // Use geolocation if available, otherwise default
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const yards = await findNearbyScrapYards(position.coords.latitude, position.coords.longitude, item.material);
          setNearbyYards(yards);
          setIsFindingYards(false);
        },
        async () => {
          // Fallback to a default location (e.g., San Francisco)
          const yards = await findNearbyScrapYards(37.7749, -122.4194, item.material);
          setNearbyYards(yards);
          setIsFindingYards(false);
        }
      );
    } catch (err) {
      console.error(err);
      setError("Failed to find scrap yards.");
      setIsFindingYards(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!imageSrc) return;
    
    setIsGeneratingVideo(true);
    setVideoError(null);
    setShowVideoModal(true);
    setNeedsApiKey(false);

    try {
      // Check for API key selection
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setNeedsApiKey(true);
        setIsGeneratingVideo(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = imageSrc.split(',')[1];
      const mimeType = imageSrc.split(';')[0].split(':')[1];

      const item = analysisResults ? analysisResults[activeItemIndex] : null;
      const itemName = item?.item_name || "item";

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A high-fidelity, ultra-realistic AR holographic restoration of this ${itemName}. The video should show the item being reconstructed with glowing blue digital lines, revealing its internal components and then transforming into its perfect, brand-new condition. Cinematic lighting, 4k, futuristic AR interface style.`,
        image: {
          imageBytes: base64Data,
          mimeType: mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await (ai as any).operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoResponse = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.API_KEY || '',
          },
        });
        const blob = await videoResponse.blob();
        const url = URL.createObjectURL(blob);
        setGeneratedVideoUrl(url);
        // Automatically activate restoration view if successful
        setIsRestorationActive(true);
        setShowVideoModal(false);
      } else {
        throw new Error("Video generation failed: No download link received.");
      }
    } catch (err: any) {
      console.error("Video generation failed:", err);
      if (err.message?.includes("Requested entity was not found")) {
        setNeedsApiKey(true);
      } else {
        setVideoError(err.message || "Failed to generate video.");
      }
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleOpenKeySelector = async () => {
    await (window as any).aistudio.openSelectKey();
    handleGenerateVideo(); // Retry after selection
  };

  const handleSave = (item: Partial<ScannedItem>) => {
    if (imageSrc) {
      const newItem: ScannedItem = {
        id: Math.random().toString(36).substring(7),
        image_url: imageSrc,
        item_name: item.item_name || 'Unknown Item',
        material: item.material || 'Unknown',
        condition: item.condition || 'Unknown',
        repair_needs: item.repair_needs || 'None',
        extracted_text: item.extracted_text || 'None',
        estimated_value_low: item.estimated_value_low || 0,
        estimated_value_high: item.estimated_value_high || 0,
        resale_value: item.resale_value || 0,
        scrap_value: item.scrap_value || 0,
        status: 'found',
        created_at: new Date().toISOString()
      };
      onSaveItem(newItem);
      
      // Remove the saved item from the results array
      setAnalysisResults(prev => prev ? prev.filter(i => i !== item) : null);
      
      // If no items left, reset
      if (analysisResults && analysisResults.length <= 1) {
        setImageSrc(null);
        setAnalysisResults(null);
      }
    }
  };

  const getVisionFilter = () => {
    switch (visionMode) {
      case 'night': return 'sepia(100%) hue-rotate(90deg) saturate(300%) brightness(150%) contrast(120%)';
      case 'thermal': return 'grayscale(100%) sepia(100%) hue-rotate(270deg) saturate(500%) contrast(200%) invert(10%)';
      default: return 'none';
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 relative font-mono">
      {!imageSrc ? (
        <>
          <div className="flex-1 relative overflow-hidden">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment" }}
              className="w-full h-full object-cover transition-all duration-500"
              style={{ filter: getVisionFilter(), transform: `scale(${zoom})`, transformOrigin: 'center' }}
            />
            {/* Camera Overlay UI */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
              <div className="flex justify-between items-start">
                <div className="text-left">
                  <h2 className="text-white font-bold text-xl drop-shadow-md tracking-widest uppercase text-emerald-400">ScrapScout Scanner</h2>
                  <p className="text-emerald-200/80 text-sm drop-shadow-md">AWAITING TARGET ACQUISITION</p>
                </div>
                
                {/* Vision Mode Toggles */}
                <div className="flex flex-col gap-2 pointer-events-auto">
                  <button 
                    onClick={() => setVisionMode('normal')}
                    className={`p-2 rounded-full border ${visionMode === 'normal' ? 'bg-emerald-950/300/30 border-emerald-400 text-emerald-400' : 'bg-black/50 border-gray-600 text-gray-400'}`}
                  >
                    <Eye size={20} />
                  </button>
                  <button 
                    onClick={() => setVisionMode('night')}
                    className={`p-2 rounded-full border ${visionMode === 'night' ? 'bg-green-500/30 border-green-400 text-green-400' : 'bg-black/50 border-gray-600 text-gray-400'}`}
                  >
                    <Zap size={20} />
                  </button>
                  <button 
                    onClick={() => setVisionMode('thermal')}
                    className={`p-2 rounded-full border ${visionMode === 'thermal' ? 'bg-red-950/300/30 border-red-400 text-red-400' : 'bg-black/50 border-gray-600 text-gray-400'}`}
                  >
                    <Thermometer size={20} />
                  </button>
                </div>
              </div>
              
              {/* Zoom Slider */}
              <div className="absolute right-6 top-1/2 -translate-y-1/2 h-48 w-8 flex flex-col items-center justify-between pointer-events-auto bg-black/40 backdrop-blur-md rounded-full py-4 border border-emerald-500/30 z-20">
                <span className="text-emerald-400 text-[10px] font-bold">5x</span>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="h-32 w-1 appearance-none bg-emerald-950 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 cursor-pointer"
                  style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                />
                <span className="text-emerald-400 text-[10px] font-bold">1x</span>
              </div>

              <div className="relative border-2 border-emerald-500/20 rounded-3xl flex-1 my-8 mx-4 overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)_inset] bg-emerald-500/5 backdrop-blur-[2px]">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-emerald-400 rounded-tl-3xl drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-emerald-400 rounded-tr-3xl drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-emerald-400 rounded-bl-3xl drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-emerald-400 rounded-br-3xl drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                
                {/* Crosshairs */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 opacity-60">
                  <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border-2 border-emerald-400 rounded-full drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full drop-shadow-[0_0_5px_rgba(16,185,129,0.8)] animate-ping" />
                </div>

                {/* Scanning Laser Line */}
                <div 
                  className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_30px_10px_rgba(16,185,129,0.5)] animate-scan" 
                />
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
                
                {/* Data Readouts */}
                <div className="absolute top-6 left-6 text-[10px] text-emerald-400 opacity-90 flex flex-col gap-1.5 font-bold drop-shadow-[0_0_2px_rgba(16,185,129,0.8)]">
                  <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> SYS.OPT: ONLINE</span>
                  <span>LAT: 34.0522° N</span>
                  <span>LNG: 118.2437° W</span>
                </div>
                <div className="absolute bottom-6 right-6 text-[10px] text-emerald-400 opacity-90 flex flex-col gap-1.5 text-right font-bold drop-shadow-[0_0_2px_rgba(16,185,129,0.8)]">
                  <span>MODE: {visionMode.toUpperCase()}</span>
                  <span>Z-INDEX: MULTI-TARGET</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="h-32 bg-zinc-950/80 backdrop-blur-2xl flex items-center justify-center gap-10 pb-safe border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-emerald-400 hover:bg-zinc-800 transition-all hover:border-emerald-500/30 shadow-sm"
            >
              <Upload size={24} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
            
            <button 
              onClick={capture}
              className="w-24 h-24 rounded-full border-4 border-emerald-400 flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(16,185,129,0.3)] bg-zinc-950 group"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 backdrop-blur-md group-hover:bg-emerald-500/30 transition-colors flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-emerald-400/50 border-dashed animate-[spin_10s_linear_infinite]" />
              </div>
            </button>
            
            <div className="w-14 h-14" /> {/* Spacer for balance */}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">
          {/* Background Image (Blurred for 3D effect) */}
          <div className="absolute inset-0 z-0">
            <motion.img 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1 }}
              src={imageSrc} 
              alt="Captured Background" 
              className="w-full h-full object-cover blur-sm" 
              style={{ filter: getVisionFilter() }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950" />
          </div>

          <div className="relative z-20 h-64 shrink-0 p-4">
            <motion.div 
              layoutId="captured-image"
              className="w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group"
            >
              <div className="w-full h-full relative">
                {isRestorationActive && generatedVideoUrl ? (
                  <div className="absolute inset-0 z-30 bg-black">
                    <video 
                      src={generatedVideoUrl} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                    <div className="absolute top-4 right-4 z-40">
                      <button 
                        onClick={() => setIsRestorationActive(false)}
                        className="bg-zinc-950/80 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/10 backdrop-blur-md"
                      >
                        Exit AR View
                      </button>
                    </div>
                    <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]">Ultra-Realistic AR Restoration</span>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={imageSrc} 
                    alt="Captured" 
                    className="w-full h-full object-cover" 
                    style={{ filter: getVisionFilter() }}
                  />
                )}

                {!isRestorationActive && (
                  <div className="absolute top-4 right-4 z-40 flex gap-2">
                    {generatedVideoUrl ? (
                      <button 
                        onClick={() => setIsRestorationActive(true)}
                        className="bg-blue-600/80 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-blue-400/30 backdrop-blur-md flex items-center gap-2"
                      >
                        <Play size={12} />
                        Play AR Restoration
                      </button>
                    ) : (
                      <button 
                        onClick={handleGenerateVideo}
                        className="bg-zinc-950/80 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/10 backdrop-blur-md flex items-center gap-2"
                      >
                        <Video size={12} />
                        Generate AR Video
                      </button>
                    )}
                  </div>
                )}
                
                {/* AR Bounding Boxes */}
                <AnimatePresence>
                  {analysisResults && analysisResults.map((result, idx) => {
                    if (!result.bounding_box || result.bounding_box.length !== 4) return null;
                    const [ymin, xmin, ymax, xmax] = result.bounding_box;
                    const top = `${(ymin / 1000) * 100}%`;
                    const left = `${(xmin / 1000) * 100}%`;
                    const height = `${((ymax - ymin) / 1000) * 100}%`;
                    const width = `${((xmax - xmin) / 1000) * 100}%`;

                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ 
                          opacity: activeItemIndex === idx ? 1 : 0.4, 
                          scale: 1,
                          borderColor: activeItemIndex === idx ? '#10b981' : '#ffffff44',
                          borderWidth: activeItemIndex === idx ? 3 : 1
                        }}
                        className="absolute border bg-emerald-400/5 transition-all duration-500 z-20 pointer-events-none"
                        style={{ top, left, width, height }}
                      >
                        {activeItemIndex === idx && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute -top-8 left-0 bg-emerald-500 text-zinc-950 text-[10px] font-bold px-3 py-1 whitespace-nowrap rounded-t-lg shadow-lg flex items-center gap-2"
                          >
                            <div className="w-2 h-2 rounded-full bg-zinc-950 animate-pulse" />
                            {result.item_name}
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/40 pointer-events-none" />
              
              <div className="absolute top-4 left-4 flex gap-2 z-30">
                <button 
                  onClick={() => { setImageSrc(null); setAnalysisResults(null); setError(null); setZoom(1); }}
                  className="w-10 h-10 rounded-2xl bg-zinc-950/60 border border-white/10 flex items-center justify-center text-zinc-300 backdrop-blur-xl hover:bg-zinc-900 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shadow-lg"
                >
                  <RefreshCw size={18} />
                </button>
              </div>

              <div className="absolute top-4 right-4 z-30">
                <button 
                  onClick={handleGenerateVideo}
                  className="px-4 py-2 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center gap-2 text-purple-300 text-[10px] font-bold backdrop-blur-xl hover:bg-purple-500/30 transition-all shadow-lg tracking-widest uppercase"
                >
                  <Video size={14} />
                  Veo
                </button>
              </div>
              
              {/* Sci-Fi Analyzing Overlay */}
              <AnimatePresence>
                {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-40 overflow-hidden bg-emerald-950/40 backdrop-blur-sm flex flex-col items-center justify-center"
                  >
                    <motion.div 
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_30px_10px_rgba(16,185,129,0.8)] z-50" 
                    />
                    
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:30px_30px] opacity-30" />
                    
                    <div className="absolute inset-0 overflow-hidden opacity-20 text-emerald-400 text-[8px] leading-none break-all whitespace-pre-wrap select-none font-mono p-4">
                      {matrixText}
                    </div>

                    <div className="relative z-50 flex flex-col items-center gap-4">
                      <div className="relative w-24 h-24">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full"
                        />
                        <motion.div 
                          animate={{ rotate: -360 }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-4 border-2 border-emerald-400/40 border-b-emerald-400 rounded-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Zap className="text-emerald-400 animate-pulse" size={32} />
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-emerald-400 font-mono text-[12px] font-bold tracking-[0.4em] uppercase">Analyzing</span>
                        <span className="text-emerald-400/60 font-mono text-[8px] tracking-widest uppercase">Decrypting Signatures</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 z-20 hide-scrollbar">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-full text-emerald-400">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex flex-col items-center"
                >
                  <p className="font-bold text-xl tracking-[0.3em] uppercase mb-3 font-display">Extracting Data...</p>
                  <p className="text-[10px] opacity-80 tracking-widest font-mono">Isolating multiple signatures</p>
                </motion.div>
              </div>
            ) : error ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-red-400 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl backdrop-blur-md"
              >
                <AlertTriangle className="mx-auto mb-4" size={32} />
                <p className="font-bold mb-3 tracking-widest uppercase font-display">Decryption Failed</p>
                <p className="text-xs font-mono">{error}</p>
              </motion.div>
            ) : analysisResults && analysisResults.length > 0 ? (
              <div className="h-full flex flex-col">
                {/* Item Selector Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar shrink-0">
                  {analysisResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveItemIndex(idx);
                        setActiveTab('value');
                      }}
                      className={`px-4 py-2 rounded-2xl whitespace-nowrap text-[10px] font-bold tracking-widest uppercase transition-all border ${
                        activeItemIndex === idx 
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                          : 'bg-zinc-900/50 text-zinc-400 border-white/5 hover:border-white/10'
                      }`}
                    >
                      {result.item_name}
                    </button>
                  ))}
                </div>

                {/* Active Item Details */}
                <motion.div 
                  key={activeItemIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  {/* Sub-tabs Navigation */}
                  <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5 mb-4 shrink-0">
                    {(['value', 'details', 'actions'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all ${
                          activeTab === tab 
                            ? 'bg-zinc-800 text-emerald-400 shadow-inner' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
                    <AnimatePresence mode="wait">
                      {activeTab === 'value' && (
                        <motion.div
                          key="value"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                <DollarSign size={12} className="text-emerald-400" />
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Resale</span>
                              </div>
                              <p className="text-2xl font-bold text-emerald-400 font-mono">
                                ${analysisResults[activeItemIndex].resale_value?.toLocaleString()}
                              </p>
                            </div>
                            <div className="p-5 rounded-3xl bg-zinc-900/50 border border-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                <Zap size={12} className="text-amber-400" />
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Scrap</span>
                              </div>
                              <p className="text-2xl font-bold text-zinc-100 font-mono">
                                ${analysisResults[activeItemIndex].scrap_value?.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
                            <span className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest font-mono block mb-2">Estimated Range</span>
                            <div className="flex items-end justify-between">
                              <p className="text-3xl font-bold text-emerald-400 font-mono">
                                ${analysisResults[activeItemIndex].estimated_value_low}
                                <span className="text-sm text-emerald-500/40 mx-2">to</span>
                                ${analysisResults[activeItemIndex].estimated_value_high}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'details' && (
                        <motion.div
                          key="details"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          <div className="p-5 rounded-3xl bg-zinc-900/50 border border-white/5 space-y-4">
                            <div>
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block mb-2">Condition</span>
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  analysisResults[activeItemIndex].condition?.toLowerCase().includes('good') ? 'bg-emerald-400' : 'bg-amber-400'
                                }`} />
                                <p className="text-sm font-bold text-zinc-100 uppercase tracking-wider">{analysisResults[activeItemIndex].condition}</p>
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block mb-2">Material</span>
                              <p className="text-sm font-bold text-zinc-100 uppercase tracking-wider">{analysisResults[activeItemIndex].material}</p>
                            </div>

                            {analysisResults[activeItemIndex].repair_needs && analysisResults[activeItemIndex].repair_needs !== 'None' && (
                              <div className="pt-4 border-t border-white/5">
                                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest font-mono block mb-2">Repair Needs</span>
                                <p className="text-xs text-zinc-400 leading-relaxed">{analysisResults[activeItemIndex].repair_needs}</p>
                              </div>
                            )}

                            {analysisResults[activeItemIndex].extracted_text && (
                              <div className="pt-4 border-t border-white/5">
                                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest font-mono block mb-2">Extracted Text</span>
                                <p className="text-xs font-mono text-zinc-400 break-all bg-zinc-950 p-3 rounded-xl border border-white/5">
                                  {analysisResults[activeItemIndex].extracted_text}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'actions' && (
                        <motion.div
                          key="actions"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-3"
                        >
                          <button 
                            onClick={() => handleSave(analysisResults[activeItemIndex])}
                            className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98] transition-all"
                          >
                            <Check size={18} />
                            Extract to Inventory
                          </button>

                          <button 
                            onClick={() => handleGenerateListing(analysisResults[activeItemIndex])}
                            className="w-full bg-zinc-900 text-purple-400 border border-purple-500/30 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-purple-500/10 active:scale-[0.98] transition-all"
                          >
                            <Sparkles size={18} />
                            Generate AI Listing
                          </button>

                          <button 
                            onClick={handleGenerateVideo}
                            className="w-full bg-zinc-900 text-blue-400 border border-blue-500/30 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-500/10 active:scale-[0.98] transition-all"
                          >
                            <Video size={18} />
                            Generate AR Video
                          </button>

                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={() => handleGenerateRestorationGuide(analysisResults[activeItemIndex])}
                              className="bg-zinc-900 text-emerald-400 border border-emerald-500/30 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-2 hover:bg-emerald-500/10 active:scale-[0.95] transition-all"
                            >
                              <Zap size={18} />
                              Restoration Guide
                            </button>
                            <button 
                              onClick={() => handleFindScrapYards(analysisResults[activeItemIndex])}
                              className="bg-zinc-900 text-amber-400 border border-amber-500/30 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-2 hover:bg-amber-500/10 active:scale-[0.95] transition-all"
                            >
                              <DollarSign size={18} />
                              Scrap Yard Locator
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Listing Modal */}
      {showListingModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans">
          <div className="bg-zinc-900 w-full sm:w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-xl border border-zinc-800 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center p-5 border-b border-zinc-800/50 shrink-0">
              <div className="flex items-center gap-2 text-purple-400">
                <Sparkles size={20} />
                <h3 className="font-bold text-lg tracking-wide">AI Listing Generator</h3>
              </div>
              <button 
                onClick={() => setShowListingModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-zinc-950/50">
              {isGeneratingListing ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-12">
                  <Loader2 className="animate-spin mb-4 text-purple-500" size={40} />
                  <p className="font-medium tracking-wide">Synthesizing listing data...</p>
                  <p className="text-sm mt-2 text-center max-w-[250px] opacity-60">Optimizing for local marketplace networks...</p>
                </div>
              ) : (
                <div className="prose prose-sm prose-slate max-w-none">
                  <Markdown>{generatedListing || ''}</Markdown>
                </div>
              )}
            </div>

            {!isGeneratingListing && generatedListing && (
              <div className="p-5 border-t border-zinc-800/50 bg-zinc-900 shrink-0 rounded-b-3xl">
                <button 
                  onClick={() => {
                    if (generatedListing) {
                      navigator.clipboard.writeText(generatedListing);
                      alert('Listing copied to clipboard!');
                    }
                  }}
                  className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform hover:bg-purple-950/300"
                >
                  <Copy size={20} />
                  Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Generation Modal */}
      {showVideoModal && (
        <div className="absolute inset-0 z-[60] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 font-mono">
          <div className="bg-zinc-900 w-full max-w-lg rounded-3xl overflow-hidden border border-zinc-800 shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-zinc-800/50">
              <div className="flex items-center gap-2 text-purple-400">
                <Video size={20} />
                <h3 className="font-bold text-lg tracking-widest uppercase">Veo Temporal Synthesis</h3>
              </div>
              <button 
                onClick={() => setShowVideoModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              {needsApiKey ? (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-amber-950/30 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-500">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-zinc-50 uppercase tracking-tight">API Key Required</h4>
                    <p className="text-sm text-zinc-400 max-w-xs mx-auto">Veo video generation requires a paid Google Cloud project API key. Please select your key to continue.</p>
                  </div>
                  <button 
                    onClick={handleOpenKeySelector}
                    className="bg-amber-950/300 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-amber-400 transition-colors shadow-sm"
                  >
                    Select API Key
                  </button>
                  <p className="text-[10px] text-zinc-500">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">Learn about billing</a>
                  </p>
                </div>
              ) : isGeneratingVideo ? (
                <div className="text-center space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="text-purple-500 animate-pulse" size={32} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-purple-400 font-bold tracking-[0.2em] uppercase">Synthesizing Frames...</p>
                    <p className="text-[10px] text-zinc-500 animate-pulse">ESTIMATED TIME: 60-120 SECONDS</p>
                  </div>
                  <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-purple-950/300 h-full animate-[progress_30s_linear_infinite]" style={{ width: '100%' }} />
                  </div>
                </div>
              ) : videoError ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-950/30 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <X size={32} />
                  </div>
                  <p className="text-red-400 font-bold uppercase">Synthesis Failed</p>
                  <p className="text-xs text-zinc-400">{videoError}</p>
                  <button 
                    onClick={handleGenerateVideo}
                    className="text-purple-400 underline text-sm font-bold uppercase tracking-widest"
                  >
                    Retry Transmission
                  </button>
                </div>
              ) : generatedVideoUrl ? (
                <div className="w-full space-y-6">
                  <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-800 shadow-md bg-black">
                    <video 
                      src={generatedVideoUrl} 
                      controls 
                      autoPlay 
                      loop 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex justify-center">
                    <a 
                      href={generatedVideoUrl} 
                      download="scrapscout-intel.mp4"
                      className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-purple-950/300 transition-colors flex items-center gap-2"
                    >
                      Download Intel
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Restoration Guide Modal */}
      {showGuideModal && (
        <div className="absolute inset-0 z-[70] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 font-sans">
          <div className="bg-zinc-900 w-full max-w-2xl rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-10">
              <div className="flex items-center gap-3 text-emerald-400">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight">AI Restoration Manual</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Expert Restoration Protocol</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 bg-zinc-950/30">
              {isGeneratingGuide ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                  <div className="relative mb-6">
                    <Loader2 className="animate-spin text-emerald-500" size={48} />
                    <Sparkles className="absolute -top-2 -right-2 text-emerald-400 animate-pulse" size={20} />
                  </div>
                  <p className="font-bold tracking-widest uppercase text-sm font-mono">Analyzing Repair Needs...</p>
                  <p className="text-xs mt-2 text-zinc-500 max-w-[280px] text-center">Consulting master restoration database for optimal techniques...</p>
                </div>
              ) : (
                <div className="prose prose-invert prose-emerald max-w-none">
                  <Markdown>{restorationGuide || ''}</Markdown>
                </div>
              )}
            </div>

            {!isGeneratingGuide && restorationGuide && (
              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(restorationGuide);
                    alert('Guide copied to clipboard!');
                  }}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all hover:bg-emerald-500"
                >
                  <Copy size={20} />
                  Copy Full Guide
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrap Yard Locator Modal */}
      {showYardsModal && (
        <div className="absolute inset-0 z-[70] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 font-sans">
          <div className="bg-zinc-900 w-full max-w-lg rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-6 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-10">
              <div className="flex items-center gap-3 text-amber-400">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight">Scrap Yard Locator</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Nearby High-Payout Facilities</p>
                </div>
              </div>
              <button 
                onClick={() => setShowYardsModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-zinc-950/30">
              {isFindingYards ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <Info className="absolute inset-0 m-auto text-amber-400 animate-pulse" size={24} />
                  </div>
                  <p className="font-bold tracking-widest uppercase text-sm font-mono">Scanning Local Markets...</p>
                  <p className="text-xs mt-2 text-zinc-500 max-w-[280px] text-center">Triangulating nearest high-value scrap yards via Google Maps...</p>
                </div>
              ) : nearbyYards.length > 0 ? (
                <div className="space-y-4">
                  {nearbyYards.map((yard, idx) => (
                    <div key={idx} className="bg-zinc-900/80 border border-white/5 rounded-2xl p-5 hover:border-amber-500/30 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">{yard.name}</h4>
                        <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-lg border border-white/5">
                          <Sparkles size={12} className="text-amber-400" />
                          <span className="text-[10px] font-bold text-amber-400 uppercase">{yard.payout_estimate || 'Market Rates'}</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 mb-3 font-mono">{yard.address}</p>
                      
                      {yard.pro_tip && (
                        <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                          <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Sparkles size={10} /> Pro Tip
                          </p>
                          <p className="text-[10px] text-amber-300/70 italic font-mono leading-relaxed">{yard.pro_tip}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button 
                          onClick={() => window.open(yard.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(yard.name + ' ' + yard.address)}`, '_blank')}
                          className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 border border-white/5"
                        >
                          <MapPin size={14} className="text-amber-400" />
                          View on Maps
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-500 text-sm">No scrap yards found in your immediate vicinity.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
