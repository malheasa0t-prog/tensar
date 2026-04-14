import { NextResponse } from 'next/server';
import {
  INVALID_CURRENT_PASSWORD_MESSAGE,
  validatePasswordChangeForm,
} from '@/lib/profilePasswordModel';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * Reads and validates the password change request body.
 *
 * @param {Request} request
 * @returns {Promise<{ currentPassword: string, newPassword: string, errorResponse: NextResponse | null }>}
 */
async function getPasswordChangePayload(request) {
  let body = null;

  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        currentPassword: '',
        newPassword: '',
        errorResponse: NextResponse.json({ success: false, error: 'بيانات الطلب غير صالحة' }, { status: 400 }),
      };
    }

    throw error;
  }

  const validationError = validatePasswordChangeForm(body);
  if (validationError) {
    return {
      currentPassword: '',
      newPassword: '',
      errorResponse: NextResponse.json({ success: false, error: validationError }, { status: 400 }),
    };
  }

  return {
    currentPassword: body.current_password,
    newPassword: body.new_password,
    errorResponse: null,
  };
}

/**
 * Confirms that the submitted current password matches the signed-in user.
 *
 * @param {{ email?: string | null }} user
 * @param {string} currentPassword
 * @returns {Promise<NextResponse | null>}
 */
async function verifyCurrentPassword(user, currentPassword) {
  if (!user?.email) {
    return NextResponse.json({ success: false, error: 'تعذر التحقق من الحساب الحالي' }, { status: 400 });
  }

  const supabaseAuthClient = createSupabaseServerClient();
  const { error } = await supabaseAuthClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (!error) {
    return null;
  }

  if (Number(error.status) === 400) {
    return NextResponse.json({ success: false, error: INVALID_CURRENT_PASSWORD_MESSAGE }, { status: 400 });
  }

  return NextResponse.json({ success: false, error: 'تعذر التحقق من كلمة المرور الحالية' }, { status: 500 });
}

/**
 * Changes the authenticated user's password after verifying the current password.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await getPasswordChangePayload(request);
  if (payload.errorResponse) {
    return payload.errorResponse;
  }

  const verifyResponse = await verifyCurrentPassword(user, payload.currentPassword);
  if (verifyResponse) {
    return verifyResponse;
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: payload.newPassword,
  });

  if (updateError) {
    return NextResponse.json({ success: false, error: 'تعذر تغيير كلمة المرور' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
}
