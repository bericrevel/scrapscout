import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

/** Last-resort boundary — a crash must never strand a user on a white screen. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            background: "#0A0E1A",
            color: "#B8C0CC",
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>😖</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Something broke.</div>
          <div style={{ fontSize: 14, maxWidth: 280 }}>
            Not your fault. Your inventory is safe on your phone. Tap below to restart.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "14px 28px",
              borderRadius: 12,
              border: "none",
              background: "#4ADE80",
              color: "#0A0E1A",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            RESTART
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
