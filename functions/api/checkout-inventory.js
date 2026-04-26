/**
 * Checkout inventory orchestration helpers.
 */

import {
  applyInventoryAdjustments,
  buildInventoryAdjustments,
} from "../../services/checkoutInventoryService.js";
import { rollbackCheckoutState } from "../../services/checkoutRollbackService.js";

/**
 * Builds the optimistic inventory adjustments for physical items in the order.
 *
 * @param {{
 *   buildInventoryAdjustmentsImpl?: typeof buildInventoryAdjustments,
 *   items: Array<{ id: string, qty: number }>,
 *   physicalProducts: Array<Record<string, unknown>>,
 * }} input
 * @returns {Array<{ productId: string, previousQuantity: number, nextQuantity: number, previousSold: number, nextSold: number, previousStatus: string, nextStatus: string }>}
 */
export function buildCheckoutInventoryAdjustments({
  buildInventoryAdjustmentsImpl = buildInventoryAdjustments,
  items,
  physicalProducts,
}) {
  return buildInventoryAdjustmentsImpl({
    products: physicalProducts,
    aggregatedItems: items.filter((item) => !item.id.startsWith("srv-")),
  });
}

/**
 * Applies optimistic inventory adjustments one by one and returns the applied subset.
 *
 * @param {{
 *   admin: import('@supabase/supabase-js').SupabaseClient,
 *   adjustments: Array<{ productId: string, previousQuantity: number, nextQuantity: number, previousSold: number, nextSold: number, previousStatus: string, nextStatus: string }>,
 *   applyInventoryAdjustmentsImpl?: typeof applyInventoryAdjustments,
 * }} input
 * @returns {Promise<Array<{ productId: string, previousQuantity: number, nextQuantity: number, previousSold: number, nextSold: number, previousStatus: string, nextStatus: string }>>}
 */
export async function applyCheckoutInventoryAdjustments({
  admin,
  adjustments,
  applyInventoryAdjustmentsImpl = applyInventoryAdjustments,
}) {
  const appliedInventoryAdjustments = [];

  try {
    for (const adjustment of adjustments) {
      const appliedAdjustments = await applyInventoryAdjustmentsImpl({
        adjustments: [adjustment],
        client: admin,
      });
      appliedInventoryAdjustments.push(...appliedAdjustments);
    }
  } catch (error) {
    error.appliedInventoryAdjustments = appliedInventoryAdjustments;
    throw error;
  }

  return appliedInventoryAdjustments;
}

/**
 * Rolls back the local checkout state after a post-order failure.
 *
 * @param {{
 *   admin: import('@supabase/supabase-js').SupabaseClient,
 *   appliedInventoryAdjustments: Array<{ productId: string, previousQuantity: number, nextQuantity: number, previousSold: number, nextSold: number, previousStatus: string, nextStatus: string }>,
 *   orderId: string,
 *   rollbackCheckoutStateImpl?: typeof rollbackCheckoutState,
 * }} input
 * @returns {Promise<void>}
 */
export async function rollbackCheckoutProcessing({
  admin,
  appliedInventoryAdjustments,
  orderId,
  rollbackCheckoutStateImpl = rollbackCheckoutState,
}) {
  const rollbackResult = await rollbackCheckoutStateImpl({
    orderId,
    appliedInventoryAdjustments,
    client: admin,
  });

  if (!rollbackResult.ok) {
    console.error("[CHK-111] Checkout rollback error:", JSON.stringify(rollbackResult));
  }
}
