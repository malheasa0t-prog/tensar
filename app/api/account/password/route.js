import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest } from '@/lib/serverAuth';

export const runtime = 'nodejs';

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    return 'كلمة المرور يجب أن تحتوي على أحرف وأرقام';
  }

  return null;
}

export async function POST(request) {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const newPassword = body?.new_password;
  const confirmPassword = body?.confirm_password;

  const validationError = validatePassword(newPassword);
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ success: false, error: 'كلمتا المرور غير متطابقتين' }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    return NextResponse.json({ success: false, error: 'تعذر تغيير كلمة المرور' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
}
