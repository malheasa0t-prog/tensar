/**
 * Provider Services API Route
 *
 * Protected endpoint to fetch the Serva-S service catalog.
 * Used by admin dashboard to view available services and pricing.
 */

import { NextResponse } from 'next/server';
import { getProviderServices } from '@/lib/providerAPI';
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
 * GET /api/provider/services
 *
 * Returns the full Serva-S service catalog for admin users.
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

    const result = await getProviderServices();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 }
      );
    }

    const services = Array.isArray(result.services) ? result.services : [];

    return NextResponse.json({
      success: true,
      count: services.length,
      services,
    });
  } catch (err) {
    console.error('Provider services error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء جلب الخدمات' },
      { status: 500 }
    );
  }
}
