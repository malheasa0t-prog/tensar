export const COMPARISON_STORAGE_KEY = "tz_comparison";
export const COMPARISON_MAX_ITEMS = 4;
export const COMPARISON_MIN_ITEMS = 2;

/**
 * Normalizes a saved product snapshot used by the comparison UI.
 *
 * @param {Record<string, unknown> | null | undefined} entry
 * @returns {Record<string, unknown> | null}
 */
export function normalizeComparisonEntry(entry) {
  const id = String(entry?.id || "").trim();
  const name = String(entry?.name || "").trim();

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    category: String(entry?.category || "").trim(),
    price: Number(entry?.price || 0) || 0,
    originalPrice: Number(entry?.originalPrice || 0) || 0,
    rating: Number(entry?.rating || 0) || 0,
    reviewCount: Number(entry?.reviewCount || 0) || 0,
    quantity: Number(entry?.quantity || 0) || 0,
    description: String(entry?.description || "").trim(),
    badge: String(entry?.badge || "").trim(),
    href: String(entry?.href || "/services").trim(),
    image: String(entry?.image || "").trim(),
  };
}

/**
 * Parses the comparison payload stored in localStorage.
 *
 * @param {unknown} rawValue
 * @returns {Array<Record<string, unknown>>}
 */
export function parseComparisonEntries(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seenIds = new Set();
    return parsed
      .map(normalizeComparisonEntry)
      .filter((entry) => entry && !seenIds.has(entry.id) && seenIds.add(entry.id))
      .slice(0, COMPARISON_MAX_ITEMS);
  } catch {
    return [];
  }
}

/**
 * Toggles a product inside the comparison store.
 *
 * @param {Array<Record<string, unknown>>} entries
 * @param {Record<string, unknown>} nextEntry
 * @returns {{
 *   entries: Array<Record<string, unknown>>,
 *   isCompared: boolean,
 *   isAtLimit: boolean,
 * }}
 */
export function toggleComparisonEntry(entries, nextEntry) {
  const normalizedEntry = normalizeComparisonEntry(nextEntry);
  const safeEntries = Array.isArray(entries) ? entries : [];

  if (!normalizedEntry) {
    return {
      entries: safeEntries,
      isCompared: false,
      isAtLimit: false,
    };
  }

  const exists = safeEntries.some((entry) => entry.id === normalizedEntry.id);
  if (exists) {
    return {
      entries: safeEntries.filter((entry) => entry.id !== normalizedEntry.id),
      isCompared: false,
      isAtLimit: false,
    };
  }

  if (safeEntries.length >= COMPARISON_MAX_ITEMS) {
    return {
      entries: safeEntries,
      isCompared: false,
      isAtLimit: true,
    };
  }

  return {
    entries: [...safeEntries, normalizedEntry],
    isCompared: true,
    isAtLimit: false,
  };
}
