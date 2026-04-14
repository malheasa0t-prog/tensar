'use client';

import '../dashboard.css';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import DashboardShellSkeleton from '@/components/DashboardShellSkeleton';
import { useFavorites } from '@/components/FavoritesProvider';
import { supabase } from '@/lib/supabaseClient';

const BASE_NAV_ITEMS = [
  { href: '/dashboard', label: 'الملخص', icon: '📊' },
  { href: '/dashboard/orders', label: 'طلباتي', icon: '📦' },
  { href: '/dashboard/favorites', label: 'المفضلة', icon: '❤️' },
  { href: '/dashboard/notifications', label: 'الإشعارات', icon: '🔔' },
  { href: '/dashboard/wallet', label: 'محفظتي', icon: '💰' },
  { href: '/dashboard/deposit', label: 'شحن الرصيد', icon: '💳' },
  { href: '/dashboard/profile', label: 'ملفي الشخصي', icon: '👤' },
];

/**
 * Loads the unread notifications count for the current user.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function fetchUnreadNotificationsCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return Number(count || 0);
}

/**
 * Loads the current wallet snapshot for the active user.
 *
 * @param {string} userId
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function fetchWalletSnapshot(userId) {
  const response = await supabase.from('wallets').select('*').eq('user_id', userId).single();
  return response.data || null;
}

/**
 * Renders the authenticated dashboard shell.
 *
 * @param {{ children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
export default function DashboardLayout({ children }) {
  const { favoriteCount } = useFavorites();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let cleanupNotifications = () => {};
    let cleanupWallet = () => {};

    /**
     * Refreshes the wallet chip and unread notifications count.
     *
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async function refreshLiveStats(userId) {
      const [nextUnreadCount, nextWallet] = await Promise.all([
        fetchUnreadNotificationsCount(userId),
        fetchWalletSnapshot(userId),
      ]);

      if (!mounted) {
        return;
      }

      setUnreadNotifications(nextUnreadCount);
      setWallet(nextWallet);
    }

    /**
     * Boots the dashboard shell and binds realtime listeners.
     *
     * @returns {Promise<void>}
     */
    async function init() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      setUser(currentUser);

      const profileResponse = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (!mounted) {
        return;
      }

      setProfile(profileResponse.data || null);
      await refreshLiveStats(currentUser.id);

      if (!mounted) {
        return;
      }

      setLoading(false);

      const notificationsChannel = supabase
        .channel(`dashboard-layout-notifications-${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`,
          },
          () => {
            refreshLiveStats(currentUser.id);
          }
        )
        .subscribe();

      const walletChannel = supabase
        .channel(`dashboard-layout-wallet-${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallets',
            filter: `user_id=eq.${currentUser.id}`,
          },
          () => {
            refreshLiveStats(currentUser.id);
          }
        )
        .subscribe();

      cleanupNotifications = () => {
        supabase.removeChannel(notificationsChannel);
      };

      cleanupWallet = () => {
        supabase.removeChannel(walletChannel);
      };
    }

    void init();

    /**
     * Keeps the shell in sync after local notification mutations.
     *
     * @returns {Promise<void>}
     */
    async function handleNotificationsUpdate() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        await refreshLiveStats(currentUser.id);
      }
    }

    window.addEventListener('tz-notifications-updated', handleNotificationsUpdate);

    return () => {
      mounted = false;
      cleanupNotifications();
      cleanupWallet();
      window.removeEventListener('tz-notifications-updated', handleNotificationsUpdate);
    };
  }, [router]);

  /**
   * Signs out the active user and returns to the homepage.
   *
   * @returns {Promise<void>}
   */
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const fallbackUsername = user?.email ? user.email.split('@')[0] : 'مستخدم';
  const displayName = profile?.full_name?.trim() || fallbackUsername;
  const navItems = BASE_NAV_ITEMS.map((item) => {
    if (item.href === '/dashboard/notifications') {
      return {
        ...item,
        badge: unreadNotifications > 99 ? '99+' : unreadNotifications || '',
      };
    }

    if (item.href === '/dashboard/favorites') {
      return {
        ...item,
        badge: favoriteCount > 99 ? '99+' : favoriteCount || '',
      };
    }

    return item;
  });

  if (loading) {
    return <DashboardShellSkeleton />;
  }

  return (
    <section className="dashboard-shell">
      <div className="container">
        <div className="dashboard-hero">
          <div>
            <h1 className="dashboard-hero-title">مرحباً، {displayName} 👋</h1>
            <p className="dashboard-hero-subtitle">إدارة حسابك وطلباتك وقائمة المفضلة بكل سلاسة.</p>
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
