const ACTIVE_PRODUCT_STATUS = "active";
const OUT_OF_STOCK_PRODUCT_STATUS = "out_of_stock";

export const INVENTORY_CONFLICT_ERROR_MESSAGE = "تغير مخزون بعض المنتجات أثناء تنفيذ الطلب. حاول مرة أخرى.";
export const INVENTORY_UPDATE_ERROR_MESSAGE = "تعذر تحديث مخزون المنتجات.";

/**
 * Converts a value to a non-negative integer when possible.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function toNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Normalizes the product status used during inventory updates.
 *
 * @param {unknown} status
 * @returns {string}
 */
function normalizeProductStatus(status) {
  return typeof status === "string" && status.trim() ? status.trim().toLowerCase() : ACTIVE_PRODUCT_STATUS;
}

/**
 * Builds optimistic inventory updates from the current product snapshots.
 *
 * @param {{
 *   products: Array<Record<string, unknown>>,
 *   aggregatedItems: Array<{ id: string, qty: number }>,
 * }} input
 * @returns {Array<{
 *   productId: string,
 *   previousQuantity: number,
 *   nextQuantity: number,
 *   previousSold: number,
 *   nextSold: number,
 *   previousStatus: string,
 *   nextStatus: string,
 * }>}
 * @throws {Error}
 */
export function buildInventoryAdjustments({ products, aggregatedItems }) {
  const productsList = Array.isArray(products) ? products : [];
  const itemsList = Array.isArray(aggregatedItems) ? aggregatedItems : [];
  const productsById = new Map(productsList.map((product) => [String(product?.id || ""), product]));

  return itemsList.map((item) => {
    const productId = String(item?.id || "");
    const product = productsById.get(productId);
    const requestedQuantity = toNonNegativeInteger(item?.qty);
    const previousQuantity = toNonNegativeInteger(product?.quantity);
    const previousSold = toNonNegativeInteger(product?.sold) ?? 0;

    if (!product || !productId || requestedQuantity === null || requestedQuantity <= 0 || previousQuantity === null) {
      throw new Error(INVENTORY_UPDATE_ERROR_MESSAGE);
    }

    if (requestedQuantity > previousQuantity) {
      throw new Error(INVENTORY_CONFLICT_ERROR_MESSAGE);
    }

    const nextQuantity = previousQuantity - requestedQuantity;
    const previousStatus = normalizeProductStatus(product.status);
    return {
      productId,
      previousQuantity,
      nextQuantity,
      previousSold,
      nextSold: previousSold + requestedQuantity,
      previousStatus,
      nextStatus: nextQuantity === 0 ? OUT_OF_STOCK_PRODUCT_STATUS : previousStatus,
    };
  });
}

/**
 * Applies one optimistic inventory update.
 *
 * @param {{
 *   adjustment: {
 *     productId: string,
 *     previousQuantity: number,
 *     nextQuantity: number,
 *     previousSold: number,
 *     nextSold: number,
 *     previousStatus: string,
 *     nextStatus: string,
 *   },
 *   client: { from: (table: string) => { update: (payload: Record<string, unknown>) => any } },
 *   restoring?: boolean,
 * }} input
 * @returns {Promise<boolean>}
 * @throws {Error}
 */
async function runInventoryUpdate({ adjustment, client, restoring = false }) {
  const payload = restoring
    ? {
        quantity: adjustment.previousQuantity,
        sold: adjustment.previousSold,
        status: adjustment.previousStatus,
        updated_at: new Date().toISOString(),
      }
    : {
        quantity: adjustment.nextQuantity,
        sold: adjustment.nextSold,
        status: adjustment.nextStatus,
        updated_at: new Date().toISOString(),
      };
  const expectedQuantity = restoring ? adjustment.nextQuantity : adjustment.previousQuantity;
  const expectedSold = restoring ? adjustment.nextSold : adjustment.previousSold;
  const expectedStatus = restoring ? adjustment.nextStatus : adjustment.previousStatus;
  const response = await client
    .from("products")
    .update(payload)
    .eq("id", adjustment.productId)
    .eq("quantity", expectedQuantity)
    .eq("sold", expectedSold)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (response?.error) {
    throw new Error(INVENTORY_UPDATE_ERROR_MESSAGE);
  }

  return Boolean(response?.data?.id);
}

/**
 * Applies product inventory updates sequentially using optimistic concurrency checks.
 *
 * @param {{
 *   adjustments: Array<{
 *     productId: string,
 *     previousQuantity: number,
 *     nextQuantity: number,
 *     previousSold: number,
 *     nextSold: number,
 *     previousStatus: string,
 *     nextStatus: string,
 *   }>,
 *   client: { from: (table: string) => { update: (payload: Record<string, unknown>) => any } },
 * }} input
 * @returns {Promise<Array<{
 *   productId: string,
 *   previousQuantity: number,
 *   nextQuantity: number,
 *   previousSold: number,
 *   nextSold: number,
 *   previousStatus: string,
 *   nextStatus: string,
 * }>>}
 * @throws {Error}
 */
export async function applyInventoryAdjustments({ adjustments, client }) {
  const appliedAdjustments = [];

  for (const adjustment of Array.isArray(adjustments) ? adjustments : []) {
    const updated = await runInventoryUpdate({ adjustment, client });
    if (!updated) {
      throw new Error(INVENTORY_CONFLICT_ERROR_MESSAGE);
    }

    appliedAdjustments.push(adjustment);
  }

  return appliedAdjustments;
}

/**
 * Rolls back previously applied inventory changes in reverse order.
 *
 * @param {{
 *   adjustments: Array<{
 *     productId: string,
 *     previousQuantity: number,
 *     nextQuantity: number,
 *     previousSold: number,
 *     nextSold: number,
 *     previousStatus: string,
 *     nextStatus: string,
 *   }>,
 *   client: { from: (table: string) => { update: (payload: Record<string, unknown>) => any } },
 * }} input
 * @returns {Promise<Array<string>>}
 */
export async function rollbackInventoryAdjustments({ adjustments, client }) {
  const appliedAdjustments = Array.isArray(adjustments) ? [...adjustments].reverse() : [];
  const failedProductIds = [];

  for (const adjustment of appliedAdjustments) {
    try {
      await runInventoryUpdate({ adjustment, client, restoring: true });
    } catch {
      failedProductIds.push(adjustment.productId);
    }
  }

  return failedProductIds;
}
