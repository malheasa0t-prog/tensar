import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@/app/site.css";
import "@/app/techfix-pages.css";
import "@/app/techfix-home-purple.css";
import "./styles/fonts.css";
import App from "./App.jsx";

if (typeof window !== "undefined") {
  window.localStorage.setItem("tz_onboarding_seen", "1");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
