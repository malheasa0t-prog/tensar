import {
  buildServiceOrderNotifications,
  insertServiceOrderNotifications
} from "../../../services/serviceOrderNotificationService.js";
import { persistServiceOrderSyncState } from "../../../services/serviceOrderSyncService.js";
import {
  MISSING_SYNC_SECRET_ERROR,
  resolveOrderSyncAccess
} from "../../../services/orderSyncAccessService.js";

import { mapProviderStatus, SYNCABLE_ORDER_STATUSES } from "../lib/orderSync.mjs";
import { createProviderApi } from "../lib/provider.mjs";
import { createAdminSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse } from "../lib/http.mjs";

/**
 * Returns an HTTP response when the sync request is unauthorized.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Response | null}
 */
function getUnauthorizedSyncResponse(request, env) {
  const accessState = resolveOrderSyncAccess({
    expectedSecret: env?.CRON_SECRET,
    providedSecret: request.headers.get("x-cron-secret")
  });

  if (accessState.isAuthorized) {
    return null;
  }

  if (accessState.error === MISSING_SYNC_SECRET_ERROR) {
    return errorResponse(accessState.error, accessState.status);
  }

  return errorResponse(accessState.error, accessState.status);
}

/**
 * Synchronizes provider statuses into the database.
 *
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
async function runSync(env) {
  try {
    const adminClient = createAdminSupabaseClient(env);
    const providerApi = createProviderApi(env);
    const ordersResponse = await adminClient
      .from("service_orders")
      .select("*")
      .in("status", SYNCABLE_ORDER_STATUSES)
      .not("external_order_id", "is", null);

    if (ordersResponse.error) {
      return errorResponse("Failed to fetch orders", 500);
    }

    const orders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
    if (orders.length === 0) {
      return jsonResponse({ message: "No orders to sync", synced: 0, skipped: 0, failed: 0 });
    }

    let failed = 0;
    let skipped = 0;
    let synced = 0;
    const results = [];

    for (const order of orders) {
      try {
        const providerResult = await providerApi.checkOrderStatus(order.external_order_id);
        if (!providerResult.success) {
          failed += 1;
          results.push({ id: order.id, error: providerResult.error || "Provider sync failed" });
          continue;
        }

        const newStatus = mapProviderStatus(providerResult.status);
        if (newStatus === order.status) {
          skipped += 1;
          results.push({ id: order.id, skipped: true, reason: "unchanged_status" });
          continue;
        }

        const persistResult = await persistServiceOrderSyncState({
          client: adminClient,
          newStatus,
          order,
          providerResult
        });

        if (!persistResult.applied) {
          skipped += 1;
          results.push({ id: order.id, skipped: true, reason: "stale_order_status" });
          continue;
        }

        const notificationError = await insertServiceOrderNotifications({
          client: adminClient,
          notifications: buildServiceOrderNotifications({
            finalStatus: persistResult.finalStatus,
            order,
            refundAmount: persistResult.refundAmount,
            requestedStatus: newStatus
          })
        });

        synced += 1;
        results.push({
          id: order.id,
          old: order.status,
          new: persistResult.finalStatus,
          refundAmount: persistResult.refundAmount,
          notificationError
        });
      } catch (error) {
        failed += 1;
        results.push({
          id: order.id,
          error: error instanceof Error ? error.message : "Unknown sync error"
        });
      }
    }

    return jsonResponse({
      success: true,
      message: "Sync complete",
      total: orders.length,
      synced,
      skipped,
      failed,
      results
    });
  } catch {
    return errorResponse("Sync failed", 500);
  }
}

/**
 * Handles browser or cron order-sync triggers.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleOrderSyncRequest(request, env) {
  const unauthorizedResponse = getUnauthorizedSyncResponse(request, env);
  return unauthorizedResponse || runSync(env);
}
