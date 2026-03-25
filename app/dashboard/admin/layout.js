'use client';

import Link from 'next/link';
import { useAdminAccess } from '@/lib/useAdminAccess';

const ADMIN_NAV_ITEMS = [
  { href: '/dashboard/admin', label: 'نظرة عامة', icon: '📊' },
  { href: '/dashboard/admin/orders', label: 'الطلبات', icon: '📦' },
  { href: '/dashboard/admin/products', label: 'المنتجات', icon: '🛍️' },
  { href: '/dashboard/admin/repairs', label: 'الصيانة', icon: '🔧' },
  { href: '/dashboard/admin/users', label: 'المستخدمون', icon: '👥' },
];

export default function AdminLayout({ children }) {
  const { loading, allowed, adminName, pathname } = useAdminAccess();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        جاري تحميل لوحة الإدارة...
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '20px 24px',
          display: 'grid',
          gap: '14px',
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
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              لوحة إدارة حديثة
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem' }}>
              أهلاً {adminName}، جميع عمليات المتجر أصبحت داخل التطبيق نفسه
            </h2>
          </div>
          <div
            style={{
              background: 'rgba(52,152,219,0.12)',
              border: '1px solid rgba(52,152,219,0.2)',
              borderRadius: '14px',
              padding: '12px 14px',
              color: '#2471a3',
              fontSize: '0.9rem',
            }}
          >
            هذه اللوحة تعتمد على Next.js وواجهات API مباشرة بدل الاعتماد على النسخة القديمة.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {ADMIN_NAV_ITEMS.map((item) => {
            const active =
              item.href === '/dashboard/admin'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dashboard-nav-tab ${active ? 'is-active' : ''}`}
              >
                <span>{item.icon}</span> {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
