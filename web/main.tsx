import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./web.css";
import { initTheme } from "../src/lib/theme";

initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
