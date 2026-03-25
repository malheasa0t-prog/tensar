import { NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';

export const runtime = 'nodejs';

const REPAIR_STATUSES = ['pending', 'received', 'diagnosing', 'waiting_approval', 'in_progress', 'ready', 'completed', 'cancelled'];

export async function GET(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('repair_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ success: false, error: 'تعذر تحميل حجوزات الصيانة.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        repairs: data || [],
      },
    });
  } catch (error) {
    console.error('Admin repairs GET error:', error);
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
    const id = body?.id;
    const status = body?.status;

    if (!id || !REPAIR_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'بيانات الصيانة غير صالحة.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('repair_bookings')
      .update({ status })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: 'تعذر تحديث حالة الصيانة.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id, status } });
  } catch (error) {
    console.error('Admin repairs PATCH error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ غير متوقع.' }, { status: 500 });
  }
}
