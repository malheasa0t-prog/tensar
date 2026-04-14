import { NextResponse } from 'next/server';
import { checkProviderOrderStatus } from '@/lib/providerAPI';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  MISSING_SYNC_SECRET_ERROR,
  resolveOrderSyncAccess,
} from '@/services/orderSyncAccessService';
import {
  buildServiceOrderNotifications,
  insertServiceOrderNotifications,
} from '@/services/serviceOrderNotificationService';
import { persistServiceOrderSyncState } from '@/services/serviceOrderSyncService';

export const runtime = 'nodejs';

const SYNCABLE_ORDER_STATUSES = ['processing', 'in_progress', 'pending'];

/**
 * Returns an HTTP response when the sync request is unauthorized or misconfigured.
 *
 * @param {Request} request
 * @returns {NextResponse | null}
 */
function getUnauthorizedSyncResponse(request) {
  const accessState = resolveOrderSyncAccess({
    expectedSecret: process.env.CRON_SECRET,
    providedSecret: request.headers.get('x-cron-secret'),
  });

  if (accessState.isAuthorized) {
    return null;
  }
  if (accessState.error === MISSING_SYNC_SECRET_ERROR) {
    console.error('Order sync is disabled because CRON_SECRET is not configured.');
  }

  return NextResponse.json({ success: false, error: accessState.error }, { status: accessState.status });
}

/**
 * Maps provider-specific statuses into our internal order statuses.
 *
 * @param {unknown} providerStatus
 * @returns {string}
 */
function mapProviderStatus(providerStatus) {
  const normalized = String(providerStatus || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const statusMap = {
    completed: 'completed',
    in_progress: 'in_progress',
    pending: 'processing',
    processing: 'processing',
    partial: 'partial',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    refunded: 'refunded',
    refund: 'refunded',
    error: 'failed',
    failed: 'failed',
  };

  return statusMap[normalized] || 'processing';
}

/**
 * Synchronizes provider statuses into the database using an atomic DB transaction.
 *
 * @returns {Promise<NextResponse>}
 */
async function runSync() {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from('service_orders')
      .select('*')
      .in('status', SYNCABLE_ORDER_STATUSES)
      .not('external_order_id', 'is', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ message: 'No orders to sync', synced: 0, skipped: 0, failed: 0 });
    }

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    const results = [];

    for (const order of orders) {
      try {
        const providerResult = await checkProviderOrderStatus(order.external_order_id);
        if (!providerResult?.success) {
          failed += 1;
          results.push({ id: order.id, error: providerResult?.error || 'Provider sync failed' });
          continue;
        }

        const newStatus = mapProviderStatus(providerResult.status);
        if (newStatus === order.status) {
          skipped += 1;
          results.push({ id: order.id, skipped: true, reason: 'unchanged_status' });
          continue;
        }

        const persistResult = await persistServiceOrderSyncState({
          order,
          newStatus,
          providerResult,
          client: supabaseAdmin,
        });

        if (!persistResult.applied) {
          skipped += 1;
          results.push({ id: order.id, skipped: true, reason: 'stale_order_status' });
          continue;
        }

        const notificationError = await insertServiceOrderNotifications({
          client: supabaseAdmin,
          notifications: buildServiceOrderNotifications({
            order,
            requestedStatus: newStatus,
            finalStatus: persistResult.finalStatus,
            refundAmount: persistResult.refundAmount,
          }),
        });

        synced += 1;
        results.push({
          id: order.id,
          old: order.status,
          new: persistResult.finalStatus,
          refundAmount: persistResult.refundAmount,
          notificationError,
        });
      } catch (orderError) {
        failed += 1;
        results.push({
          id: order.id,
          error: orderError instanceof Error ? orderError.message : 'Unknown sync error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sync complete',
      total: orders.length,
      synced,
      skipped,
      failed,
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}

/**
 * Handles POST-based sync triggers.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  const unauthorizedResponse = getUnauthorizedSyncResponse(request);
  return unauthorizedResponse || runSync();
}

/**
 * Handles GET-based sync triggers for browser or cron access.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function GET(request) {
  const unauthorizedResponse = getUnauthorizedSyncResponse(request);
  return unauthorizedResponse || runSync();
}
