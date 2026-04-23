/**
 * Cloudflare Pages Function — Checkout API.
 *
 * Handles POST /api/checkout — creates physical product orders.
 */

import { createSupabaseAdmin, extractBearerToken, errorResponse, successResponse } from '../_lib/supabase.js';
import { createProviderOrder } from '../_lib/providerApi.js';

const BANNED_ACCOUNT_MESSAGE = 'حسابك محظور. تواصل مع الإدارة.';

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
 * @returns {string | null}
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
  const found = (methods || []).find((entry) => entry.value === method);
  return Number(found?.fee) || 0;
}

/**
 * Builds a normalized order item snapshot.
 *
 * @param {Record<string, unknown>} product
 * @param {number} qty
 * @returns {{ price: number, row: Record<string, unknown> }}
 */
function buildOrderItem(product, qty) {
  const unitPrice = Number(product.discount_price || product.price || 0);

  return {
    price: unitPrice,
    row: {
      product_id: product.id,
      product_name: product.name,
      qty,
      price: unitPrice,
      snapshot: {
        category_id: product.category_id || null,
        product_type: product.product_type || 'physical',
        brand: product.brand || null,
        image: Array.isArray(product.images) ? product.images[0] || null : null,
        provider_service_id: product.provider_service_id || null,
      },
    },
  };
}

/**
 * Resolves the authenticated user when a bearer token is present.
 *
 * @param {{ admin: import('@supabase/supabase-js').SupabaseClient, env: Record<string, string>, request: Request }} input
 * @returns {Promise<string | null>}
 */
async function resolveCheckoutUserId({ admin, env, request }) {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  const { createClient } = await import('@supabase/supabase-js');
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser(token);

  if (!user) {
    return null;
  }

  const { data: profile } = await admin.from('user_profiles').select('status').eq('user_id', user.id).single();
  if (profile?.status === 'banned') {
    throw new Error(`[CHK-104] ${BANNED_ACCOUNT_MESSAGE}`);
  }

  return user.id;
}

/**
 * POST /api/checkout — creates a product order.
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
    const customerContactLink = normalizeText(body?.customer_contact_link);
    const notes = normalizeText(body?.notes);
    const deliveryMethod = normalizeText(body?.delivery_method) || 'delivery';
    const paymentMethod = normalizeText(body?.payment_method) || 'cod';

    const customerError = validateCustomer({ name: customerName, phone: customerPhone });
    if (customerError) return errorResponse(customerError, 400);

    const items = normalizeItems(body?.items);
    if (items.length === 0) return errorResponse('[CHK-103] بيانات السلة غير صالحة', 400);

    const admin = createSupabaseAdmin(env);
    const userId = await resolveCheckoutUserId({ admin, env, request });

    const serviceIds = items.filter((item) => item.id.startsWith('srv-')).map((item) => item.id);
    const physicalIds = items.filter((item) => !item.id.startsWith('srv-')).map((item) => item.id);

    if (serviceIds.length > 0 && !customerContactLink && !customerPhone) {
      return errorResponse('[CHK-112] رقم الواتساب أو وسيلة التواصل مطلوبة للخدمات الرقمية', 400);
    }

    const [productsResult, servicesResult] = await Promise.all([
      physicalIds.length > 0
        ? admin
            .from('products')
            .select('id,name,price,discount_price,quantity,sold,status,category_id,product_type,brand,images')
            .in('id', physicalIds)
            .eq('status', 'active')
            .or('product_type.is.null,product_type.eq.physical')
        : { data: [], error: null },
      serviceIds.length > 0
        ? admin
            .from('services')
            .select('id,name,price,min_qty,max_qty,image,category_id,status,provider_service_id,metadata')
            .in('id', serviceIds)
            .eq('status', 'active')
        : { data: [], error: null },
    ]);

    if (productsResult.error) return errorResponse('[CHK-105] تعذر تحميل بيانات المنتجات', 500);
    if (servicesResult.error) return errorResponse('[CHK-105] تعذر تحميل بيانات الخدمات', 500);

    const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));

    for (const service of (servicesResult.data || [])) {
      const serviceMetadata = service.metadata || {};
      const providerFields = Array.isArray(serviceMetadata.provider_fields) ? serviceMetadata.provider_fields : [];

      productMap.set(service.id, {
        id: service.id,
        name: service.name,
        price: Number(service.price),
        discount_price: null,
        quantity: service.max_qty || 9999,
        sold: 0,
        status: service.status,
        category_id: service.category_id,
        product_type: 'digital',
        brand: null,
        images: service.image ? [service.image] : [],
        provider_service_id: service.provider_service_id,
        link_required: Boolean(serviceMetadata.link_required),
        provider_fields: providerFields,
      });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) return errorResponse(`[CHK-106] المنتج غير متاح: ${item.id}`, 400);
      if (product.quantity < item.qty) {
        return errorResponse(`[CHK-107] الكمية المطلوبة (${item.qty}) تتجاوز المتوفر (${product.quantity}) — ${product.name}`, 400);
      }

      const normalizedItem = buildOrderItem(product, item.qty);
      subtotal += normalizedItem.price * item.qty;
      orderItems.push(normalizedItem.row);
    }

    const { data: settingsRow } = await admin.from('settings').select('data').limit(1).maybeSingle();
    const settingsData = settingsRow?.data || {};
    const deliveryMethods = Array.isArray(settingsData.deliveryMethods)
      ? settingsData.deliveryMethods
      : [{ value: 'delivery', label: 'توصيل', fee: 2 }, { value: 'pickup', label: 'استلام', fee: 0 }];

    if (!deliveryMethods.some((entry) => entry.value === deliveryMethod)) {
      return errorResponse('[CHK-108] طريقة التسليم غير صالحة', 400);
    }

    const shippingFee = getShippingFee(deliveryMethod, deliveryMethods);
    const total = subtotal + shippingFee;

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
      console.error('[CHK-109] Order insert error:', JSON.stringify(orderError));
      return errorResponse(`[CHK-109] تعذر إنشاء الطلب: ${orderError?.message || 'خطأ غير معروف'}`, 500);
    }

    const orderId = orderRow.id;
    const { error: itemsError } = await admin.from('order_items').insert(
      orderItems.map((item) => ({ order_id: orderId, ...item }))
    );

    if (itemsError) {
      console.error('[CHK-110] Order items insert error:', JSON.stringify(itemsError));
      await admin.from('orders').delete().eq('id', orderId);
      return errorResponse(`[CHK-110] تعذر حفظ عناصر الطلب: ${itemsError?.message || 'خطأ غير معروف'}`, 500);
    }

    for (const item of items) {
      const product = productMap.get(item.id);
      if (!product) continue;

      if (!item.id.startsWith('srv-')) {
        await admin
          .from('products')
          .update({
            quantity: Math.max(0, product.quantity - item.qty),
            sold: (product.sold || 0) + item.qty,
          })
          .eq('id', item.id);
      } else if (product.provider_service_id) {
        const providerLink = customerContactLink || customerPhone;
        const providerFieldDefs = Array.isArray(product.provider_fields) ? product.provider_fields : [];

        const dynamicFields = {};
        for (const fieldDef of providerFieldDefs) {
          const fieldKey = fieldDef.key || fieldDef.label || '';
          if (!fieldKey) continue;
          dynamicFields[fieldKey] = providerLink;
        }

        const providerResult = await createProviderOrder(env, {
          serviceId: product.provider_service_id,
          quantity: item.qty,
          link: providerLink,
          fields: Object.keys(dynamicFields).length > 0 ? dynamicFields : null,
        });

        const snapshotUpdate = providerResult.success && providerResult.orderId
          ? { provider_order_id: providerResult.orderId, provider_status: 'processing' }
          : { provider_error: providerResult.error, provider_attempted_at: new Date().toISOString() };

        const { data: currentItem } = await admin
          .from('order_items')
          .select('id, snapshot')
          .eq('order_id', orderId)
          .eq('product_id', item.id)
          .limit(1)
          .maybeSingle();

        if (currentItem) {
          await admin
            .from('order_items')
            .update({
              snapshot: { ...(currentItem.snapshot || {}), ...snapshotUpdate }
            })
            .eq('id', currentItem.id);
        }
      }
    }

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
      data: {
        order_id: orderId,
        total,
        items_count: orderItems.length,
      },
    });
  } catch (err) {
    const errorMessage = String(err?.message || '').trim();
    console.error('[CHK-500] Checkout API error:', err);
    if (errorMessage.startsWith('[CHK-104]')) {
      return errorResponse(errorMessage, 403);
    }
    return errorResponse(`[CHK-500] حدث خطأ غير متوقع: ${errorMessage}`, 500);
  }
}
