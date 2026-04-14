"use client";

import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(value, durationMs = 360) {
  const [displayValue, setDisplayValue] = useState(Number(value || 0));
  const lastValueRef = useRef(Number(value || 0));

  useEffect(() => {
    lastValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    const endValue = Number(value || 0);
    const startValue = lastValueRef.current;
    const startedAt = performance.now();
    let frameId = 0;

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [durationMs, value]);

  return displayValue;
}
