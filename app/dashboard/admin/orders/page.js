'use client';

import AdminDigitalOrdersSection from '@/components/admin-orders/AdminDigitalOrdersSection';
import AdminOrdersEmptyState from '@/components/admin-orders/AdminOrdersEmptyState';
import AdminOrdersHeader from '@/components/admin-orders/AdminOrdersHeader';
import AdminProductOrdersSection from '@/components/admin-orders/AdminProductOrdersSection';
import { useAdminOrdersPage } from '@/hooks/useAdminOrdersPage';

/**
 * Admin surface for monitoring and editing store and digital orders.
 *
 * @returns {JSX.Element}
 */
export default function AdminOrdersPage() {
  const {
    loading,
    error,
    activeTab,
    draftStatus,
    savingKey,
    visibleProductOrders,
    visibleDigitalOrders,
    setActiveTab,
    setDraftStatus,
    saveStatus,
  } = useAdminOrdersPage();

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <AdminOrdersHeader activeTab={activeTab} onChangeTab={setActiveTab} />

      {error ? (
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
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          جاري تحميل الطلبات...
        </div>
      ) : (
        <>
          <AdminProductOrdersSection
            orders={visibleProductOrders}
            draftStatus={draftStatus}
            savingKey={savingKey}
            onDraftChange={setDraftStatus}
            onSaveStatus={saveStatus}
          />

          <AdminDigitalOrdersSection
            orders={visibleDigitalOrders}
            draftStatus={draftStatus}
            savingKey={savingKey}
            onDraftChange={setDraftStatus}
            onSaveStatus={saveStatus}
          />

          {visibleProductOrders.length === 0 && visibleDigitalOrders.length === 0 ? (
            <AdminOrdersEmptyState />
          ) : null}
        </>
      )}
    </div>
  );
}
