import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import "./styles.css";
import { applyTheme, getStoredTheme } from "./theme.js";

applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline app shell caching is a nice-to-have; ignore registration failures.
    });
  });
}
