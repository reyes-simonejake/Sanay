import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PillApp } from "./pill/Pill";
import { ErrorBoundary } from "./components/StatusScreen";
import "./index.css";
import { initTheme } from "./lib/theme";

// One bundle, two windows: the main window and the floating on/off pill (index.html#pill).
const isPill = window.location.hash === "#pill";
if (isPill) document.documentElement.classList.add("pill-window"); // transparent before first paint
initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* The pill stays quiet if it ever fails; the main window shows the error screen. */}
    {isPill ? (
      <ErrorBoundary fallback={null}>
        <PillApp />
      </ErrorBoundary>
    ) : (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )}
  </React.StrictMode>,
);
