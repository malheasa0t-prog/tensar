export const RESTOCK_SUBSCRIPTION_REFERENCE_TYPE = "restock_subscription";
const RESTOCK_NOTIFICATION_REFERENCE_TYPE = "product";
const ON_DEMAND_PRODUCT_TYPES = new Set(["digital", "service", "subscription"]);
const EXISTING_PRODUCT_SELECT_FIELDS = "id,name,status,quantity,product_type";

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readQuantity(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0;
}

export function isAdminProductOutOfStock(product) {
  const status = normalizeText(product?.status);
  const productType = normalizeText(product?.product_type || product?.productType);

  if (status === "out_of_stock") {
    return true;
  }

  if (ON_DEMAND_PRODUCT_TYPES.has(productType)) {
    return false;
  }

  return readQuantity(product?.quantity) <= 0;
}

export function hasAdminProductRestocked(previousProduct, nextProduct) {
  return isAdminProductOutOfStock(previousProduct) && !isAdminProductOutOfStock(nextProduct);
}

export function buildAdminRestockNotifications({ productId, productName, subscriptions }) {
  const uniqueUserIds = [...new Set((Array.isArray(subscriptions) ? subscriptions : []).map((item) => String(item?.user_id || "").trim()).filter(Boolean))];

  return uniqueUserIds.map((userId) => ({
    user_id: userId,
    title: "عاد المنتج إلى المخزون",
    body: `${productName || "المنتج"} متوفر الآن من جديد ويمكنك إكمال الطلب.`,
    type: "success",
    reference_type: RESTOCK_NOTIFICATION_REFERENCE_TYPE,
    reference_id: productId,
  }));
}

export async function fetchExistingProductSnapshot({ productId, supabase }) {
  if (!supabase || !String(productId || "").trim()) {
    return null;
  }

  const response = await supabase
    .from("products")
    .select(EXISTING_PRODUCT_SELECT_FIELDS)
    .eq("id", productId)
    .maybeSingle();

  if (response.error) {
    throw new Error("تعذر تحميل حالة المنتج الحالية.");
  }

  return response.data || null;
}

export async function syncProductRestockAlerts({ executeSync, previousProduct, product, supabase }) {
  if (!supabase || typeof executeSync !== "function" || !hasAdminProductRestocked(previousProduct, product)) {
    return;
  }

  const subscriptionsResponse = await supabase
    .from("notifications")
    .select("id,user_id")
    .eq("reference_type", RESTOCK_SUBSCRIPTION_REFERENCE_TYPE)
    .eq("reference_id", product.id);

  if (subscriptionsResponse.error) {
    throw new Error("تعذر تحميل مشتركي تنبيه التوفر.");
  }

  const subscriptions = Array.isArray(subscriptionsResponse.data) ? subscriptionsResponse.data : [];
  if (subscriptions.length === 0) {
    return;
  }

  const notificationRows = buildAdminRestockNotifications({
    productId: product.id,
    productName: product.name,
    subscriptions,
  });

  if (notificationRows.length > 0) {
    await executeSync(
      supabase.from("notifications").insert(notificationRows),
      "تعذر إرسال إشعارات عودة المنتج."
    );
  }

  await executeSync(
    supabase.from("notifications").delete().in("id", subscriptions.map((item) => item.id).filter(Boolean)),
    "تعذر تنظيف اشتراكات تنبيه التوفر."
  );
}
