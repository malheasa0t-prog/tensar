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
  if (!name || name.length < 2 || name.length > 120) return '[CHK-101] الاسم غير صالح';
  if (!/^[+0-9\s()-]{7,20}$/.test(phone)) return '[CHK-102] رقم الهاتف غير صالح';
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
    if (items.length === 0) return errorResponse('[CHK-103] بيانات السلة غير صالحة', 400);

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
        if (profile?.status === 'banned') return errorResponse('[CHK-104] ' + BANNED_ACCOUNT_MESSAGE, 403);
      }
    }

    /* ── Load products from catalog ── */
    const productIds = items.map((i) => i.id);
    const { data: products, error: productsError } = await admin
      .from('products')
      .select('id,name,price,discount_price,quantity,sold,status,category_id,product_type,brand,images')
      .in('id', productIds)
      .eq('status', 'active');

    if (productsError) return errorResponse('[CHK-105] تعذر تحميل بيانات المنتجات', 500);

    /* ── Load missing items from services table (digital services) ── */
    const productMap = new Map((products || []).map((p) => [p.id, p]));
    const missingIds = productIds.filter((id) => !productMap.has(id));

    if (missingIds.length > 0) {
      const { data: services } = await admin
        .from('services')
        .select('id,name,price,image,status,category_id,provider_service_id')
        .in('id', missingIds)
        .eq('status', 'active');

      for (const svc of services || []) {
        productMap.set(svc.id, {
          id: svc.id,
          name: svc.name,
          price: svc.price,
          discount_price: null,
          quantity: 9999,
          sold: 0,
          status: 'active',
          category_id: svc.category_id || null,
          product_type: 'digital',
          brand: null,
          images: svc.image ? [svc.image] : [],
          provider_service_id: svc.provider_service_id || null,
        });
      }
    }

    /* ── Build order lines with validation ── */
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) return errorResponse(`[CHK-106] المنتج غير متاح: ${item.id}`, 400);
      if (product.product_type !== 'digital' && product.quantity < item.qty) {
        return errorResponse(`[CHK-107] الكمية المطلوبة (${item.qty}) تتجاوز المتوفر (${product.quantity}) — ${product.name}`, 400);
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
      return errorResponse('[CHK-108] طريقة التسليم غير صالحة', 400);
    }

    const shippingFee = getShippingFee(deliveryMethod, deliveryMethods);
    const total = subtotal + shippingFee;

    /* ── Create order ── */
    const { data: orderRow, error: orderError } = await admin.from('orders').insert([{
      user_id: userId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      subtotal,
      total,
      status: 'pending',
      delivery_method: deliveryMethod,
      payment_method: paymentMethod,
      shipping_fee: shippingFee,
      notes: notes || null,
    }]).select('id').single();

    if (orderError || !orderRow) {
      console.error('Order insert error:', JSON.stringify(orderError));
      return errorResponse(`[CHK-109] تعذر إنشاء الطلب: ${orderError?.message || 'خطأ غير معروف'}`, 500);
    }

    const orderId = orderRow.id;

    /* ── Create order items ── */
    const { error: itemsError } = await admin.from('order_items').insert(
      orderItems.map((item) => ({ order_id: orderId, ...item }))
    );

    if (itemsError) {
      console.error('Order items insert error:', JSON.stringify(itemsError));
      await admin.from('orders').delete().eq('id', orderId);
      return errorResponse(`[CHK-110] تعذر حفظ عناصر الطلب: ${itemsError?.message || 'خطأ غير معروف'}`, 500);
    }

    /* ── Decrement inventory ── */
    for (const item of items) {
      const product = productMap.get(item.id);
      if (product && product.product_type !== 'digital') {
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

    /* ── Forward digital items to Serva-S provider ── */
    const digitalForwardResults = [];
    for (const item of orderItems) {
      const product = productMap.get(item.product_id);
      if (!product || product.product_type !== 'digital' || !product.provider_service_id) continue;

      try {
        const unitPrice = Number(product.price || 0);
        const itemTotal = unitPrice * item.qty;

        /* Create a service_order record for tracking */
        const { data: svcOrder, error: svcError } = await admin.from('service_orders').insert([{
          user_id: userId,
          service_id: product.id,
          service_name: product.name,
          quantity: item.qty,
          price: unitPrice,
          cost_price: 0,
          total: itemTotal,
          status: 'pending',
          metadata: { source_order_id: orderId },
        }]).select('id').single();

        if (svcError || !svcOrder) {
          digitalForwardResults.push({ service: product.name, sent: false, error: svcError?.message });
          continue;
        }

        /* Forward to Serva-S */
        const { createProviderOrder } = await import('../_lib/providerApi.js');
        const providerResult = await createProviderOrder(env, {
          serviceId: product.provider_service_id,
          quantity: item.qty,
          link: null,
        });

        if (providerResult.success && providerResult.orderId) {
          await admin.from('service_orders')
            .update({ external_order_id: providerResult.orderId, status: 'processing' })
            .eq('id', svcOrder.id);
          digitalForwardResults.push({ service: product.name, sent: true, externalId: providerResult.orderId });
        } else {
          await admin.from('service_orders')
            .update({ metadata: { provider_error: providerResult.error, provider_attempted_at: new Date().toISOString(), source_order_id: orderId } })
            .eq('id', svcOrder.id);
          digitalForwardResults.push({ service: product.name, sent: false, error: providerResult.error });
        }
      } catch (fwdErr) {
        digitalForwardResults.push({ service: product.name, sent: false, error: fwdErr?.message });
      }
    }

    return successResponse({
      data: {
        order_id: orderId,
        total,
        items_count: orderItems.length,
        digital_forwarded: digitalForwardResults.filter(r => r.sent).length,
      },
    });

  } catch (err) {
    console.error('Checkout API error:', err);
    return errorResponse(`[CHK-500] حدث خطأ غير متوقع: ${err?.message || ''}`, 500);
  }
}
