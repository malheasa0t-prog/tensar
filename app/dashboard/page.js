'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardHome() {
  const [recentOrders, setRecentOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncMeta, setSyncMeta] = useState({ active: 0, lastUpdate: null });

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [ordersRes, notificationsRes] = await Promise.all([
        supabase
          .from('service_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const orders = ordersRes.data || [];
      const recentNotifications = notificationsRes.data || [];

      const activeSyncOrders = orders.filter((order) =>
        order.external_order_id && ['pending', 'processing', 'in_progress', 'partial'].includes(order.status)
      );

      const latestOrderTs =
        orders
          .map((order) => order.updated_at || order.created_at)
          .filter(Boolean)
          .map((timestamp) => new Date(timestamp).getTime())
          .filter(Boolean)
          .sort((a, b) => b - a)[0] || null;

      setRecentOrders(orders.slice(0, 5));
      setNotifications(recentNotifications);
      setSyncMeta({
        active: activeSyncOrders.length,
        lastUpdate: latestOrderTs,
      });
      setLoading(false);
    }

    load();
  }, []);

  const STATUS_MAP = {
    pending: { label: 'انتظار', color: '#f39c12' },
    processing: { label: 'معالجة', color: '#3498db' },
    in_progress: { label: 'تنفيذ', color: '#9b59b6' },
    completed: { label: 'مكتمل', color: '#2ecc71' },
    failed: { label: 'فشل', color: '#e74c3c' },
    refunded: { label: 'مسترجع', color: '#1abc9c' },
    cancelled: { label: 'ملغي', color: '#95a5a6' },
    partial: { label: 'جزئي', color: '#e67e22' },
  };

  const syncHealth = syncMeta.active > 0 ? 'جارية' : 'مستقرة';
  const syncTone = syncMeta.active > 0 ? 'var(--tz-amber)' : 'var(--tz-emerald)';
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="dash-home">
      <div className="dash-home-top">
        <div className="dash-sync-panel">
          <div className="dash-sync-title-row">
            <span className="dash-sync-dot" style={{ background: syncTone }} />
            <h3>حالة المزامنة</h3>
          </div>
          <p>
            الحالة الآن: <strong style={{ color: syncTone }}>{syncHealth}</strong>
          </p>
          <div className="dash-sync-metrics">
            <div>
              <span>طلبات قيد المتابعة</span>
              <strong>{syncMeta.active}</strong>
            </div>
            <div>
              <span>آخر تحديث</span>
              <strong>
                {syncMeta.lastUpdate ? new Date(syncMeta.lastUpdate).toLocaleString('ar-JO') : 'لا يوجد'}
              </strong>
            </div>
          </div>
        </div>

        <div className="dash-quick-actions">
          <h3>إجراءات سريعة</h3>
          <div className="dash-actions-row">
            <Link href="/services" className="btn btn-secondary btn-lg">
              ⚡ طلب خدمة جديدة
            </Link>
            <Link href="/dashboard/deposit" className="btn btn-warning btn-lg">
              💳 شحن الرصيد
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
                  <th>الخدمة</th>
                  <th>الكمية</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.service_name}</td>
                    <td className="dash-center">{order.quantity}</td>
                    <td className="dash-center dash-price">{Number(order.total).toFixed(2)} د.أ</td>
                    <td className="dash-center">
                      <span
                        className="dash-status-pill"
                        style={{
                          background: `${STATUS_MAP[order.status]?.color}22`,
                          color: STATUS_MAP[order.status]?.color || '#666',
                        }}
                      >
                        {STATUS_MAP[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="dash-center dash-date">
                      {new Date(order.created_at).toLocaleDateString('ar-JO')}
                    </td>
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
