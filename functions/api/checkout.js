/**
 * Cloudflare Pages Function — Checkout API.
 *
 * Handles POST /api/checkout — creates physical product orders.
 * Implemented as a self-contained Cloudflare Pages Function with
 * inlined utility logic for checkout validation and order creation.
 */

import { createSupabaseAdmin, extractBearerToken, errorResponse, successResponse } from '../_lib/supabase.js';

/* ─── Constants ─── */

const BANNED_ACCOUNT_MESSAGE = 'حسابك محظور. تواصل مع الإدارة.';

/* ─── Pure Utility Functions ─── */

/**
 * Returns a trimmed string or empty string for invalid values.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Converts a value to a positive integer when possible.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function asPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Validates customer checkout fields.
 *
 * @param {{ name: string, phone: string }} input
 * @returns {string | null} Error message or null if valid
 */
function validateCustomer({ name, phone }) {
  if (!name || name.length < 2 || name.length > 120) return 'الاسم غير صالح';
  if (!/^[+0-9\s()-]{7,20}$/.test(phone)) return 'رقم الهاتف غير صالح';
  return null;
}

/**
 * Normalizes and deduplicates checkout items.
 *
 * @param {Array<unknown>} rawItems
 * @returns {Array<{ id: string, qty: number }>}
 */
function normalizeItems(rawItems) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => ({ id: normalizeText(item?.id), qty: asPositiveInt(item?.qty) }))
    .filter((item) => item.id && item.qty);

  const map = new Map();
  for (const item of items) {
    map.set(item.id, (map.get(item.id) || 0) + item.qty);
  }

  return Array.from(map, ([id, qty]) => ({ id, qty }));
}

/**
 * Calculates shipping fee based on delivery method.
 *
 * @param {string} method
 * @param {Array<{ value: string, fee?: number }>} methods
 * @returns {number}
 */
function getShippingFee(method, methods) {
  const found = (methods || []).find((m) => m.value === method);
  return Number(found?.fee) || 0;
}

/**
 * Generates a unique order ID.
 *
 * @returns {string}
 */
function generateOrderId() {
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ─── Main Handler ─── */

/**
 * POST /api/checkout — creates a physical product order.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const customerName = normalizeText(body?.customer_name);
    const customerPhone = normalizeText(body?.customer_phone);
    const customerEmail = normalizeText(body?.customer_email);
    const notes = normalizeText(body?.notes);
    const deliveryMethod = normalizeText(body?.delivery_method) || 'delivery';
    const paymentMethod = normalizeText(body?.payment_method) || 'cod';

    /* ── Validate customer ── */
    const customerError = validateCustomer({ name: customerName, phone: customerPhone });
    if (customerError) return errorResponse(customerError, 400);

    /* ── Validate cart items ── */
    const items = normalizeItems(body?.items);
    if (items.length === 0) return errorResponse('بيانات السلة غير صالحة', 400);

    const admin = createSupabaseAdmin(env);

    /* ── Optional user auth ── */
    let userId = null;
    const token = extractBearerToken(request);
    if (token) {
      const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
      const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
      const { createClient } = await import('@supabase/supabase-js');
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user } } = await userClient.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await admin.from('user_profiles').select('status').eq('user_id', user.id).single();
        if (profile?.status === 'banned') return errorResponse(BANNED_ACCOUNT_MESSAGE, 403);
      }
    }

    /* ── Load products from catalog ── */
    const productIds = items.map((i) => i.id);
    const { data: products, error: productsError } = await admin
      .from('products')
      .select('id,name,price,discount_price,quantity,sold,status,category_id,product_type,brand,images')
      .in('id', productIds)
      .eq('status', 'active');

    if (productsError) return errorResponse('تعذر تحميل بيانات المنتجات', 500);

    /* ── Build order lines with validation ── */
    const productMap = new Map((products || []).map((p) => [p.id, p]));
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) return errorResponse(`المنتج غير متاح: ${item.id}`, 400);
      if (product.quantity < item.qty) {
        return errorResponse(`الكمية المطلوبة (${item.qty}) تتجاوز المتوفر (${product.quantity}) — ${product.name}`, 400);
      }

      const unitPrice = Number(product.discount_price || product.price || 0);
      subtotal += unitPrice * item.qty;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        qty: item.qty,
        price: unitPrice,
        snapshot: {
          category_id: product.category_id || null,
          product_type: product.product_type || 'physical',
          brand: product.brand || null,
          image: Array.isArray(product.images) ? product.images[0] || null : null,
        },
      });
    }

    /* ── Load delivery methods from settings ── */
    const { data: settingsRow } = await admin.from('settings').select('data').limit(1).maybeSingle();
    const settingsData = settingsRow?.data || {};
    const deliveryMethods = Array.isArray(settingsData.deliveryMethods)
      ? settingsData.deliveryMethods
      : [{ value: 'delivery', label: 'توصيل', fee: 2 }, { value: 'pickup', label: 'استلام', fee: 0 }];

    if (!deliveryMethods.some((m) => m.value === deliveryMethod)) {
      return errorResponse('طريقة التسليم غير صالحة', 400);
    }

    const shippingFee = getShippingFee(deliveryMethod, deliveryMethods);
    const total = subtotal + shippingFee;
    const orderId = generateOrderId();

    /* ── Create order ── */
    const { error: orderError } = await admin.from('orders').insert([{
      id: orderId,
      user_id: userId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      total,
      status: 'new',
      delivery_method: deliveryMethod,
      payment_method: paymentMethod,
      shipping_fee: shippingFee,
      notes: notes || null,
    }]);

    if (orderError) return errorResponse('تعذر إنشاء الطلب', 500);

    /* ── Create order items ── */
    const { error: itemsError } = await admin.from('order_items').insert(
      orderItems.map((item) => ({ order_id: orderId, ...item }))
    );

    if (itemsError) {
      await admin.from('orders').delete().eq('id', orderId);
      return errorResponse('تعذر حفظ عناصر الطلب', 500);
    }

    /* ── Decrement inventory ── */
    for (const item of items) {
      const product = productMap.get(item.id);
      if (product) {
        await admin
          .from('products')
          .update({
            quantity: Math.max(0, product.quantity - item.qty),
            sold: (product.sold || 0) + item.qty,
          })
          .eq('id', item.id);
      }
    }

    /* ── Notify user ── */
    if (userId) {
      await admin.from('notifications').insert([{
        user_id: userId,
        title: 'تم إنشاء طلبك بنجاح',
        body: `طلب #${orderId} — ${orderItems.length} منتج — المبلغ: ${total.toFixed(2)} د.أ`,
        type: 'success',
        reference_type: 'order',
        reference_id: orderId,
      }]);
    }

    return successResponse({
      data: { order_id: orderId, total, items_count: orderItems.length },
    });

  } catch (err) {
    console.error('Checkout API error:', err);
    return errorResponse('حدث خطأ غير متوقع', 500);
  }
}
