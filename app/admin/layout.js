'use client';

import Link from 'next/link';
import { useAdminAccess } from '@/lib/useAdminAccess';

const ADMIN_NAV_ITEMS = [
  { href: '/admin', label: 'نظرة عامة', icon: '📊' },
  { href: '/admin/orders', label: 'الطلبات', icon: '📦' },
  { href: '/admin/products', label: 'المنتجات', icon: '🛍️' },
  { href: '/admin/repairs', label: 'الصيانة', icon: '🔧' },
  { href: '/admin/users', label: 'المستخدمون', icon: '👥' },
];

export default function AdminStandaloneLayout({ children }) {
  const { loading, allowed, adminName, pathname } = useAdminAccess();

  if (loading) {
    return (
      <section style={{ minHeight: '100vh', padding: '32px 0' }}>
        <div className="container" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          جاري تحميل لوحة التحكم...
        </div>
      </section>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <section style={{ minHeight: '100vh', padding: '20px 0 32px' }}>
      <div className="container" style={{ display: 'grid', gap: '18px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(11,20,38,0.97), rgba(10,80,110,0.92))',
            border: '1px solid rgba(84, 196, 255, 0.18)',
            borderRadius: '24px',
            padding: '22px 24px',
            display: 'grid',
            gap: '16px',
            boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                لوحة التحكم الرئيسية
              </div>
              <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#fff' }}>
                مرحبًا {adminName}
              </h1>
              <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.76)' }}>
                صفحة مستقلة لإدارة المتجر والصيانة والطلبات الرقمية داخل التطبيق نفسه.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link href="/dashboard" className="btn btn-outline btn-sm">
                الرجوع للحساب
              </Link>
              <Link href="/" className="btn btn-outline btn-sm">
                زيارة الموقع
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {ADMIN_NAV_ITEMS.map((item) => {
              const active =
                item.href === '/admin'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`dashboard-nav-tab ${active ? 'is-active' : ''}`}
                  style={{
                    background: active ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    borderColor: active ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <span>{item.icon}</span> {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}
