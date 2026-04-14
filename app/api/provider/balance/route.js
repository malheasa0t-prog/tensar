/**
 * Provider Balance API Route
 *
 * Protected endpoint to check Serva-S account balance.
 * Used by admin dashboard to monitor provider funds.
 */

import { NextResponse } from 'next/server';
import { getProviderBalance } from '@/lib/providerAPI';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

/**
 * Validates that the requesting user has admin privileges.
 *
 * @param {Request} request - Incoming HTTP request
 * @returns {Promise<{ authorized: boolean, error?: string, status?: number }>}
 */
async function validateAdminAccess(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    return { authorized: false, error: 'غير مصرح — يجب تسجيل الدخول', status: 401 };
  }

  const {
    data: { user },
    error: authErr,
  } = await supabaseServer.auth.getUser(token);

  if (authErr || !user) {
    return { authorized: false, error: 'غير مصرح — جلسة غير صالحة', status: 401 };
  }

  const adminEmail = user.email || '';
  const isAdmin =
    user.app_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'admin' ||
    adminEmail.endsWith('@techzone.com');

  if (!isAdmin) {
    return { authorized: false, error: 'صلاحيات غير كافية', status: 403 };
  }

  return { authorized: true };
}

/**
 * GET /api/provider/balance
 *
 * Returns Serva-S account balance for admin users.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function GET(request) {
  try {
    const access = await validateAdminAccess(request);
    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const result = await getProviderBalance();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      balance: result.balance,
      currency: result.currency,
    });
  } catch (err) {
    console.error('Provider balance error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء جلب الرصيد' },
      { status: 500 }
    );
  }
}
