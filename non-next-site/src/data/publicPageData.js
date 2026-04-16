import {
  ACCESSORY_SECTION_NAME,
  isAccessoryCatalogCategoryId,
  isAccessoryProduct,
  isAccessoryProductCategoryId
} from "@/lib/accessoryCatalog";
import { getContactMethods, getSocialLinks, normalizeSiteSettings } from "@/lib/contactChannels";
import { formatCurrency } from "@/lib/formatCurrency";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { buildProductStructuredData, buildServiceStructuredData } from "@/lib/seo";
import { loadSiteSettingsClient } from "@/lib/siteSettingsClient";
import { selectHomepageCategories } from "@/lib/techfixModel";
import { selectSubscriptionProducts } from "@/lib/subscriptionsModel";
import { mapProductsExplorerProduct } from "@/lib/productsExplorerModel";
import { fetchHeaderSnapshot } from "@/services/headerService";
import { supabase } from "@/lib/supabaseClient";

/**
 * Loads the homepage snapshot from the client-side Supabase SDK.
 *
 * @returns {Promise<{
 *   featuredCategories: Array<Record<string, unknown>>,
 *   siteSettings: ReturnType<typeof normalizeSiteSettings>,
 *   socialLinks: Array<Record<string, unknown>>,
 *   whatsappSupportLink?: string
 * }>}
 */
export async function loadHomePageSnapshot() {
  const [{ siteSettings }, categoriesResult] = await Promise.all([
    fetchHeaderSnapshot(),
    supabase
      .from("categories")
      .select("*")
      .eq("status", "active")
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
  ]);
  const categories =
    categoriesResult.error || !Array.isArray(categoriesResult.data) ? [] : categoriesResult.data;
  const socialLinks = getSocialLinks(siteSettings);
  const whatsappSupportLink =
    socialLinks.find((item) => item?.key === "whatsapp")?.href || siteSettings.company?.whatsapp || "";

  return {
    featuredCategories: selectHomepageCategories(categories, 4),
    siteSettings,
    socialLinks,
    whatsappSupportLink
  };
}

/**
 * Loads one normalized client-side catalog snapshot.
 *
 * @returns {Promise<{ products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>> }>}
 */
async function loadCatalogSnapshot() {
  const [productsResult, categoriesResult] = await Promise.all([
    supabase.from("products").select("*").in("status", ["active", "out_of_stock"]),
    supabase.from("categories").select("id, name, slug, image, parent_id").eq("status", "active")
  ]);

  return {
    categories:
      categoriesResult.error || !Array.isArray(categoriesResult.data) ? [] : categoriesResult.data,
    products:
      productsResult.error || !Array.isArray(productsResult.data) ? [] : productsResult.data
  };
}

/**
 * Loads the public products explorer snapshot.
 *
 * @returns {Promise<{ categories: Array<Record<string, unknown>>, products: Array<Record<string, unknown>> }>}
 */
export async function loadProductsPageSnapshot() {
  const { categories, products } = await loadCatalogSnapshot();
  const filteredCategories = categories.filter((category) => !isAccessoryCatalogCategoryId(category.id));
  const categoryById = Object.fromEntries(filteredCategories.map((category) => [category.id, category.name]));

  return {
    categories: filteredCategories,
    products: products
      .filter((product) => !isAccessoryProduct(product))
      .map((product) =>
        mapProductsExplorerProduct(product, categoryById[product.category_id] || "منتجات عامة")
      )
  };
}

/**
 * Loads the accessories snapshot.
 *
 * @returns {Promise<{ categories: Array<Record<string, unknown>>, products: Array<Record<string, unknown>> }>}
 */
export async function loadAccessoriesPageSnapshot() {
  const { categories, products } = await loadCatalogSnapshot();

  return {
    categories,
    products: products
      .filter((product) => isAccessoryProduct(product) && product.status === "active")
      .sort(
        (first, second) =>
          new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
      )
  };
}

/**
 * Loads settings-backed public contact data.
 *
 * @returns {Promise<{ contactMethods: Array<Record<string, unknown>>, siteSettings: ReturnType<typeof normalizeSiteSettings>, socialLinks: Array<Record<string, unknown>>, workingHours: Array<Record<string, unknown>> }>}
 */
export async function loadContactPageSnapshot() {
  const siteSettings = await loadSiteSettingsClient().catch(() => normalizeSiteSettings());

  return {
    contactMethods: getContactMethods(siteSettings),
    siteSettings,
    socialLinks: getSocialLinks(siteSettings),
    workingHours: Array.isArray(siteSettings.content?.workingHours)
      ? siteSettings.content.workingHours
      : []
  };
}

/**
 * Loads the public services page snapshot.
 *
 * @returns {Promise<{ services: Array<Record<string, unknown>>, siteSettings: ReturnType<typeof normalizeSiteSettings> }>}
 */
export async function loadServicesPageSnapshot() {
  const [siteSettings, servicesResult] = await Promise.all([
    loadSiteSettingsClient().catch(() => normalizeSiteSettings()),
    supabase
      .from("repair_services")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: true })
  ]);

  if (servicesResult.error) {
    throw new Error("Failed to load repair services.");
  }

  return {
    services: (servicesResult.data || []).slice().sort((first, second) => {
      const firstCategory = first.category || "خدمات الصيانة";
      const secondCategory = second.category || "خدمات الصيانة";
      return (
        firstCategory.localeCompare(secondCategory, "ar") ||
        (first.name || "").localeCompare(second.name || "", "ar")
      );
    }),
    siteSettings
  };
}

/**
 * Resolves one product details snapshot by id.
 *
 * @param {string} id
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadProductDetailsSnapshot(id) {
  if (!id) {
    return null;
  }

  const [{ data: product }, { data: service }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("status", "active").maybeSingle(),
    supabase.from("services").select("*").eq("id", id).eq("status", "active").maybeSingle()
  ]);

  const item = product || service;
  if (!item) {
    return null;
  }

  const normalizedItem = service
    ? {
        ...service,
        brand: null,
        discount_price: null,
        images: service.image ? [service.image] : [],
        product_type: "digital",
        quantity: service.max_qty || 999,
        specs: [],
        variants: []
      }
    : item;

  const isAccessory = isAccessoryProductCategoryId(normalizedItem.category_id);
  const categoryResult = isAccessory
    ? { data: null }
    : await supabase
        .from("categories")
        .select("name,slug")
        .eq("id", normalizedItem.category_id)
        .maybeSingle();
  const category = categoryResult.data || null;
  const categoryLabel = isAccessory ? ACCESSORY_SECTION_NAME : category?.name || "منتج تقني";
  const finalPrice = Number(normalizedItem.discount_price || normalizedItem.price || 0);
  const originalPrice = Number(normalizedItem.price || 0);
  const primaryImage =
    Array.isArray(normalizedItem.images) && normalizedItem.images.length > 0
      ? normalizedItem.images[0]
      : "";

  return {
    brandLabel: normalizedItem.brand || "بدون علامة محددة",
    category,
    categoryLabel,
    finalPrice,
    hasDiscount: Number(normalizedItem.discount_price || 0) > 0 && finalPrice < originalPrice,
    isAccessory,
    item: normalizedItem,
    originalPrice,
    primaryImage,
    stockLabel:
      service || Number(normalizedItem.quantity || 0) > 0 ? "متوفر" : "حسب الطلب",
    structuredData: buildProductStructuredData({
      categoryName: categoryLabel,
      pathname: `/products/${id}`,
      product: normalizedItem
    })
  };
}

/**
 * Loads the public service details snapshot by slug or id.
 *
 * @param {string} slug
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadServiceDetailsSnapshot(slug) {
  if (!slug) {
    return null;
  }

  const { data, error } = await supabase.from("repair_services").select("*").eq("status", "active");
  if (error) {
    return null;
  }

  const service =
    (data || []).find((item) => item.id === slug || slugifyArabic(item.name) === slug) || null;

  return service
    ? {
        service,
        structuredData: buildServiceStructuredData({
          pathname: `/services/${slug}`,
          service
        })
      }
    : null;
}

/**
 * Loads the digital subscriptions page snapshot.
 *
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function loadSubscriptionsPageSnapshot() {
  const { categories, products } = await loadCatalogSnapshot();
  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category.name]));

  return selectSubscriptionProducts({ categories, products }).map((product) => ({
    badge: product.sold > 50 ? "الأكثر طلبًا" : null,
    category: categoryMap[product.category_id] || "أخرى",
    categoryId: product.category_id,
    description: product.description,
    discountPrice: product.discount_price,
    icon: "wallet",
    id: product.id,
    images: product.images || [],
    link: `/products/${product.id}`,
    name: product.name,
    price: product.price,
    quantity: product.quantity,
    rating: product.rating,
    reviewCount: product.review_count || product.reviews_count || product.sold || null
  }));
}

/**
 * Converts Arabic labels into stable slugs.
 *
 * @param {string} text
 * @returns {string}
 */
function slugifyArabic(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export { formatCurrency, isOptimizableImageSrc };
