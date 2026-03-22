import express from "express";
import cors from "cors";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY environment variable is required");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  const allowedOrigins = [
    "https://localhost",         // Capacitor Android WebView
    "http://localhost:3000",
    "http://localhost:5173",
    process.env.ALLOWED_ORIGIN, // e.g. https://scrapscout.app
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }));

  // Health check — Railway/Render use this to confirm the server is up
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use(express.json());

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const stripe = getStripe();
      const { plan } = req.body;

      // Stripe can't redirect back to capacitor://localhost.
      // Use real HTTPS URLs for success/cancel — set these as env vars.
      const SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || `http://localhost:${PORT}?success=true&plan=${plan}`;
      const CANCEL_URL  = process.env.STRIPE_CANCEL_URL  || `http://localhost:${PORT}?canceled=true`;

      let line_items: any[] = [];
      let mode: "payment" | "subscription" = "subscription";

      if (plan === "founder") {
        mode = "payment";
        line_items = [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Founder Edition (Lifetime)",
              description: "Lifetime access, 2-Hour Early Access, Unlimited AI Scans, Pro Features",
            },
            unit_amount: 25000,
          },
          quantity: 1,
        }];
      } else if (plan === "pro_yearly") {
        line_items = [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Pro Edition (Yearly)",
              description: "Unlimited AI Scans, Advanced Filters, Priority Support",
            },
            unit_amount: 9900,
            recurring: { interval: "year" },
          },
          quantity: 1,
        }];
      } else {
        line_items = [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Pro Edition (Monthly)",
              description: "Unlimited AI Scans, Advanced Filters, Priority Support",
            },
            unit_amount: 1999,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }];
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode,
        line_items,
        success_url: `${SUCCESS_URL}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: CANCEL_URL,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // Stripe webhook — verifies signature before trusting the payload
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: "Missing signature or webhook secret" });
    }
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err.message);
      return res.status(400).json({ error: "Invalid signature" });
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan || "pro";
      const email = session.customer_details?.email;
      console.log(`Payment confirmed — email: ${email}, plan: ${plan}`);
      // TODO: update Firestore subscriptionStatus via firebase-admin
    }
    res.json({ received: true });
  });

  // Web2wave webhook
  app.post("/api/webhooks/web2wave", async (req, res) => {
    try {
      const { type, data } = req.body;
      if (type === "subscription.created" || type === "payment.succeeded") {
        const userEmail = data.customer_email || data.email;
        const plan = data.plan_id || data.metadata?.plan;
        console.log(`Web2wave: ${userEmail} upgraded to ${plan}`);
        // TODO: update Firestore subscriptionStatus via firebase-admin
      }
      res.json({ received: true });
    } catch (error: any) {
      console.error("Web2wave Webhook Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Only run Vite dev middleware locally — the APK bundles the frontend itself
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
