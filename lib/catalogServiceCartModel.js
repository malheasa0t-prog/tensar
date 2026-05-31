/**
 * Shared cart-item helpers for digital catalog services.
 */

/**
 * Resolves the best category label shown for one catalog service inside the cart.
 *
 * @param {{ rootCategoryLabel?: unknown, subCategoryLabel?: unknown }} input
 * @returns {string}
 */
export function resolveCatalogServiceCategoryLabel({ rootCategoryLabel, subCategoryLabel }) {
  const normalizedSubCategoryLabel = String(subCategoryLabel || "").trim();
  if (normalizedSubCategoryLabel) {
    return normalizedSubCategoryLabel;
  }

  const normalizedRootCategoryLabel = String(rootCategoryLabel || "").trim();
  return normalizedRootCategoryLabel || "خدمة رقمية";
}

/**
 * Builds a cart-safe item payload from one services-table row.
 *
 * @param {{ service: Record<string, unknown>, categoryLabel?: string }} input
 * @returns {Record<string, unknown>}
 */
export function buildCatalogServiceCartItem({ service, categoryLabel = "" }) {
  const currentService = service && typeof service === "object" ? service : {};

  return {
    id: currentService.id,
    name: currentService.name,
    originalPrice: Number(currentService.price || 0),
    price: Number(currentService.price || 0),
    category: categoryLabel || currentService.categoryLabel || "خدمة",
    description: currentService.description || "",
    icon: currentService.icon || "wrench",
    images: currentService.image ? [currentService.image] : [],
    quantity: Number(currentService.max_qty || 9999),
    status: currentService.status || "active",
    product_type: "digital",
    provider_fields: currentService.metadata?.provider_fields || [],
    link_required: Boolean(currentService.metadata?.link_required),
  };
}
