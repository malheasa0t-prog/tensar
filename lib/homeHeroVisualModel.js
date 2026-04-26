const DEFAULT_HERO_VISUAL_ITEMS = Object.freeze([
  { id: "hero-builds", name: "تجميعات ألعاب", icon: "monitor", image: "" },
  { id: "hero-repairs", name: "صيانة احترافية", icon: "wrench", image: "" },
]);

const DEFAULT_HERO_STAGE_HIGHLIGHTS = Object.freeze([
  { icon: "truck", title: "توصيل سريع", subtitle: "استلام وتسليم منظم" },
  { icon: "shield-check", title: "ضمان موثوق", subtitle: "منتجات مختارة بعناية" },
  { icon: "headphones", title: "دعم مباشر", subtitle: "فريق جاهز للمتابعة" },
]);

/**
 * Normalizes one category into a visual item safe for the hero stage.
 *
 * @param {unknown} category
 * @returns {{ id: string, name: string, icon: string, image: string } | null}
 */
function normalizeHeroVisualItem(category) {
  if (!category || typeof category !== "object") {
    return null;
  }

  const normalizedName = String(category.name || "").trim();
  if (!normalizedName) {
    return null;
  }

  return {
    id: String(category.id || category.slug || normalizedName).trim(),
    name: normalizedName,
    icon: String(category.icon || normalizedName || "sparkles").trim(),
    image: String(category.image || "").trim(),
  };
}

/**
 * Resolves a stable set of visual cards for the homepage hero stage.
 *
 * @param {unknown} featuredCategories
 * @returns {{ primaryItem: { id: string, name: string, icon: string, image: string }, floatingItems: Array<{ id: string, name: string, icon: string, image: string }> }}
 */
export function getHeroVisualItems(featuredCategories) {
  const normalizedItems = Array.isArray(featuredCategories)
    ? featuredCategories.map(normalizeHeroVisualItem).filter(Boolean)
    : [];
  const filledItems = [...normalizedItems];
  const fallbackItems = normalizedItems.length > 0
    ? [...DEFAULT_HERO_VISUAL_ITEMS.slice(1), DEFAULT_HERO_VISUAL_ITEMS[0]]
    : [...DEFAULT_HERO_VISUAL_ITEMS];

  for (const fallbackItem of fallbackItems) {
    if (filledItems.length >= DEFAULT_HERO_VISUAL_ITEMS.length) {
      break;
    }

    const exists = filledItems.some((item) => item.id === fallbackItem.id);
    if (!exists) {
      filledItems.push({ ...fallbackItem });
    }
  }

  const [primaryItem, ...floatingItems] = filledItems.slice(0, 3);
  return {
    primaryItem: primaryItem || { ...DEFAULT_HERO_VISUAL_ITEMS[0] },
    floatingItems,
  };
}

/**
 * Resolves up to three compact highlight pills for the hero copy and visual stage.
 *
 * @param {unknown} trustBar
 * @returns {Array<{ icon: string, title: string, subtitle: string }>}
 */
export function getHeroStageHighlights(trustBar) {
  if (!Array.isArray(trustBar)) {
    return [...DEFAULT_HERO_STAGE_HIGHLIGHTS];
  }

  const highlights = trustBar
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const title = String(item.title || "").trim();
      if (!title) {
        return null;
      }

      return {
        icon: String(item.icon || "sparkles").trim(),
        title,
        subtitle: String(item.subtitle || "").trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  return highlights.length > 0 ? highlights : [...DEFAULT_HERO_STAGE_HIGHLIGHTS];
}
