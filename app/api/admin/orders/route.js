import { NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';

export const runtime = 'nodejs';

const PRODUCT_STATUSES = ['awaiting_delivery', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'failed'];
const DIGITAL_STATUSES = ['pending', 'processing', 'in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded'];

export async function GET(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const [ordersRes, itemsRes, digitalRes] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('order_items')
        .select('*')
        .order('id', { ascending: true }),
      supabaseAdmin
        .from('service_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (ordersRes.error || itemsRes.error || digitalRes.error) {
      return NextResponse.json({ success: false, error: 'تعذر تحميل الطلبات.' }, { status: 500 });
    }

    const itemsByOrderId = (itemsRes.data || []).reduce((acc, item) => {
      if (!acc[item.order_id]) {
        acc[item.order_id] = [];
      }
      acc[item.order_id].push(item);
      return acc;
    }, {});

    const userIds = [...new Set((digitalRes.data || []).map((order) => order.user_id).filter(Boolean))];
    const profilesRes = userIds.length === 0
      ? { data: [], error: null }
      : await supabaseAdmin
          .from('user_profiles')
          .select('user_id,full_name,phone')
          .in('user_id', userIds);

    if (profilesRes.error) {
      return NextResponse.json({ success: false, error: 'تعذر تحميل بيانات المستخدمين.' }, { status: 500 });
    }

    const profilesMap = new Map((profilesRes.data || []).map((profile) => [profile.user_id, profile]));

    const productOrders = (ordersRes.data || []).map((order) => ({
      ...order,
      items: itemsByOrderId[order.id] || [],
      customer_display_name: order.customer_name || 'عميل',
      customer_phone_display: order.customer_phone || '-',
    }));

    const digitalOrders = (digitalRes.data || []).map((order) => {
      const profile = profilesMap.get(order.user_id);
      return {
        ...order,
        user_display_name: profile?.full_name || 'مستخدم',
        user_phone: profile?.phone || '',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        productOrders,
        digitalOrders,
      },
    });
  } catch (error) {
    console.error('Admin orders GET error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ غير متوقع.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const orderType = body?.order_type;
    const id = body?.id;
    const status = body?.status;

    if (!id || !status || !['product', 'digital'].includes(orderType)) {
      return NextResponse.json({ success: false, error: 'بيانات الطلب غير صالحة.' }, { status: 400 });
    }

    if (orderType === 'product') {
      if (!PRODUCT_STATUSES.includes(status)) {
        return NextResponse.json({ success: false, error: 'حالة طلب المتجر غير صالحة.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ success: false, error: 'تعذر تحديث حالة طلب المتجر.' }, { status: 500 });
      }
    } else {
      if (!DIGITAL_STATUSES.includes(status)) {
        return NextResponse.json({ success: false, error: 'حالة الطلب الرقمي غير صالحة.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('service_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ success: false, error: 'تعذر تحديث حالة الطلب الرقمي.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, data: { id, status, orderType } });
  } catch (error) {
    console.error('Admin orders PATCH error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ غير متوقع.' }, { status: 500 });
  }
}
