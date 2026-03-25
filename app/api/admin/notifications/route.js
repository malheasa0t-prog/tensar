import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdminRequest } from '@/lib/serverAuth';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['info', 'success', 'warning', 'error']);
const EXCLUDED_ROLES = new Set(['admin', 'super_admin', 'employee', 'technician']);

function badRequest(message) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function normalizeText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function isCustomerProfile(profile) {
  const role = String(profile?.role || 'user').trim().toLowerCase();
  return !EXCLUDED_ROLES.has(role);
}

export async function POST(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { user, errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  let body;
  try {
    body = await request.json();
  } catch (_error) {
    return badRequest('تعذر قراءة بيانات الطلب');
  }

  const scope = normalizeText(body?.scope, 40);
  const title = normalizeText(body?.title, 120);
  const message = normalizeText(body?.body, 1000);
  const type = ALLOWED_TYPES.has(body?.type) ? body.type : 'info';
  const targetUserId = normalizeText(body?.userId, 80);

  if (!['all_customers', 'active_customers', 'specific_user'].includes(scope)) {
    return badRequest('نطاق الإرسال غير صالح');
  }

  if (!title || !message) {
    return badRequest('العنوان ونص الرسالة مطلوبان');
  }

  if (scope === 'specific_user' && !targetUserId) {
    return badRequest('اختر المستخدم الذي تريد إرسال الإشعار له');
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, full_name, phone, role, status')
    .order('created_at', { ascending: false });

  if (profilesError) {
    return NextResponse.json({ success: false, error: 'تعذر تحميل قائمة المستخدمين' }, { status: 500 });
  }

  const customers = (profiles || []).filter(isCustomerProfile);

  let recipients = customers;
  if (scope === 'active_customers') {
    recipients = customers.filter((profile) => (profile.status || 'active') === 'active');
  }
  if (scope === 'specific_user') {
    recipients = customers.filter((profile) => profile.user_id === targetUserId);
  }

  const userIds = Array.from(new Set(recipients.map((profile) => profile.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return badRequest('لا يوجد مستلمون مطابقون لهذا الاختيار');
  }

  const referenceId = `admin-${Date.now()}`;
  const payload = userIds.map((userId) => ({
    user_id: userId,
    title,
    body: message,
    type,
    reference_type: 'admin_broadcast',
    reference_id: referenceId,
  }));

  const { error: insertError } = await supabaseAdmin.from('notifications').insert(payload);
  if (insertError) {
    return NextResponse.json({ success: false, error: 'تعذر إرسال الإشعارات الآن' }, { status: 500 });
  }

  await supabaseAdmin.from('audit_logs').insert([
    {
      action: 'admin_notifications_broadcast',
      actor_id: user.id,
      details: `${title} (${userIds.length})`,
    },
  ]);

  return NextResponse.json({
    success: true,
    count: userIds.length,
    scope,
    type,
    message: 'تم إرسال الإشعار بنجاح',
  });
}
