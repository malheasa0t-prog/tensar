import { NextResponse } from 'next/server';
import { checkProviderOrderStatus } from '@/lib/providerAPI';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }

  const provided = request.headers.get('x-cron-secret');
  return provided === secret;
}

// Map provider status strings to our internal status
function mapProviderStatus(providerStatus) {
  const normalized = String(providerStatus || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const map = {
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
  return map[normalized] || 'processing';
}

async function runSync() {
  try {
    // 1. Fetch all orders that need syncing (not completed/failed/cancelled/refunded)
    const { data: orders, error } = await supabaseAdmin
      .from('service_orders')
      .select('*')
      .in('status', ['processing', 'in_progress', 'pending'])
      .not('external_order_id', 'is', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ message: 'No orders to sync', synced: 0 });
    }

    let synced = 0;
    let failed = 0;
    const results = [];

    // 2. Check status for each order from the provider
    for (const order of orders) {
      try {
        const result = await checkProviderOrderStatus(order.external_order_id);

        if (!result.success) {
          failed++;
          results.push({ id: order.id, error: result.error });
          continue;
        }

        const newStatus = mapProviderStatus(result.status);

        // Only update if status actually changed
        if (newStatus !== order.status) {
          const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString(),
          };

          if (result.startCount !== undefined) updateData.start_count = Number(result.startCount) || 0;
          if (result.remains !== undefined) updateData.remains = Number(result.remains) || 0;

          await supabaseAdmin.from('service_orders').update(updateData).eq('id', order.id);

          // Send notification to user about status change
          const statusLabels = {
            completed: 'تم إكمال طلبك بنجاح! ✅',
            partial: 'تم تنفيذ طلبك جزئياً ⚠️',
            failed: 'فشل تنفيذ طلبك ❌',
            cancelled: 'تم إلغاء طلبك 🚫',
            in_progress: 'بدأ تنفيذ طلبك ⚙️',
          };

          if (statusLabels[newStatus]) {
            await supabaseAdmin.from('notifications').insert([{
              user_id: order.user_id,
              title: statusLabels[newStatus],
              body: 'الخدمة: ' + order.service_name,
              type: newStatus === 'completed' ? 'success' : newStatus === 'failed' ? 'error' : 'info',
              reference_type: 'order',
              reference_id: order.id
            }]);
          }

          // Handle refund for failed orders
          if (newStatus === 'failed' || newStatus === 'cancelled') {
            const { data: wallet } = await supabaseAdmin.from('wallets').select('*').eq('user_id', order.user_id).single();
            if (wallet) {
              const refundAmount = Number(order.total);
              const newBalance = Number(wallet.balance) + refundAmount;

              await supabaseAdmin.from('wallets').update({
                balance: newBalance,
                total_spent: Math.max(0, Number(wallet.total_spent) - refundAmount),
                updated_at: new Date().toISOString()
              }).eq('id', wallet.id);

              await supabaseAdmin.from('wallet_transactions').insert([{
                wallet_id: wallet.id,
                user_id: order.user_id,
                type: 'refund',
                amount: refundAmount,
                balance_after: newBalance,
                description: 'استرجاع تلقائي — ' + order.service_name,
                reference_id: order.id
              }]);

              await supabaseAdmin.from('service_orders').update({ status: 'refunded' }).eq('id', order.id);

              await supabaseAdmin.from('notifications').insert([{
                user_id: order.user_id,
                title: 'تم استرجاع رصيدك 💰',
                body: 'تم إعادة ' + refundAmount.toFixed(2) + ' د.أ إلى محفظتك بسبب فشل الطلب.',
                type: 'success',
                reference_type: 'order',
                reference_id: order.id
              }]);
            }
          }

          // Handle partial refund
          const remains = Number(result.remains || 0);
          if (newStatus === 'partial' && remains > 0) {
            const pricePerUnit = Number(order.price);
            const refundAmount = remains * pricePerUnit;

            const { data: wallet } = await supabaseAdmin.from('wallets').select('*').eq('user_id', order.user_id).single();
            if (wallet && refundAmount > 0) {
              const newBalance = Number(wallet.balance) + refundAmount;

              await supabaseAdmin.from('wallets').update({
                balance: newBalance,
                updated_at: new Date().toISOString()
              }).eq('id', wallet.id);

              await supabaseAdmin.from('wallet_transactions').insert([{
                wallet_id: wallet.id,
                user_id: order.user_id,
                type: 'refund',
                amount: refundAmount,
                balance_after: newBalance,
                description: 'استرجاع جزئي — ' + remains + ' وحدة لم تُنفذ',
                reference_id: order.id
              }]);
            }
          }

          synced++;
          results.push({ id: order.id, old: order.status, new: newStatus });
        }
      } catch (orderErr) {
        failed++;
        results.push({ id: order.id, error: orderErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sync complete',
      total: orders.length,
      synced,
      failed,
      results
    });

  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized sync trigger' }, { status: 401 });
  }

  return runSync();
}

// GET endpoint for easy trigger (e.g., from browser or cron)
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized sync trigger' }, { status: 401 });
  }

  return runSync();
}
