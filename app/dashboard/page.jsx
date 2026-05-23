'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { filterVisibleNotifications } from '@/lib/dashboardNotificationsModel';
import { formatDashboardOrderNumber } from '@/lib/dashboardOrdersModel';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';

/**
 * Loads the dashboard summary snapshot for the current user.
 *
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<{
 *   userId: string,
 *   recentOrders: Array<Record<string, unknown>>,
 *   notifications: Array<Record<string, unknown>>,
 * }>}
 */
async function fetchDashboardHomeSnapshot(client) {
  const supabase = client || await loadSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: '',
      recentOrders: [],
      notifications: [],
    };
  }

  const [ordersRes, notificationsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    userId: user.id,
    recentOrders: ordersRes.data || [],
    notifications: filterVisibleNotifications(notificationsRes.data || []).slice(0, 3),
  };
}

export default function DashboardHome() {
  const [recentOrders, setRecentOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let cleanupOrders = () => {};
    let cleanupNotifications = () => {};

    async function refreshSnapshot() {
      const supabase = await loadSupabaseClient();
      const snapshot = await fetchDashboardHomeSnapshot(supabase);

      if (!active) {
        return null;
      }

      setRecentOrders(snapshot.recentOrders);
      setNotifications(snapshot.notifications);
      setLoading(false);

      return snapshot;
    }

    async function initialize() {
      const supabase = await loadSupabaseClient();
      const snapshot = await refreshSnapshot();

      if (!active || !snapshot?.userId) {
        return;
      }

      const ordersChannel = supabase
        .channel(`dashboard-home-orders-${snapshot.userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${snapshot.userId}`,
          },
          () => {
            refreshSnapshot();
          }
        )
        .subscribe();

      const notificationsChannel = supabase
        .channel(`dashboard-home-notifications-${snapshot.userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${snapshot.userId}`,
          },
          () => {
            refreshSnapshot();
          }
        )
        .subscribe();

      cleanupOrders = () => {
        void supabase.removeChannel(ordersChannel);
      };

      cleanupNotifications = () => {
        void supabase.removeChannel(notificationsChannel);
      };
    }

    initialize();

    return () => {
      active = false;
      cleanupOrders();
      cleanupNotifications();
    };
  }, []);

  const STATUS_MAP = {
    pending: { label: 'انتظار', color: '#f39c12' },
    processing: { label: 'معالجة', color: '#3498db' },
    shipped: { label: 'شحن', color: '#2980b9' },
    delivered: { label: 'تم التسليم', color: '#2ecc71' },
    completed: { label: 'مكتمل', color: '#2ecc71' },
    failed: { label: 'فشل', color: '#e74c3c' },
    cancelled: { label: 'ملغي', color: '#95a5a6' },
  };

  const unreadNotifications = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="dash-home">
      <div className="dash-home-top">
        <div className="dash-sync-panel">
          <div className="dash-sync-title-row">
            <span className="dash-sync-dot" style={{ background: 'var(--tz-emerald)' }} />
            <h3>ملخص الطلبات</h3>
          </div>
          <p>
            لديك الآن <strong style={{ color: 'var(--tz-emerald)' }}>{recentOrders.length}</strong> طلبات حديثة
          </p>
          <div className="dash-sync-metrics">
            <div>
              <span>أحدث الطلبات</span>
              <strong>{recentOrders.length}</strong>
            </div>
            <div>
              <span>الإشعارات الجديدة</span>
              <strong>{unreadNotifications}</strong>
            </div>
          </div>
        </div>

        <div className="dash-quick-actions">
          <h3>إجراءات سريعة</h3>
          <div className="dash-actions-row">
            <Link href="/services" className="btn btn-secondary btn-lg">
              🛍️ تصفح المنتجات
            </Link>
            <Link href="/services" className="btn btn-warning btn-lg">
              🛠️ اطلب صيانة
            </Link>
          </div>
        </div>
      </div>

      <div className="dash-orders-card">
        <div className="dash-orders-head">
          <h3>آخر الإشعارات</h3>
          <Link href="/dashboard/notifications" className="dash-view-all">
            {unreadNotifications > 0 ? `${unreadNotifications} غير مقروءة ←` : 'فتح المركز ←'}
          </Link>
        </div>

        {notifications.length === 0 ? (
          <div className="dash-empty-orders">
            <div className="dash-empty-icon">📭</div>
            لا توجد إشعارات بعد
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  background: notification.is_read ? 'var(--bg-lighter)' : 'rgba(16,185,129,0.08)',
                  border: notification.is_read
                    ? '1px solid var(--border-color)'
                    : '1px solid rgba(16,185,129,0.24)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'grid',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <strong>{notification.title}</strong>
                  {!notification.is_read ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: 'rgba(16,185,129,0.16)',
                        color: 'var(--primary)',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                      }}
                    >
                      جديد
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: 0 }}>{notification.body || 'لا يوجد نص إضافي.'}</p>
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(notification.created_at).toLocaleString('ar-JO')}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-orders-card">
        <div className="dash-orders-head">
          <h3>آخر الطلبات</h3>
          <Link href="/dashboard/orders" className="dash-view-all">
            عرض الكل ←
          </Link>
        </div>

        {loading ? (
          <div className="dash-loading">جاري التحميل...</div>
        ) : recentOrders.length === 0 ? (
          <div className="dash-empty-orders">
            <div className="dash-empty-icon">📭</div>
            لا توجد طلبات بعد
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="dash-orders-table">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatDashboardOrderNumber(order)}</td>
                    <td className="dash-center dash-price">{Number(order.total || 0).toFixed(2)} د.أ</td>
                    <td className="dash-center">
                      <span
                        className="dash-status-pill"
                        style={{
                          background: `${STATUS_MAP[order.status]?.color || '#777'}22`,
                          color: STATUS_MAP[order.status]?.color || '#777',
                        }}
                      >
                        {STATUS_MAP[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="dash-center">{new Date(order.created_at).toLocaleDateString('ar-JO')}</td>
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
