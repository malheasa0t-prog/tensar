"use client";

import { useState, useEffect } from "react";

export default function Preloader() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (hidden) return null;

  return (
    <div className="preloader">
      <div className="preloader-inner">
        <div className="preloader-spinner" />
        <span className="preloader-text">TechZone</span>
      </div>
    </div>
  );
}
