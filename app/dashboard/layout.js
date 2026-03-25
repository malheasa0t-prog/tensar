'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const BASE_NAV_ITEMS = [
  { href: '/dashboard', label: 'الملخص', icon: '📊' },
  { href: '/dashboard/orders', label: 'طلباتي', icon: '📦' },
  { href: '/dashboard/notifications', label: 'الإشعارات', icon: '🔔' },
  { href: '/dashboard/wallet', label: 'محفظتي', icon: '💰' },
  { href: '/dashboard/deposit', label: 'شحن الرصيد', icon: '💳' },
  { href: '/dashboard/profile', label: 'ملفي الشخصي', icon: '👤' },
];

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let notificationsInterval = null;

    async function loadUnreadNotificationsCount(userId) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (mounted) {
        setUnreadNotifications(Number(count || 0));
      }
    }

    async function init() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      setUser(currentUser);

      const [profileRes, walletRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', currentUser.id).single(),
        supabase.from('wallets').select('*').eq('user_id', currentUser.id).single(),
      ]);

      if (!mounted) return;

      setProfile(profileRes.data || null);
      setWallet(walletRes.data || null);
      setLoading(false);
      await loadUnreadNotificationsCount(currentUser.id);

      notificationsInterval = window.setInterval(() => {
        loadUnreadNotificationsCount(currentUser.id);
      }, 20000);
    }

    init();

    async function handleNotificationsUpdate() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        loadUnreadNotificationsCount(currentUser.id);
      }
    }

    window.addEventListener('tz-notifications-updated', handleNotificationsUpdate);

    return () => {
      mounted = false;
      if (notificationsInterval) {
        window.clearInterval(notificationsInterval);
      }
      window.removeEventListener('tz-notifications-updated', handleNotificationsUpdate);
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const fallbackUsername = user?.email ? user.email.split('@')[0] : 'مستخدم';
  const displayName = profile?.full_name?.trim() || fallbackUsername;
  const navSource = BASE_NAV_ITEMS;
  const navItems = navSource.map((item) =>
    item.href === '/dashboard/notifications'
      ? {
          ...item,
          badge: unreadNotifications > 99 ? '99+' : unreadNotifications || '',
        }
      : item
  );

  if (loading) {
    return (
      <section
        className="section"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⏳</div>
          <p>جاري التحميل...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-shell">
      <div className="container">
        <div className="dashboard-hero">
          <div>
            <h1 className="dashboard-hero-title">مرحبًا، {displayName} 👋</h1>
            <p className="dashboard-hero-subtitle">إدارة حسابك وطلباتك بكل سلاسة.</p>
          </div>

          <div className="dashboard-hero-actions">
            <div className="dashboard-wallet-chip">
              <div className="dashboard-wallet-label">رصيدك</div>
              <div className="dashboard-wallet-value">
                {wallet ? Number(wallet.balance).toFixed(2) : '0.00'} <span>د.أ</span>
              </div>
            </div>

            <button onClick={handleLogout} className="btn btn-danger">
              🚪 خروج
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
              <Link key={item.href} href={item.href} className={`dashboard-nav-tab ${active ? 'is-active' : ''}`}>
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

        <div className="dashboard-content">{children}</div>
      </div>
    </section>
  );
}
