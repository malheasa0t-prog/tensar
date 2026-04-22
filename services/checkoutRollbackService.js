import { rollbackInventoryAdjustments } from "./checkoutInventoryService.js";

export const CHECKOUT_ROLLBACK_ERROR_MESSAGE = "[CKP-303] تعذر التراجع الكامل عن الطلب الحالي.";

/**
 * Deletes a checkout order and confirms the row was removed.
 *
 * @param {{ orderId: string, client: { from: (table: string) => { delete: () => { eq: (column: string, value: string) => any, select: (fields: string) => any, maybeSingle: () => Promise<{ data?: { id?: string } | null, error?: unknown }> } } } }} input
 * @returns {Promise<void>}
 * @throws {Error}
 */
export async function deleteCheckoutOrder({ orderId, client }) {
  const normalizedOrderId = typeof orderId === "string" ? orderId.trim() : "";
  if (!normalizedOrderId) {
    return;
  }

  const response = await client
    .from("orders")
    .delete()
    .eq("id", normalizedOrderId)
    .select("id")
    .maybeSingle();

  if (response?.error || response?.data?.id !== normalizedOrderId) {
    throw new Error(CHECKOUT_ROLLBACK_ERROR_MESSAGE);
  }
}

/**
 * Rolls back checkout side effects and reports any failures explicitly.
 *
 * @param {{ orderId: string, appliedInventoryAdjustments: Array<{ productId: string, previousQuantity: number, nextQuantity: number, previousSold: number, nextSold: number, previousStatus: string, nextStatus: string }>, client: { from: (table: string) => any } }} input
 * @returns {Promise<{ ok: boolean, failedInventoryProductIds: Array<string>, orderDeleteFailed: boolean }>}
 */
export async function rollbackCheckoutState({ orderId, appliedInventoryAdjustments, client }) {
  const failedInventoryProductIds = await rollbackInventoryAdjustments({
    adjustments: appliedInventoryAdjustments,
    client,
  });
  let orderDeleteFailed = false;

  try {
    await deleteCheckoutOrder({ orderId, client });
  } catch {
    orderDeleteFailed = true;
  }

  return {
    ok: failedInventoryProductIds.length === 0 && !orderDeleteFailed,
    failedInventoryProductIds,
    orderDeleteFailed,
  };
}
