# ScrapScout · v0.5 — ALL FIVE PHASES COMPLETE

The full honest rebuild: every original feature, real engines, ready for the
build-and-ship checklist.

Point. Identify. Get paid.

Native Android rebuild (Capacitor 8 + React/TS/Vite) of the Manus-hosted
ScrapScout web app — on your own stack, with honest engines. Sibling of
JunkGenius CashScan; same audited architecture, same suite conventions
(`com.aerkatech.scrapscout`).

## RULE #1 — ABSOLUTELY NO MOCK DATA

This outranks every other rule in this repo. It's why the rebuild exists.

- **No fabricated facts, ever.** No synthetic "sold counts," no invented map
  coordinates, no fake reviews, no pretend "live" prices, no seeded sample
  rows. If we don't have the real thing, the feature shows an honest state.
- **AI estimates are not mock data — when labeled.** The scan's value ranges
  are the product's real function. They are always marked as estimates, and
  they are never dressed up as market facts ("26 sold this week").
- **Real source or honest absence.** Metal prices come from a real spot API or
  the screen says "connect a price source." Yards come from real OSM data or
  the map says "none mapped near you — add one you know." eBay comps come from
  the real Browse API or the feature shows its setup state.
- **Empty states are honest and useful** — they tell the user how to fill
  them, they are never pre-filled with fake activity.
- **Even screenshots.** Store screenshots get staged by really using the app.

If a future feature can't be built without faking its data, the feature waits.

## Why this rebuild exists

The original lives on Manus hosting: the server is a black box you can't
inspect, price, or move, and its "live eBay comps" return instant sold-counts
that real eBay APIs don't hand out — almost certainly synthesized. This
rebuild keeps **every feature** and replaces every dishonest or rented part.

## No feature left behind — the full disposition

| Original feature | Status | The honest engine |
|---|---|---|
| AI scan + valuation | **Phase 1 ✓ built** | Claude vision via task-locked proxy (audited CashScan pattern), dual scrap/resale ranges, labeled as estimates |
| Inventory + total value | **Phase 1 ✓ built** | On-device (Preferences). Estimated value and *real cash collected* kept separate and labeled |
| Scrap yard finder (map) | **Phase 2 ✓ built** | Real OpenStreetMap/Overpass data + Nominatim geocoding, list-first with lazy Leaflet map (tiles cost data — loaded only on demand). Honest empty state when OSM has nothing mapped nearby |
| Yard reviews | **Phase 2 ✓ built** (v1) | Your own notes per yard + one-tap link to its Google reviews. Shared community reviews come later with the suite's first real DB — staged, never faked |
| Live metal prices | **Phase 2 ✓ built** | Real spot via metalpriceapi.com, server-cached 8h so the free tier covers everyone; honest "connect a price source" setup state until the key exists; "yards pay 30–60% under spot" framing; plus your own per-yard price log — which works with zero config |
| eBay comps | **Phase 4 ✓ built** | Real **eBay Browse API** (free dev key): live *active* listings — real asks, real counts, sample listings with links, honest zero-match state. Deliberately labeled "asks, not sold prices." Setup state until the key exists |
| AI Opportunity Map | **Phase 3 ✓ built** | "My Spots": the user's OWN pins (curb piles, dumpster spots, sales) on a real lazy Leaflet map with type colors, GO directions, dates for sales. **Zero invented coordinates — every pin exists because the user dropped it** |
| Free Stuff Finder | **Phase 3 ✓ built** | Honest search launchers: query chips + custom input → real Craigslist free section, FB Marketplace, Nextdoor, estate-sale searches. Queries, not pretend aggregation |
| Opportunities calendar | **Phase 3 ✓ built** | "The Plan": one-shot and weekly-recurring entries (curb day!), grouped agenda (overdue/today/this week/later), REAL local notifications via @capacitor/local-notifications — 7 AM on curb day — with honest degradation when permission is denied |
| State scrap laws | **Phase 3 ✓ built** | "Know the Rules": six general, stable sections (yard ID basics, the never-scrap list, catalytic converters, dumpster/curb law, verify-locally) shipped in-app, dated July 2026, + .gov search launcher per state. Deliberately NOT a 50-state statute DB — confidently-wrong specifics would break Rule #1 where it hurts most |
| AI chat assistant | **Phase 4 ✓ built** | Proxy "chat" task (won't invent live prices — points to the Prices tab and your yard), history on-device, clearable |
| eBay/FB listing generator | **Phase 4 ✓ built** | Proxy "listing" task: honest editable drafts (80-char eBay titles, flaws-stated-plainly descriptions) + copy-all + real posting-page links + live comps panel |
| AI buyer finder | **Phase 4 ✓ built** | Proxy "buyer" task triages your real on-device inventory: LIST IT / SCRAP NOW / EITHER with one-line reasons; one tap to draft the listing |
| Tasks & reminders | Phase 3 | Local (moved to Phase 3 with the calendar) |
| Pro gate / subscription | **Phase 5 ✓ built** | CashScan's entire audited Stripe stack (checkout in Custom Tab, entitlement via Stripe-as-database, restore by email, portal, past_due kindness, 7-day offline grace). Fair two-trigger gate: free until **$100 real cash collected or 150 AI actions**; inventory/pins/plan/yards/prices/laws free forever |
| Referral + ShareCard | **Phase 5 ✓ built** (v1) | "Tell another scrapper" system share (Play link + pitch) via @capacitor/share. Image share-card + go-link referral tallies = post-launch polish, noted honestly |
| Settings / How-it-works / Privacy / Terms / Permissions | **Phase 5 ✓ built** (v1) | Hosted privacy policy at /privacy.html (dark, plain-language, covers photos/location-to-OSM/chat/eBay/Stripe) linked from Home; per-screen explainers serve the how-it-works job. A dedicated Settings screen is post-launch polish |
| PWA install banner | Dropped | It's a native app now |
| Waitlist page | Dropped | Pre-launch artifact — meaningless in a shipped app |

## Built into Phase 1 from line one (the audit lessons)

CORS'd task-locked proxy · app-key + rate limiting · 1280px/q80 camera caps ·
45s timeouts + offline detection + plain-language errors + retry-same-photo ·
validated model output + error boundary · hardware-back navigation ·
"$40"-tolerant cash input · inventory delete with confirm · WCAG-checked
palette on the dark theme · pinch-zoom left on.

## Setup (same drill as CashScan)

```bash
npm install
npx vercel                 # deploys api/scout.ts + web build
# Vercel env: ANTHROPIC_API_KEY, APP_SHARED_KEY (fresh key for this app)
cp .env.example .env       # set VITE_API_BASE_URL + VITE_APP_KEY
npm run build
npx cap add android
npx cap sync && npx cap open android
```

Toolchain: Node 22+, Android Studio Otter+, Java 21 (Capacitor 8).

### Phase 2 additions

**Location permission (one-time manifest edit).** After `npx cap add android`,
add to `android/app/src/main/AndroidManifest.xml` (Capacitor Geolocation
requires it):

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

The app never requires it: typing a city/ZIP works permission-free by design.

**Metal spot prices (optional, free).** Create a free account at
metalpriceapi.com, set `METALPRICE_API_KEY` on the Vercel project, redeploy.
Until then the Prices screen shows an honest setup state — never fake numbers.
The server caches 8h, so the ~100-requests/month free tier serves every user.
**Verify on first setup:** copper should land around $3.50–6.50/lb. If it
doesn't, the raw upstream rates are included in `/api/prices` for auditing —
fix the unit conversion before trusting it, and say so in the thread.

**Map data etiquette.** Yards come from the public Overpass API and geocoding
from Nominatim (© OpenStreetMap contributors — attribution stays on). Both are
queried only on explicit user action and cached 24h on-device. Map tiles load
only when the user opens Map view (tiles are the most expensive bytes in the
app — the list answers most questions for free).

### Phase 4 additions

**eBay comps (optional, free).** Create a developer account at
developer.ebay.com → create an application (production keyset) → copy the
**App ID (client id)** and **Cert ID (client secret)** into Vercel env as
`EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`, redeploy. Until then the comps panel
shows an honest setup state with a link to search eBay manually — never
invented listings. Default quota is 5,000 Browse calls/day; the server caches
each query 6h, the app another 6h on-device, and comps only fetch when the
user taps the button. **Honesty note baked into the UI:** these are live
*asking* prices, not sold prices — real sold data is behind eBay's restricted
Marketplace Insights API, which is exactly why the old app's instant "sold
counts" were fake.

**Chat, listings, buyer triage.** Three new proxy tasks (`chat`, `listing`,
`buyer`) — system prompts server-side like everything else. The chat
deliberately refuses to quote "today's prices" (they move; it points to the
Prices tab and your yard). The listing generator writes honest drafts —
flaws stated plainly — and links to the real posting pages (you paste and add
real photos there). Buyer triage reads only your on-device inventory and
returns LIST IT / SCRAP NOW / EITHER with one-line reasons.

**Suite note:** deploy as its own Vercel project with its own APP_SHARED_KEY
and its own Anthropic spend cap. Shared: the conventions, the go-link counter
(channels `ss-*`), and later the reviews DB.

## Phase map

1. **✓ Money loop** — shell, Home, Scan → dual verdict → Inventory
2. **✓ Yards + metal prices** — Overpass yard finder (list-first, lazy map),
   per-yard notes + logged prices, spot prices with honest setup state
3. **✓ Opportunities** — My Spots (own pins on real map), The Plan (curb-day
   reminders via local notifications), free-stuff launchers, Know the Rules
4. **✓ AI toolbox** — chat assistant, listing generator + posting links,
   buyer triage, real eBay Browse comps with honest setup state
5. **✓ Pro gate + store package** — Stripe stack, fair two-trigger gate,
   share button, hosted privacy policy, Data Safety + listing kit

### Phase 5 additions (Pro + store)

**Stripe (same drill as CashScan):** create product "ScrapScout Pro" with
$3.99/mo + $24/yr prices (change them → also change the two `PRICE_*_LABEL`
constants in `src/screens/ProScreen.tsx`), enable the Customer Portal, set
`STRIPE_SECRET_KEY` / `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` on
Vercel, test end-to-end with `sk_test_` keys (buy → return → check-now →
restore on a second install → cancel via portal).

**The gate, stated whole (marketing rule):** anywhere you say "free until
it's made you $100," the fine print carries "or 150 AI actions — whichever
comes first." Failed scans/chats/drafts never count. The counter is on-device
(honor system, reinstall resets it — accepted, same as CashScan; escalation
path is a server-side per-device tally if the API bill ever demands it).

**Play policy:** same as CashScan — enroll in the US alternative-billing
program before shipping the Stripe build, keep distribution US-only until
Play Billing is added. Privacy policy ships at `/privacy.html` on deploy;
replace `support@aerkatech.com` with a real inbox first. Data Safety answers
live in the Store Package Kit document delivered with this build (adds
Location — collected, service-provider-exempt via OSM, ephemeral — on top of
CashScan's four types).

### Phase 3 notes

Local notifications use `@capacitor/local-notifications` (permission prompted
on first reminder; the plan works fully without it). Recurring reminders ring
at 7:00 AM on the chosen weekday. The laws guide's `LAST REVIEWED` date lives
in `src/data/scraplaws.ts` — re-review it before each release year.
