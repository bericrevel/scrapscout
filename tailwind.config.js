/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ScrapScout identity: terminal green on deep ink. All pairings
        // chosen to clear WCAG AA on the dark canvas.
        ink: "#0A0E1A",
        panel: "#111827",
        edge: "#1F2937",
        mist: "#B8C0CC",
        faint: "#7A8494",
        scout: "#4ADE80",
        scoutdim: "#22C55E",
        amber: "#FBBF24",
        alert: "#F87171",
        steel: "#60A5FA"
      }
    },
  },
  plugins: [],
};
