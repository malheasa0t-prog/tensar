"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  COMPARISON_STORAGE_KEY,
  normalizeComparisonEntry,
  parseComparisonEntries,
  toggleComparisonEntry,
} from "@/lib/comparisonModel";

const ComparisonContext = createContext(null);

export function useComparison() {
  return useContext(ComparisonContext);
}

export default function ComparisonProvider({ children }) {
  const [comparisonEntries, setComparisonEntries] = useState([]);
  const [hasHydratedComparison, setHasHydratedComparison] = useState(false);

  useEffect(() => {
    setComparisonEntries(parseComparisonEntries(window.localStorage.getItem(COMPARISON_STORAGE_KEY)));
    setHasHydratedComparison(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedComparison) {
      return undefined;
    }

    function handleStorage(event) {
      if (event.key === COMPARISON_STORAGE_KEY) {
        setComparisonEntries(parseComparisonEntries(event.newValue));
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hasHydratedComparison]);

  useEffect(() => {
    if (!hasHydratedComparison) {
      return;
    }

    window.localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(comparisonEntries));
  }, [comparisonEntries, hasHydratedComparison]);

  const toggleCompare = useCallback((entry) => {
    const normalizedEntry = normalizeComparisonEntry(entry);
    let result = { entries: [], isAtLimit: false, isCompared: false };

    setComparisonEntries((currentEntries) => {
      result = toggleComparisonEntry(currentEntries, normalizedEntry);
      return result.entries;
    });

    return result;
  }, []);

  const removeComparison = useCallback((productId) => {
    const normalizedProductId = String(productId || "").trim();
    setComparisonEntries((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== normalizedProductId)
    );
  }, []);

  const clearComparison = useCallback(() => {
    setComparisonEntries([]);
  }, []);

  const isCompared = useCallback(
    (productId) => comparisonEntries.some((entry) => entry.id === String(productId || "").trim()),
    [comparisonEntries]
  );

  const value = useMemo(
    () => ({
      clearComparison,
      comparisonCount: comparisonEntries.length,
      comparisonEntries,
      hasHydratedComparison,
      isCompared,
      removeComparison,
      toggleCompare,
    }),
    [
      clearComparison,
      comparisonEntries,
      hasHydratedComparison,
      isCompared,
      removeComparison,
      toggleCompare,
    ]
  );

  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>;
}
