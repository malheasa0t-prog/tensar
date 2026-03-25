import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest, getUserProfileByUserId } from '@/lib/serverAuth';

export const runtime = 'nodejs';

function validateProfileInput(body) {
  const errors = [];

  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const avatarUrl = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
  const preferredLanguage = typeof body.preferred_language === 'string' ? body.preferred_language.trim() : '';
  const preferredCurrency = typeof body.preferred_currency === 'string' ? body.preferred_currency.trim() : '';

  if (fullName && (fullName.length < 2 || fullName.length > 120)) {
    errors.push('الاسم يجب أن يكون بين حرفين و120 حرفاً');
  }

  if (phone && !/^[+0-9\s()-]{7,20}$/.test(phone)) {
    errors.push('رقم الهاتف غير صالح');
  }

  if (avatarUrl && avatarUrl.length > 2048) {
    errors.push('رابط الصورة طويل جداً');
  }

  if (country && country.length > 80) {
    errors.push('اسم الدولة طويل جداً');
  }

  if (bio && bio.length > 500) {
    errors.push('النبذة يجب ألا تتجاوز 500 حرف');
  }

  if (preferredLanguage && preferredLanguage.length > 12) {
    errors.push('قيمة اللغة غير صالحة');
  }

  if (preferredCurrency && preferredCurrency.length > 8) {
    errors.push('قيمة العملة غير صالحة');
  }

  return {
    errors,
    payload: {
      full_name: fullName || null,
      phone: phone || null,
      avatar_url: avatarUrl || null,
      country: country || null,
      bio: bio || null,
      preferred_language: preferredLanguage || 'ar',
      preferred_currency: preferredCurrency || 'JOD',
      updated_at: new Date().toISOString(),
    },
  };
}

export async function GET(request) {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { profile, error: profileError } = await getUserProfileByUserId(user.id);
  if (profileError) {
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      profile: profile || null,
    },
  });
}

export async function PATCH(request) {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { errors, payload } = validateProfileInput(body || {});

  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors[0] }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update(payload)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'تم تحديث الملف الشخصي بنجاح' });
}
