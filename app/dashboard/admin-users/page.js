'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';

function money(value) {
  return `${Number(value || 0).toFixed(2)} د.أ`;
}

function fakeUsername(userId) {
  if (!userId) return 'مستخدم';
  return `مستخدم-${String(userId).replace(/-/g, '').slice(-6)}`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function loadUsers() {
    setLoading(true);
    setError('');

    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      setError('غير مصرح، سجل الدخول أولاً');
      return;
    }

    const res = await fetch('/api/admin/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();
    if (!res.ok || !json?.success) {
      setError(json?.error || 'تعذر تحميل المستخدمين');
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(json.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!ADMIN_PANEL_ENABLED) {
      setLoading(false);
      router.replace('/dashboard');
      return;
    }

    loadUsers();
  }, [router]);

  if (!ADMIN_PANEL_ENABLED) {
    return null;
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const fullName = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return fullName.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [users, search]);

  async function handleAdjustBalance(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    const token = await getAccessToken();
    if (!token) {
      setSubmitting(false);
      setError('انتهت الجلسة، سجل الدخول مرة أخرى');
      return;
    }

    const numAmount = Number(amount);
    if (!selectedUserId || !Number.isFinite(numAmount) || numAmount === 0 || !reason.trim()) {
      setSubmitting(false);
      setError('أدخل بيانات صحيحة: مستخدم + مبلغ (غير صفر) + سبب');
      return;
    }

    const res = await fetch('/api/admin/wallet-adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        target_user_id: selectedUserId,
        amount: numAmount,
        reason: reason.trim(),
      }),
    });

    const json = await res.json();
    setSubmitting(false);

    if (!res.ok || !json?.success) {
      setError(json?.error || 'فشل تعديل الرصيد');
      return;
    }

    setAmount('');
    setReason('');
    setMessage('تم تعديل الرصيد بنجاح');
    await loadUsers();
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '20px',
      }}>
        <h3 style={{ marginBottom: '12px', fontSize: '1.05rem' }}>🛠️ تعديل رصيد المستخدم</h3>
        {message && (
          <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: '10px', padding: '10px', marginBottom: '12px', color: '#2ecc71', textAlign: 'center', fontWeight: '600' }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '10px', padding: '10px', marginBottom: '12px', color: '#e74c3c', textAlign: 'center', fontWeight: '600' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAdjustBalance} style={{ display: 'grid', gap: '10px', gridTemplateColumns: '2fr 1fr 2fr auto' }}>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-color)' }}
            required
          >
            <option value="">اختر مستخدماً</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {(u.full_name || u.email || u.user_id)}
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="+10 أو -5"
            required
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-color)' }}
          />

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب التعديل"
            required
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-color)' }}
          />

          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ borderRadius: '10px', padding: '0 20px', fontWeight: '700' }}>
            {submitting ? '...' : 'تنفيذ'}
          </button>
        </form>
      </div>

      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '1.05rem' }}>👥 المستخدمون والأرصدة</h3>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم/الإيميل/الهاتف"
            style={{ minWidth: '280px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-color)' }}
          />
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>جاري التحميل...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>لا يوجد مستخدمون</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-lighter)' }}>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-muted)' }}>المستخدم</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>الدور</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>الحالة</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>الرصيد</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>إجمالي الشحن</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>إجمالي المصروف</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '700' }}>{(u.full_name && u.full_name.trim()) || fakeUsername(u.user_id)}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email || '-'}</div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{u.role || 'user'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{u.status || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--primary)' }}>{money(u.wallet?.balance)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{money(u.wallet?.total_deposited)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{money(u.wallet?.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
