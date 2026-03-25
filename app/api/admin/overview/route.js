import { NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';

export const runtime = 'nodejs';

function sumRows(rows, selector) {
  return (rows || []).reduce((total, row) => total + Number(selector(row) || 0), 0);
}

export async function GET(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const [productsRes, ordersRes, digitalRes, repairsRes, usersRes] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id,name,quantity,status,low_stock_alert'),
      supabaseAdmin
        .from('orders')
        .select('id,customer_name,total,status,created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('service_orders')
        .select('id,service_name,total,status,created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('repair_bookings')
        .select('id,name,service_name,device,status,created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('user_profiles')
        .select('user_id,role'),
    ]);

    if (productsRes.error || ordersRes.error || digitalRes.error || repairsRes.error || usersRes.error) {
      return NextResponse.json({ success: false, error: 'تعذر تحميل بيانات لوحة الإدارة.' }, { status: 500 });
    }

    const products = productsRes.data || [];
    const productOrders = ordersRes.data || [];
    const digitalOrders = digitalRes.data || [];
    const repairs = repairsRes.data || [];
    const users = usersRes.data || [];

    const activeProductOrderStatuses = ['awaiting_delivery', 'pending', 'confirmed', 'processing', 'shipped'];
    const activeDigitalStatuses = ['pending', 'processing', 'in_progress'];
    const openRepairStatuses = ['pending', 'received', 'diagnosing', 'waiting_approval', 'in_progress', 'ready'];

    const lowStockProducts = products
      .filter((product) => Number(product.quantity || 0) <= Number(product.low_stock_alert || 0))
      .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
      .slice(0, 6);

    const productRevenue = sumRows(
      productOrders.filter((order) => !['cancelled', 'failed'].includes(order.status)),
      (order) => order.total
    );
    const digitalRevenue = sumRows(
      digitalOrders.filter((order) => !['cancelled', 'failed', 'refunded'].includes(order.status)),
      (order) => order.total
    );

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          productsTotal: products.length,
          productsActive: products.filter((product) => product.status === 'active').length,
          productOrdersTotal: productOrders.length,
          productOrdersPending: productOrders.filter((order) => activeProductOrderStatuses.includes(order.status)).length,
          digitalOrdersTotal: digitalOrders.length,
          digitalOrdersActive: digitalOrders.filter((order) => activeDigitalStatuses.includes(order.status)).length,
          repairsTotal: repairs.length,
          repairsOpen: repairs.filter((repair) => openRepairStatuses.includes(repair.status)).length,
          usersTotal: users.length,
          adminsTotal: users.filter((profile) => ['admin', 'super_admin'].includes(profile.role)).length,
          productRevenue,
          digitalRevenue,
          totalRevenue: productRevenue + digitalRevenue,
        },
        recent: {
          productOrders: productOrders.slice(0, 6),
          digitalOrders: digitalOrders.slice(0, 6),
          repairBookings: repairs.slice(0, 6),
        },
        lowStockProducts,
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ غير متوقع.' }, { status: 500 });
  }
}
