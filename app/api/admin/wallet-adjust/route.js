import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest, isAdminUser } from '@/lib/serverAuth';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isAdminUser(user.id);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const targetUserId = body?.target_user_id;
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  if (!targetUserId) {
    return NextResponse.json({ success: false, error: 'target_user_id is required' }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ success: false, error: 'amount must be a non-zero number' }, { status: 400 });
  }

  if (!reason || reason.length < 3) {
    return NextResponse.json({ success: false, error: 'reason is required (at least 3 chars)' }, { status: 400 });
  }

  const { data, error: rpcError } = await supabaseAdmin.rpc('admin_adjust_wallet_balance', {
    p_admin_user_id: user.id,
    p_target_user_id: targetUserId,
    p_amount: amount,
    p_reason: reason,
  });

  if (rpcError) {
    return NextResponse.json({ success: false, error: rpcError.message || 'Adjustment failed' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}
