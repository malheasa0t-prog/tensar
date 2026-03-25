import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function getOptionalUserId(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!token) return null;

  const {
    data: { user },
  } = await supabaseServer.auth.getUser(token);

  return user?.id || null;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const items = Array.isArray(body?.items) ? body.items : [];
    const customerName = normalizeText(body?.customer_name);
    const customerPhone = normalizeText(body?.customer_phone);
    const customerEmail = normalizeText(body?.customer_email);
    const notes = normalizeText(body?.notes);
    const deliveryMethod = normalizeText(body?.delivery_method) || 'delivery';
    const paymentMethod = normalizeText(body?.payment_method) || 'cod';

    if (!customerName || customerName.length < 2 || customerName.length > 120) {
      return NextResponse.json({ success: false, error: 'الاسم غير صالح' }, { status: 400 });
    }

    if (!/^[+0-9\s()-]{7,20}$/.test(customerPhone)) {
      return NextResponse.json({ success: false, error: 'رقم الهاتف غير صالح' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'السلة فارغة' }, { status: 400 });
    }

    const normalizedItems = items
      .map((item) => ({
        id: normalizeText(item?.id),
        qty: asPositiveInt(item?.qty),
      }))
      .filter((item) => item.id && item.qty);

    if (normalizedItems.length === 0) {
      return NextResponse.json({ success: false, error: 'بيانات السلة غير صالحة' }, { status: 400 });
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.id))];

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id,name,price,discount_price,status')
      .in('id', productIds)
      .eq('status', 'active');

    if (productsError) {
      return NextResponse.json({ success: false, error: 'تعذر تحميل بيانات المنتجات' }, { status: 500 });
    }

    const productMap = new Map((products || []).map((p) => [p.id, p]));

    let subtotal = 0;
    const orderItems = [];

    for (const item of normalizedItems) {
      const product = productMap.get(item.id);
      if (!product) {
        return NextResponse.json({ success: false, error: `المنتج غير متاح: ${item.id}` }, { status: 400 });
      }

      const unitPrice = Number(product.discount_price || product.price || 0);
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        qty: item.qty,
        price: unitPrice,
      });
    }

    const shippingFee = deliveryMethod === 'delivery' ? 0 : 0;
    const total = subtotal + shippingFee;

    const userId = await getOptionalUserId(request);
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const { error: orderError } = await supabaseAdmin.from('orders').insert([
      {
        id: orderId,
        user_id: userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        total,
        status: 'awaiting_delivery',
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        shipping_fee: shippingFee,
        notes: notes || null,
      },
    ]);

    if (orderError) {
      return NextResponse.json({ success: false, error: 'تعذر إنشاء الطلب' }, { status: 500 });
    }

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
      orderItems.map((item) => ({
        order_id: orderId,
        ...item,
      }))
    );

    if (itemsError) {
      await supabaseAdmin.from('orders').delete().eq('id', orderId);
      return NextResponse.json({ success: false, error: 'تعذر حفظ عناصر الطلب' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        total,
        items_count: orderItems.length,
      },
    });
  } catch (err) {
    console.error('Checkout API error:', err);
    return NextResponse.json({ success: false, error: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
