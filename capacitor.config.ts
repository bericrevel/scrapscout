import type { CapacitorConfig } from "@capacitor/cli";

// Suite convention (decided July 2026): com.aerkatech.<app> — flat org root,
// one lowercase single-word segment per app. Permanent after first Play upload.
const config: CapacitorConfig = {
  appId: "com.aerkatech.scrapscout",
  appName: "ScrapScout",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
