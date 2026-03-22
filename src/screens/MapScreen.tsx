import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Opportunity, SavedLocation } from '../types';
import { Filter, MapPin, Loader2, Crown, Clock, Navigation, X, Search, Sparkles, Settings, BellRing, Trash2, Car, DollarSign, ArrowRight, CheckCircle2, CornerUpRight, CornerUpLeft, ArrowUp, ShieldCheck } from 'lucide-react';
import L from 'leaflet';
import { fetchOpportunities, generateRoutePlan, generateScoutReport } from '../services/gemini';
import { searchSalvageWithDeepSeek } from '../services/deepseek';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons based on legal status
const createIcon = (color: string, isFounder: boolean = false) => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div class="marker-pulse" style="--pulse-color: ${color}; background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid ${isFounder ? '#A855F7' : 'white'}; display: flex; align-items: center; justify-content: center;">${isFounder ? '<span style="font-size: 12px;">👑</span>' : ''}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const icons = {
  green: createIcon('#10B981'),
  yellow: createIcon('#F59E0B'),
  red: createIcon('#EF4444'),
  founder_green: createIcon('#10B981', true),
  founder_yellow: createIcon('#F59E0B', true),
  founder_red: createIcon('#EF4444', true),
};

interface MapScreenProps {
  legalMode: 'legal_only' | 'permission_hunter' | 'all';
  setLegalMode: (mode: 'legal_only' | 'permission_hunter' | 'all') => void;
  subscriptionStatus: 'inactive' | 'pro' | 'founder';
  searchRadius: number;
  onSaveLocation?: (loc: Omit<SavedLocation, 'id' | 'timestamp'>) => void;
  savedLocations?: SavedLocation[];
}

// Component to handle map centering
function MapCenterer({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapScreen({ legalMode, setLegalMode, subscriptionStatus, searchRadius, onSaveLocation, savedLocations }: MapScreenProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationName, setLocationName] = useState<string>("ACQUIRING GPS...");
  
  // Route Optimization State
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [selectedRoutePoints, setSelectedRoutePoints] = useState<Opportunity[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<[number, number][] | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeRationale, setRouteRationale] = useState<string | null>(null);
  
  // Turn-by-Turn State
  const [currentNavTargetIndex, setCurrentNavTargetIndex] = useState(0);
  const [mockTurnIndex, setMockTurnIndex] = useState(0);

  const mockTurns = [
    { icon: ArrowUp, text: "Continue straight on Industrial Pkwy", dist: "1.2 mi" },
    { icon: CornerUpRight, text: "Turn right onto Scrap Yard Rd", dist: "500 ft" },
    { icon: CornerUpLeft, text: "Turn left into loading dock", dist: "100 ft" },
    { icon: MapPin, text: "Arrive at destination", dist: "0 ft" },
  ];

  // DeepSeek Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Scout Report State
  const [showScoutReport, setShowScoutReport] = useState(false);
  const [scoutReport, setScoutReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [hvtAlert, setHvtAlert] = useState<Opportunity | null>(null);

  const handleGenerateScoutReport = async () => {
    if (subscriptionStatus === 'inactive') {
      alert("Scout Strategic Reports require Pro or Founder access.");
      return;
    }

    setIsGeneratingReport(true);
    setShowScoutReport(true);
    setScoutReport(null);

    try {
      const report = await generateScoutReport(userLocation?.[0] || 29.4241, userLocation?.[1] || -98.4936);
      setScoutReport(report);
    } catch (err) {
      console.error(err);
      setScoutReport("FAILED TO ACQUIRE INTELLIGENCE. SIGNAL JAMMED.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  useEffect(() => {
    const loadOpportunities = async (lat?: number, lng?: number) => {
      try {
        setIsLoading(true);
        const data = await fetchOpportunities(lat, lng, searchRadius);
        setOpportunities(data);
        
        if (data.length > 0 && !lat && !lng) {
          // Fallback center if no GPS
          setUserLocation([data[0].latitude, data[0].longitude]);
          setLocationName(`${data[0].city.toUpperCase()}, ${data[0].county.toUpperCase()}`);
        } else if (data.length > 0) {
           setLocationName(`${data[0].city.toUpperCase()}, ${data[0].county.toUpperCase()}`);
        } else if (lat && lng) {
           setLocationName("LOCAL SECTOR");
        }

        // Simulate HVT Alert after loading
        const highValueTargets = data.filter(opp => (opp.estimated_total_value || 0) > 500);
        if (highValueTargets.length > 0) {
          setTimeout(() => {
            setHvtAlert(highValueTargets[0]);
            // Auto-hide alert after 10 seconds
            setTimeout(() => setHvtAlert(null), 10000);
          }, 3000);
        }
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
          setUserLocation([latitude, longitude]);
          loadOpportunities(latitude, longitude);
        },
        (error) => {
          console.warn("Geolocation error:", error);
          // Fallback to default load
          loadOpportunities();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      // Fallback if geolocation is not supported
      loadOpportunities();
    }
  }, [searchRadius]);

  const filteredData = opportunities.filter(opp => {
    if (legalMode === 'legal_only') return opp.legal_status === 'green';
    if (legalMode === 'permission_hunter') return opp.legal_status === 'green' || opp.legal_status === 'yellow';
    return true;
  });

  const handleMarkerClick = (opp: Opportunity) => {
    if (isRouteMode) {
      if (selectedRoutePoints.find(p => p.id === opp.id)) {
        setSelectedRoutePoints(prev => prev.filter(p => p.id !== opp.id));
      } else {
        setSelectedRoutePoints(prev => [...prev, opp]);
      }
    }
  };

  const calculateRoute = async () => {
    if (selectedRoutePoints.length < 2) {
      alert("Please select at least 2 points for a route.");
      return;
    }

    if (subscriptionStatus === 'inactive') {
      alert("Route Optimization requires Pro or Founder access.");
      return;
    }

    setIsCalculatingRoute(true);
    
    try {
      const { route, rationale } = await generateRoutePlan(
        selectedRoutePoints, 
        userLocation?.[0], 
        userLocation?.[1]
      );
      
      setSelectedRoutePoints(route);
      const coordinates: [number, number][] = route.map(p => [p.latitude, p.longitude]);
      setOptimizedRoute(coordinates);
      setRouteRationale(rationale);
      
      // Optional: You could show the rationale in a toast or modal here
      console.log("Route Rationale:", rationale);
    } catch (error) {
      console.error("Failed to calculate route:", error);
      alert("Failed to calculate optimal route. Please try again.");
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const toggleRouteMode = () => {
    setIsRouteMode(!isRouteMode);
    setSelectedRoutePoints([]);
    setOptimizedRoute(null);
    setIsNavigating(false);
    setIsCalculatingRoute(false);
    setRouteRationale(null);
    setCurrentNavTargetIndex(0);
    setMockTurnIndex(0);
  };

  const removeRoutePoint = (id: string) => {
    const newPoints = selectedRoutePoints.filter(p => p.id !== id);
    setSelectedRoutePoints(newPoints);
    if (newPoints.length < 2) {
      setOptimizedRoute(null);
      setRouteRationale(null);
    } else if (optimizedRoute) {
      // Re-calculate if we already had an optimized route
      const coordinates: [number, number][] = newPoints.map(p => [p.latitude, p.longitude]);
      setOptimizedRoute(coordinates);
    }
  };

  const startNavigation = () => {
    if (!optimizedRoute) calculateRoute();
    setIsNavigating(true);
    setCurrentNavTargetIndex(0);
    setMockTurnIndex(0);
  };

  // Calculate route stats
  const routeTotalValue = selectedRoutePoints.reduce((sum, p) => sum + (p.estimated_total_value || 0), 0);
  // Rough estimation: 1 degree is ~69 miles. Let's assume 30mph average speed.
  let routeDistanceMiles = 0;
  if (selectedRoutePoints.length > 1) {
    for (let i = 0; i < selectedRoutePoints.length - 1; i++) {
      const p1 = selectedRoutePoints[i];
      const p2 = selectedRoutePoints[i+1];
      const distDeg = Math.sqrt(Math.pow(p1.latitude - p2.latitude, 2) + Math.pow(p1.longitude - p2.longitude, 2));
      routeDistanceMiles += distDeg * 69;
    }
  }
  const routeTimeMinutes = Math.round((routeDistanceMiles / 30) * 60) + (selectedRoutePoints.length * 15); // 15 mins per stop

  const handleDeepSeekSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setShowSearchModal(true);
    setSearchResult(null);

    try {
      const result = await searchSalvageWithDeepSeek(searchQuery);
      setSearchResult(result);
    } catch (err: any) {
      console.error(err);
      setSearchResult(`SEARCH ERROR: ${err.message || "Failed to connect to DeepSeek Intelligence."}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col relative bg-zinc-950">
      {/* HVT Alert Banner */}
      {hvtAlert && (
        <div className="absolute top-4 left-4 right-4 z-[2000] bg-zinc-950/90 backdrop-blur-xl text-zinc-50 rounded-2xl shadow-[0_0_40px_-10px_rgba(239,68,68,0.5)] border border-red-500/30 p-4 animate-in slide-in-from-top-4 fade-in duration-500 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(239,68,68,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[slide_1s_linear_infinite]" />
          <div className="relative z-10 flex items-start gap-3">
            <div className="bg-red-500/20 text-red-400 p-2 rounded-full shrink-0 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              <BellRing size={24} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold tracking-widest uppercase text-sm flex items-center gap-2 text-red-400">
                  High-Value Target Detected
                  {hvtAlert.is_founder_exclusive && subscriptionStatus === 'founder' && (
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">Founder Early Access</span>
                  )}
                </h3>
                <button onClick={() => setHvtAlert(null)} className="text-zinc-400 hover:text-zinc-50 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-300 mt-1 font-mono">{hvtAlert.title}</p>
              <p className="text-lg font-bold mt-1 font-mono tracking-wider text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">EST: ${hvtAlert.estimated_total_value}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header overlay */}
      {isNavigating ? (
        <div className="absolute top-0 left-0 right-0 z-[1000] bg-zinc-950/95 backdrop-blur-2xl border-b border-emerald-500/30 shadow-[0_10px_40px_rgba(16,185,129,0.15)] animate-in slide-in-from-top-full duration-500">
          <div className="p-4 flex items-center gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-2xl border border-emerald-500/30">
              {(() => {
                const TurnIcon = mockTurns[mockTurnIndex].icon;
                return <TurnIcon size={32} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />;
              })()}
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-zinc-50 tracking-tight font-display">
                {mockTurns[mockTurnIndex].dist}
              </p>
              <p className="text-sm text-emerald-400/90 font-mono uppercase tracking-wider mt-0.5">
                {mockTurns[mockTurnIndex].text}
              </p>
            </div>
          </div>
          <div className="bg-emerald-950/50 px-4 py-2 border-t border-emerald-500/20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">
                Heading to: <span className="text-emerald-400">{selectedRoutePoints[currentNavTargetIndex]?.title}</span>
              </span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded border border-emerald-500/30 font-mono uppercase tracking-widest">
              Stop {currentNavTargetIndex + 1} of {selectedRoutePoints.length}
            </span>
          </div>
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 z-[1000] bg-zinc-950/60 backdrop-blur-2xl border-b border-white/5 p-5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 tracking-widest uppercase font-display drop-shadow-sm">ScrapScout Map</h1>
              <p className="text-[10px] text-emerald-400/80 font-mono tracking-widest mt-0.5">SECTOR: {locationName}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {subscriptionStatus === 'founder' && (
                <div className="bg-purple-500/10 text-purple-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] backdrop-blur-md">
                  <Crown size={14} className="text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
                  <span className="text-[9px] font-bold tracking-widest uppercase">Founder Access</span>
                </div>
              )}
              {subscriptionStatus === 'pro' && (
                <div className="bg-emerald-500/10 text-emerald-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] backdrop-blur-md">
                  <Settings size={14} className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  <span className="text-[9px] font-bold tracking-widest uppercase">Pro Access</span>
                </div>
              )}
            </div>
          </div>

          {/* DeepSeek Search Bar */}
          <form onSubmit={handleDeepSeekSearch} className="mt-5 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search salvage with DeepSeek Intelligence..."
              className="relative w-full bg-zinc-900/80 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-mono shadow-inner"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 hover:text-emerald-300 transition-all border border-emerald-500/20"
            >
              <Sparkles size={16} />
            </button>
          </form>
          
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 hide-scrollbar">
            <button 
              onClick={() => setLegalMode('legal_only')}
              className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all border ${
                legalMode === 'legal_only' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              Legal Only
            </button>
            <button 
              onClick={() => setLegalMode('permission_hunter')}
              className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all border ${
                legalMode === 'permission_hunter' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              + Permission
            </button>
            <button 
              onClick={() => setLegalMode('all')}
              className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all border ${
                legalMode === 'all' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              Show All
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 z-10">
          <div className="relative">
            <Loader2 className="animate-spin text-emerald-500 mb-4 relative z-10" size={40} />
            <div className="absolute inset-0 bg-emerald-400 blur-md opacity-50 animate-pulse" />
          </div>
          <p className="text-slate-700 font-medium tracking-widest uppercase font-display animate-pulse">Scanning Sector...</p>
          <p className="text-xs text-zinc-400 mt-2 font-mono">Acquiring real-time telemetry</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 z-10 p-6 text-center">
          <div className="text-red-500 mb-4 text-2xl">⚠️</div>
          <p className="text-red-400 font-bold mb-2 tracking-widest uppercase font-display">Telemetry Error</p>
          <p className="text-sm text-red-500/70 font-mono">{error}</p>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          {/* Radar Sweep Overlay */}
          <div className="absolute inset-0 pointer-events-none z-[400] overflow-hidden">
            <div className="absolute top-1/2 left-1/2 w-[200vw] h-[200vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/5" />
            <div className="absolute top-1/2 left-1/2 w-[150vw] h-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/5" />
            <div className="absolute top-1/2 left-1/2 w-[100vw] h-[100vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/10" />
            <div className="absolute top-1/2 left-1/2 w-[50vw] h-[50vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/20" />
            
            <div 
              className="absolute top-1/2 left-1/2 w-[100vw] h-[100vw] origin-top-left"
              style={{ 
                background: 'conic-gradient(from 180deg at 0 0, rgba(79, 70, 229, 0) 0deg, rgba(79, 70, 229, 0.05) 60deg, rgba(79, 70, 229, 0.15) 90deg, rgba(79, 70, 229, 0) 90deg)',
                animation: 'radar-sweep 4s linear infinite'
              }}
            />
          </div>

          <MapContainer 
            center={userLocation || [29.4241, -98.4936]} 
            zoom={11} 
            className="w-full h-full"
            zoomControl={false}
          >
            {userLocation && <MapCenterer center={userLocation} />}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            
            {/* User Location Marker */}
            {userLocation && (
              <Marker 
                position={userLocation}
                icon={new L.DivIcon({
                  className: 'custom-div-icon',
                  html: `<div class="marker-pulse" style="--pulse-color: #3B82F6; background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(59,130,246,0.8);"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })}
              >
                <Popup className="rounded-xl overflow-hidden custom-popup">
                  <div className="p-2 min-w-[150px] bg-zinc-900 text-zinc-50 font-sans text-center">
                    <h3 className="font-bold text-sm text-blue-400 uppercase tracking-widest">Your Location</h3>
                    <p className="text-xs text-zinc-400 font-mono mt-1">GPS Active</p>
                  </div>
                </Popup>
              </Marker>
            )}
          
          {filteredData.map(opp => {
            const isSelected = selectedRoutePoints.find(p => p.id === opp.id);
            const iconKey = opp.is_founder_exclusive ? `founder_${opp.legal_status}` : opp.legal_status;
            
            // Create a special icon if it's selected in route mode
            let currentIcon = icons[iconKey as keyof typeof icons] || icons.green;
            if (isRouteMode && isSelected) {
              const orderIndex = selectedRoutePoints.findIndex(p => p.id === opp.id) + 1;
              currentIcon = new L.DivIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #4F46E5; color: white; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">${orderIndex}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
              });
            }

            return (
              <Marker 
                key={opp.id} 
                position={[opp.latitude, opp.longitude]}
                icon={currentIcon}
                eventHandlers={{
                  click: () => handleMarkerClick(opp),
                }}
              >
                {!isRouteMode && (
                  <Popup className="rounded-xl overflow-hidden custom-popup">
                    <div className="p-1 min-w-[200px] bg-zinc-900 text-zinc-50 font-sans">
                      {opp.is_founder_exclusive && (
                        <div className="bg-purple-950/30 text-purple-400 text-[10px] font-bold px-2 py-1 rounded mb-2 flex items-center gap-1 border border-purple-500/20 uppercase tracking-widest">
                          <Crown size={12} />
                          FOUNDER EXCLUSIVE
                          <span className="ml-auto flex items-center gap-0.5 text-purple-500/80">
                            <Clock size={10} />
                            Unlocks in 1h 59m
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2 border-b border-zinc-800/50 pb-2">
                        <span className={`w-2 h-2 rounded-full ${
                          opp.legal_status === 'green' ? 'bg-emerald-950/300' :
                          opp.legal_status === 'yellow' ? 'bg-amber-950/300' : 'bg-red-950/300'
                        }`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          {opp.legal_status === 'green' ? 'Fully Legal' :
                           opp.legal_status === 'yellow' ? 'Permission Needed' : 'High Risk'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm mb-1 text-zinc-50 uppercase tracking-wide">{opp.title}</h3>
                      <p className="text-xs text-zinc-300 mb-2 max-h-32 overflow-y-auto pr-1 leading-relaxed">{opp.description}</p>
                      {opp.start_date && (
                        <p className="text-[10px] text-zinc-500 mb-2 font-mono uppercase">📅 {opp.start_date}</p>
                      )}
                      {opp.estimated_total_value !== undefined && (
                        <div className="bg-emerald-950/30 border border-emerald-100 rounded p-2 mb-2">
                          <p className="text-[9px] uppercase font-bold text-emerald-400 tracking-widest">Live Est. Value</p>
                          <p className="text-sm font-bold text-emerald-400 font-mono">${opp.estimated_total_value}</p>
                        </div>
                      )}
                      {opp.items_expected && opp.items_expected.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {opp.items_expected.map(item => (
                            <span key={item} className="bg-zinc-800 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Popup>
                )}
              </Marker>
            );
          })}
          
          {optimizedRoute && (
            <Polyline 
              positions={optimizedRoute} 
              color="#4F46E5" 
              weight={4} 
              opacity={0.8} 
              dashArray="10, 10"
            />
          )}
        </MapContainer>
        </div>
      )}

      {/* Route Optimization UI */}
      {isRouteMode ? (
        <div className={`absolute bottom-24 left-4 right-4 z-[1000] bg-zinc-950/80 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden animate-in slide-in-from-bottom-8 duration-500 flex flex-col ${isNavigating ? 'max-h-[30vh]' : 'max-h-[60vh]'}`}>
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/30">
            <h3 className="font-bold text-zinc-50 flex items-center gap-2 tracking-widest uppercase text-xs font-display">
              {isNavigating ? (
                <><Car size={16} className="text-emerald-400 animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> Navigation Active</>
              ) : (
                <><Navigation size={16} className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> Route Planner</>
              )}
            </h3>
            <button onClick={toggleRouteMode} className="p-1.5 bg-zinc-800/50 rounded-full text-zinc-400 hover:text-zinc-50 hover:bg-zinc-700 transition-colors">
              <X size={14} />
            </button>
          </div>
          
          {!isNavigating && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 hide-scrollbar">
              {selectedRoutePoints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
                  <MapPin size={32} className="mb-3 opacity-50" />
                  <p className="text-[10px] font-mono uppercase tracking-widest">Select targets on map</p>
                </div>
              ) : (
                selectedRoutePoints.map((point, index) => (
                  <div key={point.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-white/5 rounded-2xl shadow-sm group hover:bg-zinc-900 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-zinc-100 truncate uppercase tracking-widest">{point.title}</h4>
                      <p className="text-[10px] text-emerald-400/80 font-mono font-medium mt-0.5">${point.estimated_total_value}</p>
                    </div>
                    <button 
                      onClick={() => removeRoutePoint(point.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {selectedRoutePoints.length > 0 && (
            <div className="p-4 bg-zinc-950 border-t border-white/5">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-5">
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Est. Value</p>
                    <p className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-0.5 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">
                      <DollarSign size={16} />{routeTotalValue}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-zinc-800"></div>
                  <div>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Time / Dist</p>
                    <p className="text-sm font-bold text-zinc-300 font-mono">
                      {isNavigating ? `${Math.max(1, routeTimeMinutes - (currentNavTargetIndex * 15) - (mockTurnIndex * 2))}m` : `${routeTimeMinutes}m`} <span className="text-zinc-600 font-normal">/ {isNavigating ? Math.max(0.1, routeDistanceMiles - (currentNavTargetIndex * 5) - (mockTurnIndex * 0.5)).toFixed(1) : routeDistanceMiles.toFixed(1)}mi</span>
                    </p>
                  </div>
                </div>
              </div>
              
              {!isNavigating ? (
                <div className="flex gap-2">
                  {!optimizedRoute && selectedRoutePoints.length > 1 && (
                    <button 
                      onClick={calculateRoute}
                      disabled={isCalculatingRoute}
                      className="flex-1 py-3 rounded-xl font-bold text-[10px] bg-zinc-900 text-emerald-400 border border-emerald-500/20 shadow-sm hover:bg-zinc-800 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isCalculatingRoute ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                      {isCalculatingRoute ? 'Optimizing...' : 'Optimize'}
                    </button>
                  )}
                  <button 
                    onClick={startNavigation}
                    disabled={selectedRoutePoints.length === 0}
                    className="flex-[2] py-3 rounded-xl font-bold text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:bg-emerald-500/30 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    <Navigation size={14} /> Start Route
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (mockTurnIndex < mockTurns.length - 1) {
                          setMockTurnIndex(prev => prev + 1);
                        } else {
                          // Arrived at stop
                          if (currentNavTargetIndex < selectedRoutePoints.length - 1) {
                            setCurrentNavTargetIndex(prev => prev + 1);
                            setMockTurnIndex(0);
                          } else {
                            // Finished route
                            alert("Route Complete!");
                            toggleRouteMode();
                          }
                        }
                      }}
                      className="flex-[2] py-3 rounded-xl font-bold text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:bg-emerald-500/30 transition-colors uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      {mockTurnIndex < mockTurns.length - 1 ? (
                        <><ArrowUp size={14} /> Next Turn</>
                      ) : (
                        <><CheckCircle2 size={14} /> Mark Collected</>
                      )}
                    </button>
                    <button 
                      onClick={() => setIsNavigating(false)}
                      className="flex-1 py-3 rounded-xl font-bold text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm hover:bg-red-500/20 transition-colors uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <X size={14} /> End
                    </button>
                  </div>

                  {routeRationale && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                      <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Sparkles size={12} /> AI Strategy</h4>
                      <p className="text-xs text-emerald-300/80 font-mono leading-relaxed">{routeRationale}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <button 
          onClick={toggleRouteMode}
          className="absolute bottom-28 right-4 z-[1000] bg-zinc-900/80 backdrop-blur-md border border-white/10 text-emerald-400 p-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-zinc-800 hover:scale-105 transition-all flex items-center gap-2"
        >
          <Navigation size={22} />
        </button>
      )}

      {/* Scout Report Button */}
      <button 
        onClick={handleGenerateScoutReport}
        className="absolute bottom-48 right-4 z-[1000] bg-zinc-900/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 p-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-zinc-800 hover:scale-105 transition-all flex items-center gap-2 group"
      >
        <Sparkles size={22} className="group-hover:rotate-12 transition-transform" />
        <div className="absolute right-full mr-3 px-3 py-1.5 bg-zinc-900 border border-emerald-500/20 rounded-lg text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Scout Intelligence
        </div>
      </button>

      {/* Scout Report Modal */}
      {showScoutReport && (
        <div className="absolute inset-0 z-[2500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-950 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-[0_0_60px_rgba(16,185,129,0.2)] border border-emerald-500/30 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-5 border-b border-emerald-500/20 flex justify-between items-center bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                  <Sparkles size={18} />
                </div>
                <h2 className="font-bold text-emerald-100 tracking-[0.2em] uppercase text-xs font-display">
                  Strategic Scout Report
                </h2>
              </div>
              <button 
                onClick={() => setShowScoutReport(false)}
                className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-zinc-500 hover:text-emerald-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 relative hide-scrollbar">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />
              
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center h-64 text-emerald-500 relative z-10">
                  <div className="relative mb-6">
                    <Loader2 className="animate-spin text-emerald-400 relative z-10 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]" size={48} />
                    <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-20 animate-pulse" />
                  </div>
                  <p className="text-xs font-bold tracking-[0.3em] uppercase font-mono animate-pulse text-emerald-400/80">Compiling Sector Intelligence...</p>
                  <div className="mt-4 w-48 h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-zinc-300 relative z-10 font-mono text-[11px] leading-relaxed">
                  <Markdown>{scoutReport || ''}</Markdown>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-emerald-500/20 bg-emerald-950/10 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[9px] text-emerald-500/60 font-mono uppercase tracking-widest">
                <ShieldCheck size={12} />
                Verified Intelligence
              </div>
              <button 
                onClick={() => setShowScoutReport(false)}
                className="px-6 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DeepSeek Search Modal */}
      {showSearchModal && (
        <div className="absolute inset-0 z-[2000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <h2 className="font-bold text-emerald-400 flex items-center gap-2 tracking-widest uppercase text-xs font-display drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                <Sparkles size={16} className="text-emerald-400" />
                DeepSeek Intelligence
              </h2>
              <button 
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-emerald-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 relative hide-scrollbar">
              {/* Matrix Background Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
              
              {isSearching ? (
                <div className="flex flex-col items-center justify-center h-48 text-emerald-500 relative z-10">
                  <div className="relative">
                    <Loader2 className="animate-spin mb-4 text-emerald-400 relative z-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" size={40} />
                    <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 animate-pulse" />
                  </div>
                  <p className="text-[10px] font-medium tracking-widest uppercase font-mono animate-pulse text-emerald-400/80">Querying DeepSeek Core...</p>
                </div>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-zinc-300 relative z-10 font-mono text-xs leading-relaxed">
                  <Markdown>{searchResult || ''}</Markdown>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/5 bg-zinc-900/30 flex justify-end">
              <button 
                onClick={() => setShowSearchModal(false)}
                className="px-5 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-500/20 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
