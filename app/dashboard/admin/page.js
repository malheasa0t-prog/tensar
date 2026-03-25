'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { adminFetch } from '@/lib/adminClient';

function money(value) {
  return `${Number(value || 0).toFixed(2)} د.أ`;
}

function dateText(value) {
  if (!value) return 'غير متاح';
  return new Date(value).toLocaleString('ar-JO');
}

function StatCard({ title, value, hint, color }) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '18px',
        padding: '18px',
        display: 'grid',
        gap: '8px',
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{title}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{hint}</div>
    </div>
  );
}

function EmptyPanel({ text }) {
  return (
    <div style={{ padding: '22px', color: 'var(--text-muted)', textAlign: 'center' }}>
      {text}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pathname = usePathname();
  const adminBase = pathname?.startsWith('/admin') ? '/admin' : '/dashboard/admin';

  async function loadOverview() {
    setLoading(true);
    setError('');
    try {
      const payload = await adminFetch('/api/admin/overview');
      setData(payload);
    } catch (err) {
      setError(err.message || 'تعذر تحميل لوحة الإدارة.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>جاري تحميل الملخص...</div>;
  }

  if (error) {
    return (
      <div
        style={{
          background: 'rgba(231,76,60,0.12)',
          border: '1px solid rgba(231,76,60,0.25)',
          borderRadius: '16px',
          padding: '18px',
          color: '#c0392b',
          textAlign: 'center',
        }}
      >
        {error}
      </div>
    );
  }

  const stats = data?.stats || {};
  const recent = data?.recent || {};

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '18px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ margin: 0, marginBottom: '6px' }}>ملخص التشغيل اليومي</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            متابعة سريعة للمتجر والطلبات الرقمية وحجوزات الصيانة من مكان واحد.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href={`${adminBase}/orders`} className="btn btn-outline btn-sm">إدارة الطلبات</Link>
          <Link href={`${adminBase}/products`} className="btn btn-outline btn-sm">المنتجات المنظّمة</Link>
          <Link href={`${adminBase}/repairs`} className="btn btn-outline btn-sm">إدارة الصيانة</Link>
        </div>
      </div>

      <section
        style={{
          background: 'linear-gradient(135deg, rgba(11,20,38,0.96), rgba(10,80,110,0.9))',
          border: '1px solid rgba(84, 196, 255, 0.18)',
          borderRadius: '18px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
        }}
      >
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.84rem', fontWeight: 700 }}>
            ????? ????? ?? ???? ????
          </div>
          <h3 style={{ margin: 0, color: '#fff' }}>????? ???????? ???????? ??????</h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.78)', maxWidth: '760px' }}>
            ?????? ?? ??? ??????? ?????? ???????? ???????? ???????? ??????? ??????? ????????? ????????? ??????? ?? ???? ????.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href={`${adminBase}/products`} className="btn btn-outline">
            ????? ???????? ????????
          </Link>
          <Link href={`${adminBase}/repairs`} className="btn btn-primary">
            ????? ???????
          </Link>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <StatCard
          title="المنتجات"
          value={stats.productsTotal || 0}
          hint={`منها ${stats.productsActive || 0} مفعلة`}
          color="#3498db"
        />
        <StatCard
          title="طلبات المتجر"
          value={stats.productOrdersTotal || 0}
          hint={`قيد المتابعة ${stats.productOrdersPending || 0}`}
          color="#e67e22"
        />
        <StatCard
          title="الطلبات الرقمية"
          value={stats.digitalOrdersTotal || 0}
          hint={`نشطة الآن ${stats.digitalOrdersActive || 0}`}
          color="#8e44ad"
        />
        <StatCard
          title="طلبات الصيانة"
          value={stats.repairsTotal || 0}
          hint={`المفتوحة ${stats.repairsOpen || 0}`}
          color="#16a085"
        />
        <StatCard
          title="المبيعات"
          value={money(stats.totalRevenue || 0)}
          hint={`المتجر ${money(stats.productRevenue || 0)} + الرقمي ${money(stats.digitalRevenue || 0)}`}
          color="#27ae60"
        />
        <StatCard
          title="المستخدمون"
          value={stats.usersTotal || 0}
          hint={`المدراء ${stats.adminsTotal || 0}`}
          color="#2c3e50"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
        <section
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
            أحدث طلبات المتجر
          </div>
          {(recent.productOrders || []).length === 0 ? (
            <EmptyPanel text="لا توجد طلبات متجر حديثة." />
          ) : (
            <div style={{ display: 'grid' }}>
              {recent.productOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    padding: '14px 18px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <strong>{order.customer_name || 'عميل'}</strong>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{money(order.total)}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    الحالة: {order.status || '-'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{dateText(order.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
            أحدث حجوزات الصيانة
          </div>
          {(recent.repairBookings || []).length === 0 ? (
            <EmptyPanel text="لا توجد حجوزات صيانة حديثة." />
          ) : (
            <div style={{ display: 'grid' }}>
              {recent.repairBookings.map((booking) => (
                <div
                  key={booking.id}
                  style={{
                    padding: '14px 18px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <strong>{booking.name || 'عميل'}</strong>
                    <span>{booking.status || 'pending'}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {booking.service_name || 'طلب صيانة'} {booking.device ? `• ${booking.device}` : ''}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{dateText(booking.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
            منتجات تحتاج متابعة
          </div>
          {(data?.lowStockProducts || []).length === 0 ? (
            <EmptyPanel text="لا توجد منتجات منخفضة المخزون حاليًا." />
          ) : (
            <div style={{ display: 'grid' }}>
              {data.lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  style={{
                    padding: '14px 18px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <strong>{product.name}</strong>
                    <span style={{ color: '#c0392b', fontWeight: 700 }}>{product.quantity || 0}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    حد التنبيه: {product.low_stock_alert || 0} • الحالة: {product.status || '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
