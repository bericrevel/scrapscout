import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import {
  Camera as CameraIcon,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  Image as ImageIcon,
  RefreshCw,
  X,
  Home as HomeIcon,
  Boxes,
  ScanLine,
  DollarSign,
  Weight,
  Plus,
  Check,
  MapPin,
  Phone,
  Navigation,
  Globe,
  Star,
  Search,
  LocateFixed,
  Map as MapIcon,
  List,
  Clock,
  TrendingUp,
  NotebookPen,
  MessageSquare,
  Scale,
  Tag,
  Pin,
  CalendarDays,
  Landmark,
  Zap,
  Share2,
} from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { PluginListenerHandle } from "@capacitor/core";
import { takePhoto, pickPhoto, isCancel, CapturedPhoto } from "./lib/camera";
import { identifyItem, ScoutResult } from "./lib/scout";
import {
  InventoryItem,
  ItemStatus,
  loadInventory,
  saveInventory,
  fromScan,
  estimatedValue,
  realizedCash,
} from "./lib/inventory";
import { Place, getCachedPlace, cachePlace, locateMe, searchPlace } from "./lib/geo";
import {
  Yard,
  YardNote,
  findYards,
  loadYardNotes,
  saveYardNotes,
  allLoggedPrices,
} from "./lib/yards";
import { getSpotPrices, SpotResult } from "./lib/prices";
import type { ListingInput } from "./lib/scout";
import ChatScreen from "./screens/ChatScreen";
import ListingScreen from "./screens/ListingScreen";
import BuyerScreen from "./screens/BuyerScreen";
import SpotsScreen from "./screens/SpotsScreen";
import PlannerScreen from "./screens/PlannerScreen";
import LawsScreen from "./screens/LawsScreen";
import ProScreen from "./screens/ProScreen";
import EbayCompsPanel from "./components/EbayCompsPanel";
import { Share } from "@capacitor/share";
import { ProState, refreshEntitlement, loadAiCount, bumpAiCount } from "./lib/pro";

const YardMap = lazy(() => import("./components/YardMap"));

// Move verdicts. Bright fills carry near-black text — WCAG-safe on purpose.
const MOVES: Record<string, { label: string; fill: string; sub: string }> = {
  resell: { label: "RESELL IT", fill: "#4ADE80", sub: "Worth more whole than as metal" },
  scrap: { label: "SCRAP IT", fill: "#60A5FA", sub: "Fastest cash — take it to the yard" },
  part_out: { label: "PART IT OUT", fill: "#FBBF24", sub: "The pieces beat the whole" },
  skip: { label: "SKIP IT", fill: "#F87171", sub: "Not worth your time" },
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  have: "ON HAND",
  sold: "SOLD",
  scrapped: "SCRAPPED",
  skipped: "SKIPPED",
};

// Quick-fill chips for logging what YOUR yard pays — the user types their own
// real numbers; these are just common material names, not prices.
const MATERIAL_CHIPS = [
  "Copper #1",
  "Copper #2",
  "Insulated wire",
  "Brass",
  "Aluminum",
  "Alu cans",
  "Stainless",
  "Light iron",
  "Cast iron",
  "Lead",
];

type Screen =
  | "home"
  | "scan"
  | "result"
  | "inventory"
  | "yards"
  | "yardDetail"
  | "prices"
  | "chat"
  | "listing"
  | "buyer"
  | "spots"
  | "planner"
  | "laws"
  | "pro";

// The deal: free until $100 REAL cash collected or 150 AI actions — whichever
// lands first. AI actions = scans, chat turns, listing drafts, buyer triages
// (the things that cost real money to serve). Everything that's YOURS —
// inventory, pins, plan, yards, prices, laws — stays free forever.
const CASH_TRIGGER = 100;
const AI_TRIGGER = 150;

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoutResult | null>(null);
  const [savedToInv, setSavedToInv] = useState(false);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [cashModal, setCashModal] = useState<{ id: string; as: "sold" | "scrapped" } | null>(null);
  const [cashPrice, setCashPrice] = useState("");

  // ---- Yards state ----
  const [place, setPlace] = useState<Place | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<Place[] | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [yards, setYards] = useState<Yard[]>([]);
  const [yardsLoading, setYardsLoading] = useState(false);
  const [yardsError, setYardsError] = useState<string | null>(null);
  const [yardsFetchedAt, setYardsFetchedAt] = useState<number | null>(null);
  const [radius, setRadius] = useState(25);
  const [showMap, setShowMap] = useState(false);
  const [selectedYard, setSelectedYard] = useState<Yard | null>(null);
  const [yardNotes, setYardNotes] = useState<Record<string, YardNote>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [logMaterial, setLogMaterial] = useState("");
  const [logPrice, setLogPrice] = useState("");

  // ---- Prices state ----
  const [spot, setSpot] = useState<SpotResult | null>(null);
  const [spotLoading, setSpotLoading] = useState(false);

  // ---- Listing generator prefill (from a scan result or buyer triage) ----
  const [listingPrefill, setListingPrefill] = useState<ListingInput | null>(null);
  // Remounts the listing screen when a new prefill arrives
  const [listingSession, setListingSession] = useState(0);

  // ---- Pro gate ----
  const [proState, setProState] = useState<ProState | null>(null);
  const [aiCount, setAiCount] = useState(0);

  useEffect(() => {
    loadInventory().then(setInventory);
    loadYardNotes().then(setYardNotes);
    getCachedPlace().then(setPlace);
    refreshEntitlement().then(setProState);
    loadAiCount().then(setAiCount);
  }, []);

  // Re-check Pro when the app returns to the foreground — how the unlock
  // lands after Stripe Checkout finishes in the browser tab.
  useEffect(() => {
    let handle: PluginListenerHandle | undefined;
    let unmounted = false;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      refreshEntitlement({ force: screenRef.current === "pro" }).then(setProState);
    }).then((h) => {
      if (unmounted) h.remove();
      else handle = h;
    });
    return () => {
      unmounted = true;
      handle?.remove();
    };
  }, []);

  const cleanedPrice = cashPrice.replace(/[^0-9.]/g, "");
  const parsedPrice = parseFloat(cleanedPrice);
  const priceValid = cleanedPrice !== "" && Number.isFinite(parsedPrice) && parsedPrice >= 0;

  const cleanedLog = logPrice.replace(/[^0-9.]/g, "");
  const parsedLog = parseFloat(cleanedLog);
  const logValid = cleanedLog !== "" && Number.isFinite(parsedLog) && parsedLog >= 0 && logMaterial.trim() !== "";

  const est = estimatedValue(inventory);
  const cash = realizedCash(inventory);
  const onHand = inventory.filter((i) => i.status === "have");

  const isPro = !!proState?.pro;
  const cashGate = cash >= CASH_TRIGGER;
  const actionsGate = aiCount >= AI_TRIGGER;
  const proGateActive = (cashGate || actionsGate) && !isPro;
  // When both landed, the flattering story wins the copy.
  const gateReason: "cash" | "actions" | null = !proGateActive ? null : cashGate ? "cash" : "actions";

  /** Count one successful AI action (failed calls never count). */
  const onAiAction = () => {
    setAiCount((prev) => {
      bumpAiCount(prev);
      return prev + 1;
    });
  };

  /** Route to an AI screen, or to the Pro pitch when the gate is active. */
  const openGated = (go: () => void) => {
    if (proGateActive) setScreen("pro");
    else go();
  };

  const resetScan = useCallback(() => {
    setPhoto(null);
    setResult(null);
    setScanError(null);
    setSavedToInv(false);
    setScreen("scan");
  }, []);

  // ---- Android hardware back ----
  const screenRef = useRef<Screen>("home");
  const modalRef = useRef(false);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => {
    modalRef.current = cashModal !== null;
  }, [cashModal]);
  useEffect(() => {
    let handle: PluginListenerHandle | undefined;
    let unmounted = false;
    CapApp.addListener("backButton", () => {
      if (modalRef.current) {
        setCashModal(null);
        return;
      }
      const s = screenRef.current;
      if (s === "result") resetScan();
      else if (s === "yardDetail") setScreen("yards");
      else if (s === "home") CapApp.exitApp();
      else setScreen("home");
    }).then((h) => {
      if (unmounted) h.remove();
      else handle = h;
    });
    return () => {
      unmounted = true;
      handle?.remove();
    };
  }, [resetScan]);

  // ---- Scan flow ----
  const runScan = async (p: CapturedPhoto) => {
    setPhoto(p);
    setScanError(null);
    setScanning(true);
    setSavedToInv(false);
    try {
      const parsed = await identifyItem(p.base64, p.mediaType);
      if (parsed.item === "unclear") {
        setScanError(parsed.reason || "Couldn't get a clear read. Try one more angle, closer up.");
      } else {
        onAiAction(); // usable verdicts only — failed reads stay free
        setResult(parsed);
        setScreen("result");
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed. Tap Try Again.");
    } finally {
      setScanning(false);
    }
  };

  const onTakePhoto = async () => {
    if (proGateActive) {
      setScreen("pro");
      return;
    }
    try {
      const p = await takePhoto();
      await runScan(p);
    } catch (err) {
      if (isCancel(err)) return;
      setScanError(err instanceof Error ? err.message : "Camera failed. Try again.");
    }
  };

  const onPickPhoto = async () => {
    if (proGateActive) {
      setScreen("pro");
      return;
    }
    try {
      const p = await pickPhoto();
      await runScan(p);
    } catch (err) {
      if (isCancel(err)) return;
      setScanError(err instanceof Error ? err.message : "Couldn't open photos. Try again.");
    }
  };

  const retryScan = () => {
    if (photo) runScan(photo);
  };

  // ---- Inventory ----
  const addToInventory = async () => {
    if (!result || savedToInv) return;
    const next = [fromScan(result), ...inventory];
    setInventory(next);
    setSavedToInv(true);
    await saveInventory(next);
  };

  const confirmCash = async () => {
    if (!cashModal || !priceValid) return;
    const next = inventory.map((i) =>
      i.id === cashModal.id ? { ...i, status: cashModal.as, cashedFor: parsedPrice, cashedAt: Date.now() } : i
    );
    setInventory(next);
    setCashModal(null);
    setCashPrice("");
    await saveInventory(next);
  };

  const deleteItem = async (id: string) => {
    const next = inventory.filter((i) => i.id !== id);
    setInventory(next);
    setPendingDelete(null);
    await saveInventory(next);
  };

  // ---- Yards flow ----
  const searchYards = useCallback(
    async (p: Place, r: number, force = false) => {
      setYardsLoading(true);
      setYardsError(null);
      try {
        const res = await findYards(p.lat, p.lng, r, { force });
        setYards(res.yards);
        setYardsFetchedAt(res.fetchedAt);
      } catch (err) {
        setYardsError(err instanceof Error ? err.message : "Couldn't load yards. Try again.");
      } finally {
        setYardsLoading(false);
      }
    },
    []
  );

  const openYards = () => {
    setScreen("yards");
    if (place && yards.length === 0 && !yardsLoading) {
      searchYards(place, radius);
    }
  };

  const useMyLocation = async () => {
    setPlaceBusy(true);
    setYardsError(null);
    setPlaceResults(null);
    try {
      const p = await locateMe();
      setPlace(p);
      await searchYards(p, radius);
    } catch (err) {
      setYardsError(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setPlaceBusy(false);
    }
  };

  const runPlaceSearch = async () => {
    if (!placeQuery.trim()) return;
    setPlaceBusy(true);
    setYardsError(null);
    try {
      const results = await searchPlace(placeQuery);
      if (results.length === 0) {
        setYardsError("Couldn't find that place. Try a city name or ZIP.");
        setPlaceResults(null);
      } else {
        setPlaceResults(results);
      }
    } catch (err) {
      setYardsError(err instanceof Error ? err.message : "Search failed. Try again.");
    } finally {
      setPlaceBusy(false);
    }
  };

  const pickPlace = async (p: Place) => {
    setPlace(p);
    setPlaceResults(null);
    setPlaceQuery("");
    await cachePlace(p);
    await searchYards(p, radius);
  };

  const widenSearch = () => {
    const r = 50;
    setRadius(r);
    if (place) searchYards(place, r);
  };

  const openYardDetail = (y: Yard) => {
    setSelectedYard(y);
    setNoteDraft(yardNotes[y.id]?.note || "");
    setNoteSaved(false);
    setLogMaterial("");
    setLogPrice("");
    setScreen("yardDetail");
  };

  const saveNote = async () => {
    if (!selectedYard) return;
    const next = {
      ...yardNotes,
      [selectedYard.id]: {
        ...(yardNotes[selectedYard.id] || { prices: [] }),
        note: noteDraft,
        name: selectedYard.name,
      },
    };
    setYardNotes(next);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
    await saveYardNotes(next);
  };

  const logYardPrice = async () => {
    if (!selectedYard || !logValid) return;
    const existing = yardNotes[selectedYard.id] || { note: "", prices: [] };
    const next = {
      ...yardNotes,
      [selectedYard.id]: {
        ...existing,
        name: selectedYard.name,
        prices: [{ material: logMaterial.trim(), perLb: parsedLog, date: Date.now() }, ...(existing.prices || [])],
      },
    };
    setYardNotes(next);
    setLogMaterial("");
    setLogPrice("");
    await saveYardNotes(next);
  };

  // ---- Prices flow ----
  const loadSpot = async (force = false) => {
    setSpotLoading(true);
    const res = await getSpotPrices({ force });
    setSpot(res);
    setSpotLoading(false);
  };

  const openPrices = () => {
    setScreen("prices");
    if (!spot && !spotLoading) loadSpot();
  };

  const myPrices = allLoggedPrices(yardNotes, (id) => yardNotes[id]?.name || "a yard");

  const move = result ? MOVES[result.move] || MOVES.scrap : null;

  const openExternal = (url: string) => Browser.open({ url });

  // ---- Toolbox navigation ----
  const openListingFor = (input: ListingInput | null) => {
    setListingPrefill(input);
    setListingSession((n) => n + 1);
    setScreen("listing");
  };

  const draftFromInventory = (i: InventoryItem) =>
    openListingFor({
      item: i.item,
      category: i.category,
      resaleLow: i.resaleLow,
      resaleHigh: i.resaleHigh,
    });

  const TabBar = () => (
    <div className="flex border-t border-edge bg-panel">
      {(
        [
          { id: "home", label: "Home", icon: HomeIcon, go: () => setScreen("home") },
          { id: "scan", label: "Scan", icon: ScanLine, go: resetScan },
          { id: "yards", label: "Yards", icon: MapPin, go: openYards },
          { id: "prices", label: "Prices", icon: TrendingUp, go: openPrices },
          { id: "inventory", label: "Items", icon: Boxes, go: () => setScreen("inventory") },
        ] as const
      ).map((t) => {
        const active =
          screen === t.id ||
          (t.id === "scan" && screen === "result") ||
          (t.id === "yards" && screen === "yardDetail");
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={t.go} className="flex-1 flex flex-col items-center gap-1 py-2.5" aria-label={t.label}>
            <Icon size={19} color={active ? "#4ADE80" : "#7A8494"} />
            <span className="term-font text-[9.5px] tracking-widest" style={{ color: active ? "#4ADE80" : "#7A8494" }}>
              {t.label.toUpperCase()}
            </span>
          </button>
        );
      })}
    </div>
  );

  const TopBar = ({ title, onBack }: { title: string; onBack?: () => void }) => (
    <div className="flex items-center gap-2 px-4 py-3.5 bg-panel border-b border-edge">
      {onBack && (
        <button onClick={onBack} className="p-1 -ml-1" aria-label="Back">
          <ChevronLeft size={22} color="#B8C0CC" />
        </button>
      )}
      <span className="term-font font-bold text-lg tracking-wide text-white truncate">{title}</span>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-ink text-mist overflow-hidden sans-font">
      {/* ============ HOME ============ */}
      {screen === "home" && (
        <>
          <div className="flex-1 overflow-y-auto scan-glow">
            <div className="px-6 pt-10 pb-6">
              <div className="term-font font-extrabold text-3xl text-white leading-tight">
                Scrap<span style={{ color: "#4ADE80" }}>Scout</span>
              </div>
              <div className="text-sm text-faint mt-1">Point. Identify. Get paid.</div>
            </div>

            <div className="px-6 flex flex-col gap-4">
              <button
                onClick={resetScan}
                className="w-full py-6 rounded-2xl term-font font-extrabold text-xl tracking-wide flex items-center justify-center gap-3"
                style={{ background: "#4ADE80", color: "#0A0E1A" }}
              >
                <ScanLine size={24} /> SCAN SOMETHING
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={openYards} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <MapPin size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">Find a yard</div>
                  <div className="text-xs text-faint mt-0.5">real OpenStreetMap data</div>
                </button>
                <button onClick={openPrices} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <TrendingUp size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">Metal prices</div>
                  <div className="text-xs text-faint mt-0.5">spot + what your yard pays</div>
                </button>
                <button onClick={() => openGated(() => setScreen("chat"))} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <MessageSquare size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">Ask the scout</div>
                  <div className="text-xs text-faint mt-0.5">grades, yard runs, safety</div>
                </button>
                <button onClick={() => openGated(() => setScreen("buyer"))} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <Scale size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">Triage my pile</div>
                  <div className="text-xs text-faint mt-0.5">list it vs scrap it now</div>
                </button>
                <button onClick={() => setScreen("spots")} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <Pin size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">My spots</div>
                  <div className="text-xs text-faint mt-0.5">your pins + free-stuff launchers</div>
                </button>
                <button onClick={() => setScreen("planner")} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <CalendarDays size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">The plan</div>
                  <div className="text-xs text-faint mt-0.5">curb days, runs, reminders</div>
                </button>
                <button onClick={() => setScreen("laws")} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <Landmark size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">Know the rules</div>
                  <div className="text-xs text-faint mt-0.5">ID, cats, curb law, never-scrap list</div>
                </button>
                <button onClick={() => openGated(() => openListingFor(null))} className="bg-panel border border-edge rounded-xl p-4 text-left">
                  <Tag size={18} color="#4ADE80" />
                  <div className="text-sm text-white font-semibold mt-2">Draft a listing</div>
                  <div className="text-xs text-faint mt-0.5">ad copy + real eBay asks</div>
                </button>
              </div>

              {isPro ? (
                <div className="bg-panel border rounded-xl p-4" style={{ borderColor: "#4ADE80" }}>
                  <div className="flex items-center gap-2 text-sm text-white font-semibold">
                    <Zap size={15} color="#4ADE80" /> ScrapScout Pro — active
                  </div>
                  <button onClick={() => setScreen("pro")} className="text-xs text-faint underline mt-1">
                    manage subscription
                  </button>
                </div>
              ) : proGateActive ? (
                <div className="bg-panel border rounded-xl p-4" style={{ borderColor: "#4ADE80" }}>
                  <div className="text-sm text-white font-semibold">
                    {gateReason === "cash"
                      ? `You've collected $${cash.toFixed(0)} with ScrapScout. 🎉`
                      : `You've used your ${AI_TRIGGER} free AI actions.`}
                  </div>
                  <div className="text-xs text-faint mt-1">
                    The free deal was $100 collected or {AI_TRIGGER} AI actions. Your inventory,
                    pins, plan, yards, and prices stay free forever either way.
                  </div>
                  <button
                    onClick={() => setScreen("pro")}
                    className="mt-3 w-full py-2.5 rounded-lg term-font font-extrabold text-sm tracking-wide"
                    style={{ background: "#4ADE80", color: "#0A0E1A" }}
                  >
                    SEE PRO
                  </button>
                </div>
              ) : aiCount >= Math.floor(AI_TRIGGER / 2) ? (
                <div className="bg-panel border border-edge rounded-xl px-4 py-3 text-xs text-faint">
                  Free AI actions used: <b className="text-mist">{aiCount} of {AI_TRIGGER}</b>. The
                  deal: free until $100 collected or {AI_TRIGGER} actions — whichever lands first.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-panel border border-edge rounded-xl p-4">
                  <div className="term-font font-bold text-xl text-white">
                    ${est.low}–${est.high}
                  </div>
                  <div className="text-xs text-faint mt-1">
                    est. value on hand · {onHand.length} item{onHand.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="bg-panel border border-edge rounded-xl p-4">
                  <div className="term-font font-bold text-xl" style={{ color: "#4ADE80" }}>
                    ${cash.toFixed(0)}
                  </div>
                  <div className="text-xs text-faint mt-1">real cash collected</div>
                </div>
              </div>

              {inventory.length > 0 ? (
                <div>
                  <div className="term-font text-xs tracking-widest text-faint mb-2 mt-2">RECENT</div>
                  <div className="flex flex-col gap-2">
                    {inventory.slice(0, 4).map((i) => (
                      <button
                        key={i.id}
                        onClick={() => setScreen("inventory")}
                        className="flex items-center justify-between bg-panel border border-edge rounded-xl px-4 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">{i.item}</div>
                          <div className="text-xs text-faint">{STATUS_LABEL[i.status]}</div>
                        </div>
                        <div className="term-font text-sm text-mist flex-shrink-0 ml-3">
                          {i.status === "sold" || i.status === "scrapped"
                            ? `$${(i.cashedFor || 0).toFixed(0)}`
                            : `$${Math.max(i.scrapHigh, i.resaleHigh)}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-panel border border-edge rounded-xl p-5 text-sm text-faint">
                  Nothing scanned yet. Point the camera at that busted thing in the yard — let's
                  see what it's worth.
                </div>
              )}

              <button
                onClick={() =>
                  Share.share({
                    title: "ScrapScout",
                    text: "Scan junk for scrap + resale value, find yards, get paid. Free until it's made you $100.",
                    url: "https://play.google.com/store/apps/details?id=com.aerkatech.scrapscout",
                  }).catch(() => {})
                }
                className="w-full py-3 rounded-xl border border-edge text-mist text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Share2 size={14} /> Tell another scrapper
              </button>

              <div className="text-xs text-faint text-center pb-6 pt-1">
                Values are AI estimates — yards and buyers set real prices. Your inventory stays
                on this phone. ·{" "}
                <button onClick={() => Browser.open({ url: `${import.meta.env.VITE_API_BASE_URL || "https://aerkatech.com"}/privacy.html` })} className="underline">
                  privacy
                </button>
              </div>
            </div>
          </div>
          <TabBar />
        </>
      )}

      {/* ============ SCAN ============ */}
      {screen === "scan" && (
        <>
          <TopBar title="Scan" onBack={() => setScreen("home")} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 scan-glow">
            {photo && !result && (
              <img src={photo.previewUrl} alt="scanned item" className="w-48 h-48 object-cover rounded-xl border-2 border-edge" />
            )}
            {!photo && (
              <>
                <CameraIcon size={56} strokeWidth={1.5} color="#4ADE80" />
                <div className="text-center text-mist max-w-xs text-sm">
                  Electronics, appliances, auto parts, furniture, tools, plain scrap — if it
                  exists, it has a number.
                </div>
              </>
            )}
            {scanError && (
              <div className="w-full max-w-sm bg-panel border-2 border-alert rounded-xl p-4 text-sm flex gap-2">
                <AlertTriangle size={18} className="flex-shrink-0" color="#F87171" />
                <span>{scanError}</span>
              </div>
            )}
            {scanning && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="animate-spin" color="#4ADE80" />
                <div className="term-font text-sm tracking-widest text-faint">IDENTIFYING...</div>
              </div>
            )}
            {!scanning && photo && scanError && (
              <div className="w-full max-w-sm flex flex-col gap-3">
                <button
                  onClick={retryScan}
                  className="w-full py-4 rounded-xl term-font font-extrabold text-lg flex items-center justify-center gap-2"
                  style={{ background: "#4ADE80", color: "#0A0E1A" }}
                >
                  <RefreshCw size={18} /> TRY AGAIN
                </button>
                <button onClick={resetScan} className="w-full py-3 rounded-xl font-semibold border border-edge text-mist">
                  Scan a different item
                </button>
              </div>
            )}
            {!scanning && !(photo && scanError) && (
              <div className="w-full max-w-sm flex flex-col gap-3">
                <button
                  onClick={onTakePhoto}
                  className="w-full py-5 rounded-xl term-font font-extrabold text-xl tracking-wide"
                  style={{ background: "#4ADE80", color: "#0A0E1A" }}
                >
                  SCAN IT
                </button>
                <button
                  onClick={onPickPhoto}
                  className="w-full py-3 rounded-xl font-semibold border border-edge text-mist flex items-center justify-center gap-2"
                >
                  <ImageIcon size={16} /> Choose from gallery
                </button>
              </div>
            )}
          </div>
          <TabBar />
        </>
      )}

      {/* ============ RESULT ============ */}
      {screen === "result" && result && move && (
        <>
          <TopBar title="Verdict" onBack={resetScan} />
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {photo && (
                <img src={photo.previewUrl} alt={result.item} className="w-16 h-16 object-cover rounded-xl border border-edge flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="term-font font-bold text-xl text-white leading-tight">{result.item}</div>
                <div className="text-xs text-faint mt-0.5">{result.condition || result.category}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-4 border"
                style={{
                  borderColor: result.move === "scrap" ? "#60A5FA" : "#1F2937",
                  background: result.move === "scrap" ? "rgba(96,165,250,0.10)" : "#111827",
                }}
              >
                <div className="term-font text-[10px] tracking-widest text-faint">AT THE YARD</div>
                <div className="term-font font-bold text-xl text-white mt-1">
                  ${result.scrapLow}–${result.scrapHigh}
                </div>
                {result.weightLbs > 0 && (
                  <div className="text-xs text-faint mt-1 flex items-center gap-1">
                    <Weight size={11} /> ~{result.weightLbs} lbs
                  </div>
                )}
              </div>
              <div
                className="rounded-xl p-4 border"
                style={{
                  borderColor: result.move === "resell" ? "#4ADE80" : "#1F2937",
                  background: result.move === "resell" ? "rgba(74,222,128,0.10)" : "#111827",
                }}
              >
                <div className="term-font text-[10px] tracking-widest text-faint">RESOLD WHOLE</div>
                <div className="term-font font-bold text-xl text-white mt-1">
                  ${result.resaleLow}–${result.resaleHigh}
                </div>
                <div className="text-xs text-faint mt-1">used market</div>
              </div>
            </div>

            <div className="w-full rounded-xl py-5 flex flex-col items-center gap-1" style={{ background: move.fill }}>
              <span className="term-font font-extrabold text-2xl tracking-wide" style={{ color: "#0A0E1A" }}>
                {move.label}
              </span>
              <span className="text-sm font-medium" style={{ color: "rgba(10,14,26,0.75)" }}>
                {result.reason || move.sub}
              </span>
            </div>

            {result.safetyWarning && (
              <div className="bg-panel border-2 border-alert rounded-xl p-3 text-sm flex gap-2">
                <AlertTriangle size={18} className="flex-shrink-0" color="#F87171" />
                <span>{result.safetyWarning}</span>
              </div>
            )}

            {result.materials.length > 0 && (
              <div>
                <div className="term-font text-[10px] tracking-widest text-faint mb-2">WHAT'S IN IT</div>
                <div className="flex flex-wrap gap-2">
                  {result.materials.map((m, idx) => (
                    <span key={idx} className="bg-panel border border-edge rounded-full px-3 py-1.5 text-xs text-mist">
                      {m.name}
                      {m.estLbs > 0 ? ` · ~${m.estLbs} lb` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.move === "scrap" && (
              <button
                onClick={openYards}
                className="w-full py-3.5 rounded-xl font-semibold border flex items-center justify-center gap-2"
                style={{ borderColor: "#60A5FA", color: "#60A5FA" }}
              >
                <MapPin size={16} /> Find a yard near you
              </button>
            )}

            {(result.move === "resell" || result.move === "part_out") && (
              <>
                <button
                  onClick={() =>
                    openGated(() =>
                      openListingFor({
                        item: result.item,
                        category: result.category,
                        condition: result.condition,
                        resaleLow: result.resaleLow,
                        resaleHigh: result.resaleHigh,
                      })
                    )
                  }
                  className="w-full py-3.5 rounded-xl font-semibold border flex items-center justify-center gap-2"
                  style={{ borderColor: "#4ADE80", color: "#4ADE80" }}
                >
                  <Tag size={16} /> Draft the listing
                </button>
                <EbayCompsPanel query={result.item} />
              </>
            )}

            <button
              onClick={addToInventory}
              disabled={savedToInv}
              className="w-full py-4 rounded-xl term-font font-bold text-base flex items-center justify-center gap-2 border"
              style={
                savedToInv
                  ? { borderColor: "#4ADE80", color: "#4ADE80", background: "rgba(74,222,128,0.08)" }
                  : { borderColor: "#4ADE80", color: "#0A0E1A", background: "#4ADE80" }
              }
            >
              {savedToInv ? (
                <>
                  <Check size={18} /> IN YOUR INVENTORY
                </>
              ) : (
                <>
                  <Plus size={18} /> ADD TO INVENTORY
                </>
              )}
            </button>

            <button onClick={resetScan} className="text-center text-sm text-faint underline pb-2">
              Scan another item
            </button>

            <div className="text-xs text-faint text-center pb-4 -mt-1">
              Estimates, not appraisals. Yard prices vary — call ahead.
            </div>
          </div>
          <TabBar />
        </>
      )}

      {/* ============ YARDS ============ */}
      {screen === "yards" && (
        <>
          <TopBar title="Yards Near You" onBack={() => setScreen("home")} />
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            {/* Location chooser — GPS or typed, both honest paths */}
            <div className="flex gap-2">
              <button
                onClick={useMyLocation}
                disabled={placeBusy || yardsLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl term-font font-bold text-xs disabled:opacity-50"
                style={{ background: "#4ADE80", color: "#0A0E1A" }}
              >
                {placeBusy ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                MY LOCATION
              </button>
              <div className="flex-1 flex gap-2">
                <input
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runPlaceSearch()}
                  placeholder="city or ZIP"
                  className="min-w-0 flex-1 bg-panel border border-edge rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-scout"
                />
                <button
                  onClick={runPlaceSearch}
                  disabled={placeBusy || !placeQuery.trim()}
                  className="px-3 rounded-xl border border-edge disabled:opacity-40"
                  aria-label="Search place"
                >
                  <Search size={16} color="#B8C0CC" />
                </button>
              </div>
            </div>

            {placeResults && (
              <div className="flex flex-col gap-1.5">
                {placeResults.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => pickPlace(p)}
                    className="text-left bg-panel border border-edge rounded-xl px-4 py-2.5 text-sm text-mist"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {place && (
              <div className="flex items-center justify-between text-xs text-faint">
                <span className="truncate">
                  Near <b className="text-mist">{place.label}</b> · {radius} mi
                </span>
                {yardsFetchedAt && (
                  <button onClick={() => place && searchYards(place, radius, true)} className="underline flex-shrink-0 ml-2">
                    refresh
                  </button>
                )}
              </div>
            )}

            {yardsError && (
              <div className="bg-panel border-2 border-alert rounded-xl p-3.5 text-sm flex gap-2">
                <AlertTriangle size={17} className="flex-shrink-0" color="#F87171" />
                <span>{yardsError}</span>
              </div>
            )}

            {yardsLoading && (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 size={32} className="animate-spin" color="#4ADE80" />
                <div className="term-font text-xs tracking-widest text-faint">SEARCHING OPENSTREETMAP...</div>
              </div>
            )}

            {!place && !yardsLoading && !placeResults && (
              <div className="bg-panel border border-edge rounded-xl p-5 text-sm text-faint">
                Pick a location — tap <b className="text-mist">MY LOCATION</b> or type a city/ZIP.
                Yards come from real OpenStreetMap data.
              </div>
            )}

            {place && !yardsLoading && yards.length > 0 && (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMap(false)}
                    className="flex-1 py-2 rounded-lg text-xs term-font font-bold flex items-center justify-center gap-1.5 border"
                    style={
                      !showMap
                        ? { background: "#1F2937", color: "#4ADE80", borderColor: "#4ADE80" }
                        : { color: "#7A8494", borderColor: "#1F2937" }
                    }
                  >
                    <List size={13} /> LIST
                  </button>
                  <button
                    onClick={() => setShowMap(true)}
                    className="flex-1 py-2 rounded-lg text-xs term-font font-bold flex items-center justify-center gap-1.5 border"
                    style={
                      showMap
                        ? { background: "#1F2937", color: "#4ADE80", borderColor: "#4ADE80" }
                        : { color: "#7A8494", borderColor: "#1F2937" }
                    }
                  >
                    <MapIcon size={13} /> MAP
                  </button>
                </div>

                {showMap && (
                  <Suspense
                    fallback={
                      <div className="w-full h-72 rounded-xl border border-edge flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin" color="#4ADE80" />
                      </div>
                    }
                  >
                    <YardMap key={`${place.lat},${place.lng},${yards.length}`} center={place} yards={yards} onSelect={openYardDetail} />
                  </Suspense>
                )}

                {!showMap && (
                  <div className="flex flex-col gap-2">
                    {yards.map((y) => (
                      <button
                        key={y.id}
                        onClick={() => openYardDetail(y)}
                        className="text-left bg-panel border border-edge rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-white font-semibold truncate">{y.name}</div>
                          <div className="term-font text-xs flex-shrink-0" style={{ color: "#4ADE80" }}>
                            {y.miles} mi
                          </div>
                        </div>
                        <div className="text-xs text-faint mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{y.kind}</span>
                          {y.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={10} /> yes
                            </span>
                          )}
                          {y.hours && (
                            <span className="flex items-center gap-1 truncate">
                              <Clock size={10} /> {y.hours.slice(0, 28)}
                            </span>
                          )}
                          {yardNotes[y.id]?.note && (
                            <span className="flex items-center gap-1" style={{ color: "#FBBF24" }}>
                              <NotebookPen size={10} /> note
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {radius === 25 && (
                  <button onClick={widenSearch} className="py-2.5 rounded-xl border border-edge text-sm text-mist">
                    Search wider — 50 mi
                  </button>
                )}
                <div className="text-[11px] text-faint text-center pb-3">
                  Data © OpenStreetMap contributors. OSM doesn't list every yard — ask around
                  locally too.
                </div>
              </>
            )}

            {place && !yardsLoading && !yardsError && yards.length === 0 && yardsFetchedAt && (
              <div className="bg-panel border border-edge rounded-xl p-5 text-sm text-faint flex flex-col gap-3">
                <span>
                  <b className="text-mist">No yards mapped within {radius} mi</b> on OpenStreetMap.
                  That doesn't mean there are none — OSM coverage varies by county. Ask at the
                  hardware store, or search a nearby city.
                </span>
                {radius === 25 && (
                  <button
                    onClick={widenSearch}
                    className="self-start px-4 py-2 rounded-lg term-font font-bold text-xs"
                    style={{ background: "#4ADE80", color: "#0A0E1A" }}
                  >
                    SEARCH 50 MI
                  </button>
                )}
              </div>
            )}
          </div>
          <TabBar />
        </>
      )}

      {/* ============ YARD DETAIL ============ */}
      {screen === "yardDetail" && selectedYard && (
        <>
          <TopBar title={selectedYard.name} onBack={() => setScreen("yards")} />
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            <div className="text-xs text-faint">
              {selectedYard.kind} · {selectedYard.miles} mi away
              {selectedYard.address ? ` · ${selectedYard.address}` : ""}
            </div>
            {selectedYard.hours && (
              <div className="bg-panel border border-edge rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                <Clock size={15} className="flex-shrink-0 mt-0.5" color="#4ADE80" />
                <span className="text-mist">{selectedYard.hours}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {selectedYard.phone && (
                <button
                  onClick={() => {
                    window.location.href = `tel:${selectedYard.phone}`;
                  }}
                  className="py-3 rounded-xl term-font font-bold text-sm flex items-center justify-center gap-2"
                  style={{ background: "#4ADE80", color: "#0A0E1A" }}
                >
                  <Phone size={15} /> CALL
                </button>
              )}
              <button
                onClick={() =>
                  openExternal(
                    `https://www.google.com/maps/dir/?api=1&destination=${selectedYard.lat},${selectedYard.lng}`
                  )
                }
                className="py-3 rounded-xl term-font font-bold text-sm flex items-center justify-center gap-2 border"
                style={{ borderColor: "#4ADE80", color: "#4ADE80" }}
              >
                <Navigation size={15} /> DIRECTIONS
              </button>
              <button
                onClick={() =>
                  openExternal(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedYard.name} ${selectedYard.lat},${selectedYard.lng}`
                    )}`
                  )
                }
                className="py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-edge text-mist"
              >
                <Star size={15} /> Reviews on Google
              </button>
              {selectedYard.website && (
                <button
                  onClick={() => openExternal(selectedYard.website!)}
                  className="py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-edge text-mist"
                >
                  <Globe size={15} /> Website
                </button>
              )}
            </div>

            {!selectedYard.phone && (
              <div className="text-xs text-faint -mt-1">
                No phone listed on OpenStreetMap for this one — check its Google listing.
              </div>
            )}

            {/* My note — real user data, on-device */}
            <div>
              <div className="term-font text-[10px] tracking-widest text-faint mb-2">MY NOTE</div>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                placeholder="Gate hours, who to ask for, what they're picky about..."
                className="w-full bg-panel border border-edge rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-scout resize-none"
              />
              <button
                onClick={saveNote}
                className="mt-2 px-4 py-2 rounded-lg term-font font-bold text-xs flex items-center gap-2"
                style={
                  noteSaved
                    ? { background: "rgba(74,222,128,0.15)", color: "#4ADE80" }
                    : { background: "#4ADE80", color: "#0A0E1A" }
                }
              >
                {noteSaved ? (
                  <>
                    <Check size={13} /> SAVED
                  </>
                ) : (
                  "SAVE NOTE"
                )}
              </button>
            </div>

            {/* What THIS yard paid me — the most honest price data there is */}
            <div>
              <div className="term-font text-[10px] tracking-widest text-faint mb-2">WHAT THEY PAID ME ($/LB)</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MATERIAL_CHIPS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setLogMaterial(m)}
                    className="px-2.5 py-1 rounded-full text-[11px] border"
                    style={
                      logMaterial === m
                        ? { borderColor: "#4ADE80", color: "#4ADE80" }
                        : { borderColor: "#1F2937", color: "#7A8494" }
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={logMaterial}
                  onChange={(e) => setLogMaterial(e.target.value)}
                  placeholder="material"
                  className="min-w-0 flex-1 bg-panel border border-edge rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-scout"
                />
                <input
                  value={logPrice}
                  onChange={(e) => setLogPrice(e.target.value)}
                  placeholder="$/lb"
                  inputMode="decimal"
                  className="w-24 bg-panel border border-edge rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-scout"
                />
                <button
                  onClick={logYardPrice}
                  disabled={!logValid}
                  className="px-3.5 rounded-xl term-font font-bold text-xs disabled:opacity-40"
                  style={{ background: "#4ADE80", color: "#0A0E1A" }}
                >
                  LOG
                </button>
              </div>
              {(yardNotes[selectedYard.id]?.prices || []).length > 0 && (
                <div className="flex flex-col gap-1.5 mt-3">
                  {(yardNotes[selectedYard.id]?.prices || []).slice(0, 10).map((p, i) => (
                    <div key={i} className="flex justify-between text-sm bg-panel border border-edge rounded-lg px-3 py-2">
                      <span className="text-mist">{p.material}</span>
                      <span className="term-font text-white">
                        ${p.perLb.toFixed(2)}/lb{" "}
                        <span className="text-faint text-xs">{new Date(p.date).toLocaleDateString()}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[11px] text-faint text-center pb-3">
              Notes and logged prices live on this phone only.
            </div>
          </div>
          <TabBar />
        </>
      )}

      {/* ============ PRICES ============ */}
      {screen === "prices" && (
        <>
          <TopBar title="Metal Prices" onBack={() => setScreen("home")} />
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {/* Spot section — real API or honest setup state */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="term-font text-[10px] tracking-widest text-faint">EXCHANGE SPOT</div>
                {spot?.state === "ok" && (
                  <button
                    onClick={() => loadSpot(true)}
                    disabled={spotLoading}
                    className="text-xs text-faint underline disabled:opacity-40"
                  >
                    refresh
                  </button>
                )}
              </div>

              {spotLoading && !spot && (
                <div className="flex justify-center py-8">
                  <Loader2 size={28} className="animate-spin" color="#4ADE80" />
                </div>
              )}

              {spot?.state === "setup" && (
                <div className="bg-panel border border-edge rounded-xl p-4 text-sm text-faint flex flex-col gap-2">
                  <div className="text-white font-semibold">Spot prices aren't connected yet.</div>
                  <span>
                    They need a one-time free API key on the server (see README →{" "}
                    <span className="term-font text-xs">METALPRICE_API_KEY</span>). No fake numbers
                    here in the meantime — log what <b className="text-mist">your</b> yard pays below;
                    that's the number that actually matters.
                  </span>
                </div>
              )}

              {spot?.state === "error" && (
                <div className="bg-panel border-2 border-alert rounded-xl p-3.5 text-sm flex flex-col gap-2">
                  <div className="flex gap-2">
                    <AlertTriangle size={17} className="flex-shrink-0" color="#F87171" />
                    <span>{spot.message}</span>
                  </div>
                  <button
                    onClick={() => loadSpot(true)}
                    className="self-start px-4 py-1.5 rounded-lg term-font font-bold text-xs"
                    style={{ background: "#4ADE80", color: "#0A0E1A" }}
                  >
                    TRY AGAIN
                  </button>
                </div>
              )}

              {spot?.state === "ok" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    {spot.prices.map((p) => (
                      <div key={p.symbol} className="flex justify-between items-center bg-panel border border-edge rounded-lg px-4 py-2.5">
                        <span className="text-sm text-white">{p.name}</span>
                        <span className="term-font text-sm" style={{ color: "#4ADE80" }}>
                          ${p.price.toFixed(2)}
                          <span className="text-faint text-xs">/{p.unit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-faint mt-2">
                    Spot via metalpriceapi.com
                    {spot.fetchedAt ? ` · as of ${new Date(spot.fetchedAt).toLocaleString()}` : ""}
                    {spot.stale ? " · cached (couldn't refresh)" : ""}
                  </div>
                  <div className="bg-panel border border-edge rounded-xl px-4 py-3 text-xs text-faint mt-2">
                    <b className="text-mist">Yards pay under spot — usually 30–60% under</b> — and
                    set their own prices day to day. Call ahead. Brass, steel, and insulated wire
                    aren't exchange metals at all: for those, your logged yard prices below are the
                    real data.
                  </div>
                </>
              )}
            </div>

            {/* My yard prices — the user's own real numbers */}
            <div>
              <div className="term-font text-[10px] tracking-widest text-faint mb-2">WHAT MY YARDS PAID ($/LB)</div>
              {myPrices.length === 0 ? (
                <div className="bg-panel border border-edge rounded-xl p-4 text-sm text-faint">
                  Nothing logged yet. When a yard pays you, log the $/lb on that yard's page —
                  your own numbers beat any spot feed.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {myPrices.slice(0, 20).map((p, i) => (
                    <div key={i} className="bg-panel border border-edge rounded-lg px-4 py-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-white">{p.material}</span>
                        <span className="term-font" style={{ color: "#4ADE80" }}>
                          ${p.perLb.toFixed(2)}/lb
                        </span>
                      </div>
                      <div className="text-[11px] text-faint mt-0.5">
                        {p.yardName} · {new Date(p.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <TabBar />
        </>
      )}

      {/* ============ INVENTORY ============ */}
      {screen === "inventory" && (
        <>
          <TopBar title="Inventory" onBack={() => setScreen("home")} />
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-panel border border-edge rounded-xl p-4 text-center">
                <div className="term-font font-bold text-lg text-white">
                  ${est.low}–${est.high}
                </div>
                <div className="text-[11px] text-faint mt-0.5">est. on hand (AI guess)</div>
              </div>
              <div className="bg-panel border border-edge rounded-xl p-4 text-center">
                <div className="term-font font-bold text-lg" style={{ color: "#4ADE80" }}>
                  ${cash.toFixed(0)}
                </div>
                <div className="text-[11px] text-faint mt-0.5">real cash collected</div>
              </div>
            </div>

            {inventory.length === 0 ? (
              <div className="bg-panel border border-edge rounded-xl p-5 text-sm text-faint">
                Empty so far. Scan something and tap "Add to inventory" — the pile starts here.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {inventory.map((i) =>
                  pendingDelete === i.id ? (
                    <div key={i.id} className="flex items-center justify-between bg-panel border border-alert rounded-xl px-4 py-3 gap-2">
                      <span className="text-sm">Remove "{i.item}"?</span>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => deleteItem(i.id)}
                          className="text-sm font-semibold rounded-lg px-3 py-1.5"
                          style={{ background: "#F87171", color: "#0A0E1A" }}
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setPendingDelete(null)}
                          className="text-sm font-semibold rounded-lg px-3 py-1.5 border border-edge text-mist"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={i.id} className="bg-panel border border-edge rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">{i.item}</div>
                          <div className="text-xs text-faint mt-0.5">
                            {i.status === "sold" || i.status === "scrapped"
                              ? `${STATUS_LABEL[i.status]} · $${(i.cashedFor || 0).toFixed(0)}`
                              : `scrap $${i.scrapLow}–$${i.scrapHigh} · resale $${i.resaleLow}–$${i.resaleHigh}`}
                          </div>
                        </div>
                        <button
                          onClick={() => setPendingDelete(i.id)}
                          className="p-1 flex-shrink-0"
                          aria-label={`Remove ${i.item}`}
                        >
                          <X size={16} color="#7A8494" />
                        </button>
                      </div>
                      {i.status === "have" && (
                        <div className="flex gap-2 mt-2.5">
                          <button
                            onClick={() => setCashModal({ id: i.id, as: "sold" })}
                            className="flex-1 py-2 rounded-lg text-xs font-bold term-font"
                            style={{ background: "#4ADE80", color: "#0A0E1A" }}
                          >
                            SOLD IT
                          </button>
                          <button
                            onClick={() => setCashModal({ id: i.id, as: "scrapped" })}
                            className="flex-1 py-2 rounded-lg text-xs font-bold term-font"
                            style={{ background: "#60A5FA", color: "#0A0E1A" }}
                          >
                            SCRAPPED IT
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            <div className="text-xs text-faint text-center pb-4">
              Your inventory lives on this phone only. We can't see it.
            </div>
          </div>
          <TabBar />
        </>
      )}

      {/* ============ CHAT ============ */}
      {screen === "chat" && (
        <>
          <TopBar title="Ask the Scout" onBack={() => setScreen("home")} />
          <ChatScreen onAiAction={onAiAction} />
          <TabBar />
        </>
      )}

      {/* ============ LISTING GENERATOR ============ */}
      {screen === "listing" && (
        <>
          <TopBar title="Draft a Listing" onBack={() => setScreen("home")} />
          <ListingScreen key={listingSession} inventory={inventory} prefill={listingPrefill} onAiAction={onAiAction} />
          <TabBar />
        </>
      )}

      {/* ============ BUYER FINDER ============ */}
      {screen === "buyer" && (
        <>
          <TopBar title="Triage My Pile" onBack={() => setScreen("home")} />
          <BuyerScreen inventory={inventory} onDraftListing={draftFromInventory} onAiAction={onAiAction} />
          <TabBar />
        </>
      )}

      {/* ============ MY SPOTS ============ */}
      {screen === "spots" && (
        <>
          <TopBar title="My Spots" onBack={() => setScreen("home")} />
          <SpotsScreen />
          <TabBar />
        </>
      )}

      {/* ============ PLANNER ============ */}
      {screen === "planner" && (
        <>
          <TopBar title="The Plan" onBack={() => setScreen("home")} />
          <PlannerScreen />
          <TabBar />
        </>
      )}

      {/* ============ KNOW THE RULES ============ */}
      {screen === "laws" && (
        <>
          <TopBar title="Know the Rules" onBack={() => setScreen("home")} />
          <LawsScreen onAskScout={() => openGated(() => setScreen("chat"))} />
          <TabBar />
        </>
      )}

      {/* ============ PRO ============ */}
      {screen === "pro" && (
        <>
          <TopBar title="ScrapScout Pro" onBack={() => setScreen("home")} />
          <ProScreen
            proState={proState}
            onProChange={setProState}
            gateReason={gateReason}
            cashCollected={cash}
            aiLimit={AI_TRIGGER}
            goScan={resetScan}
          />
          <TabBar />
        </>
      )}

      {/* ============ CASH MODAL ============ */}
      {cashModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setCashModal(null)}>
          <div className="w-full bg-panel border-t border-edge rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="term-font font-bold text-xl text-white mb-1">
              {cashModal.as === "sold" ? "What'd it sell for?" : "What'd the yard pay?"}
            </div>
            <div className="text-xs text-faint mb-3">Just the number — like 40 or 12.50</div>
            <input
              autoFocus
              value={cashPrice}
              onChange={(e) => setCashPrice(e.target.value)}
              placeholder="40"
              inputMode="decimal"
              className="w-full bg-ink border border-edge rounded-xl px-4 py-3.5 text-lg text-white mb-2 outline-none focus:border-scout"
            />
            {cashPrice.trim() !== "" && !priceValid && (
              <div className="text-sm mb-2" style={{ color: "#F87171" }}>
                Numbers only — like 40 or 12.50
              </div>
            )}
            <button
              onClick={confirmCash}
              disabled={!priceValid}
              className="w-full py-4 rounded-xl term-font font-extrabold disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "#4ADE80", color: "#0A0E1A" }}
            >
              <DollarSign size={18} /> LOG THE CASH
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
