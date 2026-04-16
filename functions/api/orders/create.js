/**
 * Cloudflare Pages Function — Orders Create API.
 *
 * Handles POST /api/orders/create — creates digital service orders
 * with wallet deduction and optional provider API forwarding.
 */

import { createSupabaseAdmin, extractBearerToken, errorResponse, successResponse } from '../../_lib/supabase.js';

/* ─── Constants ─── */

const PROVIDER_API_URL = 'https://serva-s.com/api/v2/order';

/* ─── Utility Functions ─── */

/**
 * Validates a positive number.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function asPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Extracts auth token from header or body.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} body
 * @returns {string}
 */
function getAuthToken(request, body) {
  const token = extractBearerToken(request);
  return token || body?.user_token || '';
}

/**
 * Calls the Serva-S provider API to create an external order.
 *
 * @param {string} apiKey
 * @param {string} serviceId
 * @param {string | null} link
 * @param {number} quantity
 * @returns {Promise<{ success: boolean, orderId?: string, error?: string }>}
 */
async function createProviderOrder(apiKey, serviceId, link, quantity) {
  if (!apiKey) return { success: false, error: 'Provider API key not configured' };

  try {
    const params = new URLSearchParams({
      key: apiKey,
      action: 'add',
      service: serviceId,
      quantity: String(quantity),
    });
    if (link) params.set('link', link);

    const response = await fetch(`${PROVIDER_API_URL}?${params.toString()}`);
    const data = await response.json();

    if (data?.order) {
      return { success: true, orderId: String(data.order) };
    }
    return { success: false, error: data?.error || 'Unknown provider error' };
  } catch (err) {
    return { success: false, error: err.message || 'Provider request failed' };
  }
}

/* ─── Main Handler ─── */

/**
 * POST /api/orders/create — creates a digital service order.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { service_id, quantity, link } = body || {};
    const userToken = getAuthToken(request, body);

    const normalizedQty = asPositiveNumber(quantity);
    if (!service_id || !normalizedQty || !userToken) {
      return errorResponse('البيانات غير مكتملة: service_id, quantity, user_token مطلوبة', 400);
    }

    const admin = createSupabaseAdmin(env);

    /* ── Verify user session ── */
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser(userToken);
    if (authErr || !user) return errorResponse('غير مصرح — يجب تسجيل الدخول', 401);

    /* ── Check user status ── */
    const { data: profile } = await admin.from('user_profiles').select('status').eq('user_id', user.id).single();
    if (profile?.status === 'banned') return errorResponse('حسابك محظور. تواصل مع الإدارة.', 403);

    /* ── Fetch service ── */
    const { data: service, error: srvErr } = await admin.from('services').select('*').eq('id', service_id).single();
    if (srvErr || !service) return errorResponse('الخدمة غير موجودة', 404);
    if (service.status !== 'active') return errorResponse('هذه الخدمة غير متوفرة حالياً', 400);

    /* ── Validate quantity ── */
    if (normalizedQty < service.min_qty || normalizedQty > service.max_qty) {
      return errorResponse(`الكمية يجب أن تكون بين ${service.min_qty} و ${service.max_qty}`, 400);
    }

    /* ── Execute atomic order+wallet transaction ── */
    const { data: txResult, error: txError } = await admin.rpc('create_service_order_tx', {
      p_user_id: user.id,
      p_service_id: service_id,
      p_quantity: normalizedQty,
      p_link: link || null,
    });

    if (txError) {
      const msg = txError.message || 'تعذر إنشاء الطلب';
      if (msg.includes('Insufficient wallet balance')) return errorResponse('رصيدك غير كافٍ. يرجى شحن المحفظة أولاً.', 400);
      if (msg.includes('Service not found')) return errorResponse('الخدمة غير موجودة', 404);
      if (msg.includes('Service is not active')) return errorResponse('هذه الخدمة غير متوفرة حالياً', 400);
      if (msg.includes('Quantity out of range')) return errorResponse(`الكمية يجب أن تكون بين ${service.min_qty} و ${service.max_qty}`, 400);
      return errorResponse(msg, 400);
    }

    const txData = Array.isArray(txResult) ? txResult[0] : txResult;
    const orderId = txData?.order_id;
    const total = Number(txData?.total || 0);
    const newBalance = Number(txData?.new_balance || 0);

    if (!orderId) return errorResponse('فشل إنشاء الطلب', 500);

    /* ── Notify user ── */
    await admin.from('notifications').insert([{
      user_id: user.id,
      title: 'تم إنشاء طلبك بنجاح',
      body: `طلب ${service.name} بكمية ${normalizedQty} — المبلغ: ${total.toFixed(2)} د.أ`,
      type: 'success',
      reference_type: 'order',
      reference_id: orderId,
    }]);

    /* ── Forward to provider API ── */
    if (service.provider_service_id) {
      const providerApiKey = env.SERVAS_API_KEY || env.PROVIDER_API_KEY;
      const providerResult = await createProviderOrder(providerApiKey, service.provider_service_id, link || null, normalizedQty);

      if (providerResult.success && providerResult.orderId) {
        await admin.from('service_orders').update({ external_order_id: providerResult.orderId, status: 'processing' }).eq('id', orderId);
      } else {
        await admin.from('service_orders').update({
          metadata: { provider_error: providerResult.error, provider_attempted_at: new Date().toISOString() },
        }).eq('id', orderId);
      }
    }

    return successResponse({ order_id: orderId, total, new_balance: newBalance, message: 'تم إنشاء الطلب بنجاح!' }, 201);

  } catch (err) {
    console.error('Order creation error:', err);
    return errorResponse('حدث خطأ غير متوقع', 500);
  }
}
