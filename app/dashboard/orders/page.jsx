'use client';

import DashboardOrdersFilters from '@/components/dashboard-orders/DashboardOrdersFilters';
import DashboardOrdersOverview from '@/components/dashboard-orders/DashboardOrdersOverview';
import ProductOrdersSection from '@/components/dashboard-orders/ProductOrdersSection';
import RepairBookingsSection from '@/components/dashboard-orders/RepairBookingsSection';
import {
  alertStyle,
  pageGridStyle,
} from '@/components/dashboard-orders/dashboardOrdersStyles';
import { useDashboardOrders } from '@/hooks/useDashboardOrders';

/**
 * Composes the customer orders dashboard using extracted UI, hook, and service layers.
 *
 * @returns {JSX.Element}
 */
export default function OrdersPage() {
  const {
    productOrders,
    repairBookings,
    orderItemsMap,
    profile,
    activeFilter,
    loading,
    error,
    stats,
    setActiveFilter,
  } = useDashboardOrders();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        جاري التحميل...
      </div>
    );
  }

  return (
    <div style={pageGridStyle}>
      {error ? <div style={alertStyle}>{error}</div> : null}

      <DashboardOrdersOverview profile={profile} stats={stats} />
      <DashboardOrdersFilters activeFilter={activeFilter} onChange={setActiveFilter} />

      {activeFilter === 'all' || activeFilter === 'products' ? (
        <ProductOrdersSection orders={productOrders} orderItemsMap={orderItemsMap} />
      ) : null}

      {activeFilter === 'all' || activeFilter === 'repairs' ? (
        <RepairBookingsSection bookings={repairBookings} />
      ) : null}
    </div>
  );
}
