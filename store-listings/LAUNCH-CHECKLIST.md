# ScrapScout — Launch Checklist
# Everything I can do is done. These are the steps only YOU can complete.

============================================================
STEP 1 — Push code to GitHub (10 minutes)
============================================================
1. Create a new GitHub repo at github.com (name: scrapscout)
2. In your project folder run:
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin https://github.com/YOUR_USERNAME/scrapscout.git
     git push -u origin main
3. GitHub Actions will automatically start building your APK on every push.

============================================================
STEP 2 — Add GitHub Secrets (5 minutes)
============================================================
Go to your GitHub repo → Settings → Secrets and variables → Actions
Add these secrets:

  GEMINI_API_KEY          → your Gemini API key
  VITE_API_URL            → your Railway URL (from Step 3)
  VITE_QWEN_API_KEY       → your OpenRouter key
  VITE_DEEPSEEK_API_KEY   → your DeepSeek key (optional)
  ANDROID_KEYSTORE_BASE64 → your keystore file encoded as base64 (see below)
  ANDROID_KEYSTORE_PASSWORD → your keystore password
  ANDROID_KEY_ALIAS       → scrapscout
  ANDROID_KEY_PASSWORD    → your key password

To create a keystore (do this once, save it FOREVER):
  keytool -genkey -v -keystore release.keystore -alias scrapscout \
    -keyalg RSA -keysize 2048 -validity 10000

To convert keystore to base64 for the secret:
  base64 -w 0 release.keystore

============================================================
STEP 3 — Deploy backend to Railway (10 minutes)
============================================================
1. Go to railway.app → Sign up with GitHub
2. New Project → Deploy from GitHub repo → select scrapscout
3. Railway auto-detects Node.js. Set start command to: npx tsx server.ts
4. Add environment variables in Railway dashboard:
     NODE_ENV              = production
     STRIPE_SECRET_KEY     = sk_live_...
     STRIPE_WEBHOOK_SECRET = whsec_... (get from Stripe → Webhooks after deploy)
     STRIPE_SUCCESS_URL    = https://scrapscout.app?success=true  (or your domain)
     STRIPE_CANCEL_URL     = https://scrapscout.app?canceled=true
     ALLOWED_ORIGIN        = https://scrapscout.app
5. Copy your Railway URL (e.g. https://scrapscout-production.up.railway.app)
6. Add that URL as VITE_API_URL in GitHub Secrets (Step 2)
7. In Stripe dashboard → Developers → Webhooks → Add endpoint:
     URL: https://YOUR-RAILWAY-URL/api/webhooks/stripe
     Events: checkout.session.completed

============================================================
STEP 4 — Submit to Google Play (20 minutes)
============================================================
You already have a Google Play Console account.
1. Go to play.google.com/console
2. Create app → App name: ScrapScout → Default language: English
3. Fill in the store listing using: store-listings/google-play-listing.md
4. App content → complete all sections (privacy policy URL, content rating questionnaire)
5. Download your built APK from GitHub Actions:
     GitHub repo → Actions tab → latest build → Artifacts → download ScrapScout-release-X
6. Release → Internal testing → Create new release → Upload the APK
7. Roll out to internal testing first (just yourself), then promote to production

IMPORTANT — In-app purchases must be set up in Play Console BEFORE submitting:
  Monetize → Products → Subscriptions → Create subscription
  Add: Pro Monthly ($19.99), Pro Yearly ($99.00)
  Monetize → Products → In-app products → Create product
  Add: Founder Edition ($250.00)

============================================================
STEP 5 — Set up Firestore config document (5 minutes)
============================================================
1. Go to console.firebase.google.com → your ScrapScout project
2. Firestore Database → Start collection → Collection ID: config
3. Document ID: founder_slots
4. Add fields:
     sold  (number) = 0
     total (number) = 100
5. Add this rule to firestore.rules under the existing match blocks:
     match /config/{document} {
       allow read: if true;
       allow write: if isAdmin();
     }

============================================================
STEP 6 — iOS App Store (REQUIRES A MAC — skip if no Mac)
============================================================
iOS submission requires Xcode which only runs on macOS.
If you have access to a Mac:
1. npm run build && npx cap sync ios && npx cap open ios
2. In Xcode: set your Team (Apple Developer account, $99/year)
3. Product → Archive → Distribute App → App Store Connect
4. Fill in App Store Connect using: store-listings/app-store-listing.md
5. Submit for review (typically 1-3 days)

If no Mac: skip iOS for now. Android Play Store alone is a full launch.

============================================================
TIMELINE ESTIMATE
============================================================
Day 1: Steps 1-3 (GitHub + Railway) — app is live as a web app
Day 2: Step 4 (Play Store internal testing) — APK submitted
Day 3-5: Google Play review (typically 1-7 days for new apps)
Day 5+: App live on Play Store

============================================================
WHAT IS ALREADY DONE FOR YOU
============================================================
- All critical security bugs fixed (subscription exploit, default status, nav badge)
- Backend server production-ready with CORS and Stripe webhook verification
- GitHub Actions pipeline — APK builds automatically on every git push
- Fastlane configured for one-command Play Store uploads
- capacitor.config.json with splash screen and status bar
- package.json with proper app name, version, and Capacitor scripts
- Complete Google Play listing copy (ready to paste)
- Complete App Store listing copy (ready to paste when you have a Mac)
- .gitignore protecting your keys and keystores
- Procfile for Railway deployment
