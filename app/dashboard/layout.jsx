'use client';

import '../dashboard.css';
import { Outlet, useLocation } from 'react-router-dom';
import Link from 'next/link';

import DashboardShellSkeleton from '@/components/DashboardShellSkeleton';
import RouteErrorState from '@/components/RouteErrorState';
import useDashboardShell from './useDashboardShell';

/**
 * Renders the authenticated dashboard shell.
 *
 * @returns {JSX.Element}
 */
export default function DashboardLayout() {
  const { displayName, error, handleLogout, isReady, loading, navItems, retry, wallet } =
    useDashboardShell();
  const { pathname } = useLocation();

  if (loading) {
    return <DashboardShellSkeleton />;
  }

  if (error) {
    return (
      <RouteErrorState
        error={error}
        reset={retry}
        title="تعذر تأكيد جلسة تسجيل الدخول"
        description="انتهت مهلة التحقق من الجلسة أو تعذر تحديثها. يمكنك إعادة المحاولة أو العودة لتسجيل الدخول."
      />
    );
  }

  if (!isReady) {
    return <DashboardShellSkeleton />;
  }

  return (
    <section className="dashboard-shell">
      <div className="container">
        <div className="dashboard-hero">
          <div>
            <h1 className="dashboard-hero-title">Ù…Ø±Ø­Ø¨Ø§Ù‹ØŒ {displayName} ðŸ‘‹</h1>
            <p className="dashboard-hero-subtitle">
              Ø¥Ø¯Ø§Ø±Ø© Ø­Ø³Ø§Ø¨Ùƒ ÙˆØ·Ù„Ø¨Ø§ØªÙƒ ÙˆÙ‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ÙØ¶Ù„Ø© Ø¨ÙƒÙ„ Ø³Ù„Ø§Ø³Ø©.
            </p>
          </div>

          <div className="dashboard-hero-actions">
            <div className="dashboard-wallet-chip">
              <div className="dashboard-wallet-label">Ø±ØµÙŠØ¯Ùƒ</div>
              <div className="dashboard-wallet-value">
                {wallet ? Number(wallet.balance).toFixed(2) : '0.00'} <span>Ø¯.Ø£</span>
              </div>
            </div>

            <button onClick={handleLogout} className="btn btn-danger">
              ðŸšª Ø®Ø±ÙˆØ¬
            </button>
          </div>
        </div>

        <div className="dashboard-nav-tabs">
          {navItems.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dashboard-nav-tab ${active ? 'is-active' : ''}`}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span
                      style={{
                        minWidth: '22px',
                        height: '22px',
                        padding: '0 7px',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: active ? 'rgba(255,255,255,0.22)' : 'var(--primary)',
                        color: '#fff',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        lineHeight: 1,
                      }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="dashboard-content">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
