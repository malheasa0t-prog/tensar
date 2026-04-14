import { NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  AdminOrderStatusError,
  updateAdminOrderStatus,
} from '@/services/adminOrderStatusService';

export const runtime = 'nodejs';

/**
 * Updates physical or service-order statuses through a server-authorized mutation.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  const { user, errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    void error;
    return NextResponse.json({ success: false, error: 'بيانات الطلب غير صالحة.' }, { status: 400 });
  }

  try {
    const result = await updateAdminOrderStatus({
      client: supabaseAdmin,
      actor: { id: user?.id || '', email: user?.email || '' },
      payload: body,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AdminOrderStatusError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }

    console.error('Admin order status update failed:', error);
    return NextResponse.json({ success: false, error: 'تعذر تحديث حالة الطلب.' }, { status: 500 });
  }
}
