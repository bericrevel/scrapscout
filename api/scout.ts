// ScrapScout — API proxy (Vercel, Node.js runtime).
//
// Task-locked, same hardening as CashScan's audited proxy: system prompts
// live HERE, server-side; the app can only name a task and send validated
// data. CORS for the Capacitor WebView, optional shared app key, best-effort
// per-IP rate limiting, per-task max_tokens.
//
// Tasks:
//   identify — dual scrap/resale valuation from a photo   (Phase 1)
//   chat     — scrap assistant, short plain-spoken answers (Phase 4)
//   listing  — eBay/FB listing draft as JSON               (Phase 4)
//   buyer    — inventory triage: list online vs scrap now  (Phase 4)
//
// Env vars: ANTHROPIC_API_KEY (required), APP_SHARED_KEY (optional),
//           ANTHROPIC_MODEL (optional, default claude-sonnet-4-6)

type Task = "identify" | "chat" | "listing" | "buyer";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const MAX_TOKENS: Record<Task, number> = {
  identify: 1200,
  chat: 1000,
  listing: 900,
  buyer: 1500,
};

const SYSTEM: Record<Task, string> = {
  identify: `You identify items for ScrapScout, an app that helps low-income and rural workers turn found and discarded items into cash — either at the scrap yard or by reselling. Respond with ONLY a raw JSON object (no markdown fences, no preamble) with exactly these fields:
{
  "item": "short item name",
  "category": "short tag like 'appliance', 'auto part', 'electronics', 'furniture', 'tool', 'scrap metal'",
  "condition": "one short plain line on visible condition",
  "materials": [{"name": "copper", "estLbs": 2.5}],
  "weightLbs": number (rough total weight estimate),
  "scrapLow": number, "scrapHigh": number,
  "resaleLow": number, "resaleHigh": number,
  "move": "resell" | "scrap" | "part_out" | "skip",
  "reason": "one short plain-spoken line explaining the move",
  "safetyWarning": "short warning string, or empty string if none"
}
Rules: scrap values reflect realistic US scrap-yard payouts (well below commodity spot). Resale values reflect realistic used-market prices for the visible condition. Be decisive, never inflate, and prefer "skip" when something is genuinely not worth the effort. All dollar values are ESTIMATES and will be labeled as such in the app. If the photo is unclear, set "item" to "unclear" and explain in "reason".`,

  chat: `You are the ScrapScout assistant — a seasoned, plain-spoken scrapper's buddy for people turning junk into cash. You know scrap metal grades and separation (copper #1 vs #2, insulated wire, brass, stainless, cast vs light iron), yard etiquette (call ahead, bring ID, how weigh-ins work), part-out strategies, flipping basics, and safety (fuel, refrigerant, capacitors, batteries, sharp edges — take these seriously and warn plainly).
Rules: keep answers short and concrete — a few sentences or a tight list, written for someone who may have no tools and no spare cash. NEVER invent current market prices or claim live rates; when asked for today's prices, say prices move and point them to the app's Prices tab and to calling their yard. Never invent laws for a specific state — say rules vary and to check the yard's requirements. If something is dangerous (refrigerant venting, tank cutting, battery fires), say clearly not to do it and what the legal path is.`,

  listing: `You write marketplace listing drafts for ScrapScout users selling used/salvaged items. Respond with ONLY a raw JSON object (no markdown fences): {"title": "eBay-style title, max 80 characters, keyword-rich but honest", "description": "3-5 honest sentences: what it is, visible condition, what works/what's untested, pickup/shipping note", "price": number, "pricingNote": "one line on pricing strategy (e.g. price firm vs room to haggle, or start-high-drop-weekly)", "platform": "eBay" | "Facebook Marketplace" | "Craigslist" | "OfferUp"}
Rules: never oversell condition, never invent specs you weren't given, honest flaws stated plainly sell faster. Pick the platform that fits the item (heavy/local → FB or Craigslist; shippable/collectible → eBay).`,

  buyer: `You are ScrapScout's inventory triage. Given a list of items the user has on hand (with AI-estimated scrap and resale values), decide for each: is it worth listing online, or should they just scrap it now for fast cash? Respond with ONLY a raw JSON object (no markdown fences): {"verdicts": [{"item": "name exactly as given", "verdict": "list_online" | "scrap_now" | "either", "why": "one short plain line"}]}
Rules: weigh effort and time-to-cash, not just price — listing online means photos, messages, no-shows; scrapping is same-day money. Bulky low-value metal → scrap. Working electronics/tools/parts with real resale gap → list. When the gap is small, say "either" and note the tradeoff. Keep every "why" under 15 words.`,
};

// ---------- CORS / rate limiting ----------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Key",
  "Access-Control-Max-Age": "86400",
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40; // chat is conversational — a bit more headroom
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

// ---------- validation helpers ----------
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_B64_CHARS = 5_000_000;

function cleanStr(v: unknown, max = 400): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function cleanNum(v: unknown): number {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(1_000_000, n)) : 0;
}

type Message = { role: string; content: unknown };

function buildMessages(task: Task, body: Record<string, unknown>): Message[] | { error: string; status: number } {
  if (task === "identify") {
    const image = body.image as { data?: unknown; mediaType?: unknown } | undefined;
    const data = typeof image?.data === "string" ? image.data : "";
    const mediaType = typeof image?.mediaType === "string" ? image.mediaType : "";
    if (!data || !ALLOWED_MEDIA.includes(mediaType)) return { error: "A photo is required", status: 400 };
    if (data.length > MAX_IMAGE_B64_CHARS) return { error: "Photo too large", status: 413 };
    return [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: "Identify this item and return the JSON." },
        ],
      },
    ];
  }

  if (task === "chat") {
    const raw = Array.isArray(body.messages) ? (body.messages as unknown[]) : [];
    // Last 12 turns, strict shape, capped lengths — the proxy can't be
    // repurposed: the system prompt is ours and roles are validated.
    const msgs: Message[] = [];
    for (const m of raw.slice(-12)) {
      const mm = (m || {}) as Record<string, unknown>;
      const role = mm.role === "assistant" ? "assistant" : mm.role === "user" ? "user" : null;
      const content = cleanStr(mm.content, 2000);
      if (role && content) msgs.push({ role, content });
    }
    if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") {
      return { error: "A question is required", status: 400 };
    }
    if (msgs[0].role !== "user") msgs.shift(); // Anthropic requires user-first
    return msgs;
  }

  if (task === "listing") {
    const item = (body.item || {}) as Record<string, unknown>;
    if (!cleanStr(item.item)) return { error: "Item data is required", status: 400 };
    const lines = [
      `Item: ${cleanStr(item.item)}`,
      `Category: ${cleanStr(item.category)}`,
      `Condition: ${cleanStr(item.condition) || "unknown — user hasn't described it"}`,
      `AI-estimated resale range: $${cleanNum(item.resaleLow)}-$${cleanNum(item.resaleHigh)}`,
      cleanStr(item.notes, 600) ? `Seller notes: ${cleanStr(item.notes, 600)}` : "",
    ].filter(Boolean);
    return [{ role: "user", content: lines.join("\n") }];
  }

  if (task === "buyer") {
    const raw = Array.isArray(body.items) ? (body.items as unknown[]) : [];
    const items = raw.slice(0, 25).map((i) => {
      const it = (i || {}) as Record<string, unknown>;
      return {
        item: cleanStr(it.item, 120),
        category: cleanStr(it.category, 60),
        scrapHigh: cleanNum(it.scrapHigh),
        resaleHigh: cleanNum(it.resaleHigh),
      };
    }).filter((i) => i.item);
    if (items.length === 0) return { error: "At least one item is required", status: 400 };
    const lines = items.map(
      (i, n) => `${n + 1}. ${i.item} (${i.category || "misc"}) — est. scrap up to $${i.scrapHigh}, est. resale up to $${i.resaleHigh}`
    );
    return [{ role: "user", content: `My on-hand inventory:\n${lines.join("\n")}\n\nTriage it and return the JSON.` }];
  }

  return { error: "Unknown task", status: 400 };
}

interface NodeReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}
interface NodeRes {
  setHeader(name: string, value: string): void;
  status(code: number): NodeRes;
  json(body: unknown): void;
  end(): void;
}

export default async function handler(req: NodeReq, res: NodeRes) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
    return;
  }

  const sharedKey = process.env.APP_SHARED_KEY;
  if (sharedKey && req.headers["x-app-key"] !== sharedKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const ip =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : "") ||
    req.socket?.remoteAddress ||
    "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Too many requests — try again in a few minutes" });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const task = body.task as Task;
  if (!["identify", "chat", "listing", "buyer"].includes(task)) {
    res.status(400).json({ error: "Unknown task" });
    return;
  }

  const messages = buildMessages(task, body);
  if (!Array.isArray(messages)) {
    res.status(messages.status).json({ error: messages.error });
    return;
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS[task],
        system: SYSTEM[task],
        messages,
      }),
    });

    const out = (await anthropicRes.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
      error?: { message?: string };
    };

    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: out.error?.message || "Anthropic API error" });
      return;
    }

    const text = (out.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");
    if (!text) {
      res.status(502).json({ error: "Empty response from model" });
      return;
    }
    res.status(200).json({ text, truncated: out.stop_reason === "max_tokens" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Proxy request failed" });
  }
}
