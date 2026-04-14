import { NextResponse } from 'next/server';
import { createProviderOrder } from '@/lib/providerAPI';
import { supabaseAdmin, supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

function asPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function badRequest(message) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function getAuthToken(request, body) {
  const authHeader = request.headers.get('authorization') || '';
  const tokenFromHeader = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  return tokenFromHeader || body?.user_token || '';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { service_id, quantity, link } = body || {};
    const userToken = getAuthToken(request, body);

    const normalizedQuantity = asPositiveNumber(quantity);
    if (!service_id || !normalizedQuantity || !userToken) {
      return badRequest('البيانات غير مكتملة: service_id, quantity, user_token/Bearer token مطلوبة');
    }

    // 1. Verify user session
    const {
      data: { user },
      error: authErr,
    } = await supabaseServer.auth.getUser(userToken);

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح — يجب تسجيل الدخول' },
        { status: 401 }
      );
    }

    // 2. Check user profile status
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (profile?.status === 'banned') {
      return NextResponse.json(
        { success: false, error: 'حسابك محظور. تواصل مع الإدارة.' },
        { status: 403 }
      );
    }

    // 3. Fetch service details
    const { data: service, error: srvErr } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (srvErr || !service) {
      return NextResponse.json({ success: false, error: 'الخدمة غير موجودة' }, { status: 404 });
    }

    if (service.status !== 'active') {
      return badRequest('هذه الخدمة غير متوفرة حالياً');
    }

    // 4. Validate quantity
    if (normalizedQuantity < service.min_qty || normalizedQuantity > service.max_qty) {
      return badRequest(`الكمية يجب أن تكون بين ${service.min_qty} و ${service.max_qty}`);
    }

    // 5. Execute atomic order+wallet transaction in DB
    const { data: txResult, error: txError } = await supabaseAdmin.rpc('create_service_order_tx', {
      p_user_id: user.id,
      p_service_id: service_id,
      p_quantity: normalizedQuantity,
      p_link: link || null,
    });

    if (txError) {
      const msg = txError.message || 'تعذر إنشاء الطلب';
      if (msg.includes('Insufficient wallet balance')) {
        return badRequest('رصيدك غير كافٍ. يرجى شحن المحفظة أولاً.');
      }
      if (msg.includes('Service not found')) {
        return NextResponse.json({ success: false, error: 'الخدمة غير موجودة' }, { status: 404 });
      }
      if (msg.includes('Service is not active')) {
        return badRequest('هذه الخدمة غير متوفرة حالياً');
      }
      if (msg.includes('Quantity out of range')) {
        return badRequest(`الكمية يجب أن تكون بين ${service.min_qty} و ${service.max_qty}`);
      }
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const txData = Array.isArray(txResult) ? txResult[0] : txResult;
    const orderId = txData?.order_id;
    const total = Number(txData?.total || 0);
    const newBalance = Number(txData?.new_balance || 0);

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'فشل إنشاء الطلب' }, { status: 500 });
    }

    // 6. Create notification
    await supabaseAdmin.from('notifications').insert([
      {
        user_id: user.id,
        title: 'تم إنشاء طلبك بنجاح',
        body: `طلب ${service.name} بكمية ${normalizedQuantity} — المبلغ: ${total.toFixed(2)} د.أ`,
        type: 'success',
        reference_type: 'order',
        reference_id: orderId,
      },
    ]);

    // 7. Send to Serva-S provider API automatically
    if (service.provider_service_id) {
      try {
        const providerResult = await createProviderOrder(
          service.provider_service_id,
          link || null,
          normalizedQuantity
        );

        if (providerResult.success && providerResult.orderId) {
          await supabaseAdmin
            .from('service_orders')
            .update({
              external_order_id: providerResult.orderId,
              status: 'processing',
            })
            .eq('id', orderId);
        } else {
          console.error('Serva-S order failed:', providerResult.error);
          // تسجيل الخطأ لكن لا نفشل الطلب المحلي
          await supabaseAdmin
            .from('service_orders')
            .update({
              metadata: {
                provider_error: providerResult.error || 'Unknown provider error',
                provider_attempted_at: new Date().toISOString(),
              },
            })
            .eq('id', orderId);
        }
      } catch (providerError) {
        console.error('Serva-S provider exception:', providerError);
      }
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      total,
      new_balance: newBalance,
      message: 'تم إنشاء الطلب بنجاح!',
    }, { status: 201 });

  } catch (err) {
    console.error('Order creation error:', err);
    return NextResponse.json({ success: false, error: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
