'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/adminClient';

const REPAIR_STATUSES = ['pending', 'received', 'diagnosing', 'waiting_approval', 'in_progress', 'ready', 'completed', 'cancelled'];

function dateText(value) {
  if (!value) return 'غير متاح';
  return new Date(value).toLocaleString('ar-JO');
}

export default function AdminRepairsPage() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [draftStatus, setDraftStatus] = useState({});
  const [savingId, setSavingId] = useState('');

  async function loadRepairs() {
    setLoading(true);
    setError('');
    try {
      const payload = await adminFetch('/api/admin/repairs');
      setRepairs(payload?.repairs || []);
    } catch (err) {
      setError(err.message || 'تعذر تحميل حجوزات الصيانة.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRepairs();
  }, []);

  const visibleRepairs = useMemo(() => {
    if (filter === 'all') return repairs;
    if (filter === 'open') {
      return repairs.filter((item) => !['completed', 'cancelled'].includes(item.status));
    }
    return repairs.filter((item) => item.status === filter);
  }, [filter, repairs]);

  async function saveStatus(id, currentStatus) {
    const nextStatus = draftStatus[id] || currentStatus;
    if (!nextStatus || nextStatus === currentStatus) {
      return;
    }

    setSavingId(id);
    setError('');
    try {
      await adminFetch('/api/admin/repairs', {
        method: 'PATCH',
        body: JSON.stringify({ id, status: nextStatus }),
      });
      await loadRepairs();
    } catch (err) {
      setError(err.message || 'تعذر تحديث حالة الصيانة.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '18px',
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ margin: 0, marginBottom: '6px' }}>إدارة الصيانة</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            متابعة حالة أجهزة العملاء من الاستلام حتى الإنهاء.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'الكل' },
            { key: 'open', label: 'المفتوحة' },
            { key: 'completed', label: 'المكتملة' },
            { key: 'cancelled', label: 'الملغاة' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: filter === item.key ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                background: filter === item.key ? 'var(--primary)' : 'var(--card-bg)',
                color: filter === item.key ? '#fff' : 'var(--text-color)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(231,76,60,0.12)',
            border: '1px solid rgba(231,76,60,0.25)',
            borderRadius: '14px',
            padding: '14px 16px',
            color: '#c0392b',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>جاري تحميل الصيانة...</div>
      ) : visibleRepairs.length === 0 ? (
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '18px',
            padding: '28px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          لا توجد حجوزات صيانة في هذا القسم.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {visibleRepairs.map((booking) => {
            const currentStatus = draftStatus[booking.id] || booking.status;

            return (
              <div
                key={booking.id}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '18px',
                  padding: '18px',
                  display: 'grid',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{booking.name || 'عميل'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {booking.service_name || 'طلب صيانة'} {booking.device ? `• ${booking.device}` : ''}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                      {dateText(booking.created_at)}
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    {booking.phone || '-'} {booking.email ? `• ${booking.email}` : ''}
                  </div>
                </div>

                {booking.description && (
                  <div
                    style={{
                      background: 'var(--bg-lighter)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      color: 'var(--text-muted)',
                      fontSize: '0.92rem',
                    }}
                  >
                    {booking.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={currentStatus}
                    onChange={(e) => setDraftStatus((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                    style={{
                      minWidth: '220px',
                      padding: '11px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-lighter)',
                      color: 'var(--text-color)',
                    }}
                  >
                    {REPAIR_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => saveStatus(booking.id, booking.status)}
                    disabled={savingId === booking.id}
                    className="btn btn-primary btn-sm"
                  >
                    {savingId === booking.id ? 'جارٍ الحفظ...' : 'تحديث الحالة'}
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {booking.preferred_date ? `الموعد المناسب: ${booking.preferred_date} • ` : ''}الوضع: {booking.mode || '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
