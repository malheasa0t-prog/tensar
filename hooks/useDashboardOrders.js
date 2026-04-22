'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildDashboardOrdersStats } from '@/lib/dashboardOrdersModel';
import {
  loadDashboardOrdersSnapshot,
  subscribeToDashboardOrders,
} from '@/services/dashboardOrdersService';

/**
 * Manages loading, realtime refresh, filtering, and summary stats for dashboard orders.
 *
 * @returns {{
 *   productOrders: Array<Record<string, unknown>>,
 *   repairBookings: Array<Record<string, unknown>>,
 *   orderItemsMap: Record<string, Array<Record<string, unknown>>>,
 *   profile: { full_name?: string, phone?: string } | null,
 *   activeFilter: string,
 *   loading: boolean,
 *   error: string,
 *   stats: { total: number, products: number, repairs: number },
 *   setActiveFilter: (value: string) => void,
 * }}
 */
export function useDashboardOrders() {
  const [productOrders, setProductOrders] = useState([]);
  const [repairBookings, setRepairBookings] = useState([]);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [profile, setProfile] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function refreshDashboardOrders() {
      setLoading(true);
      setError('');

      const snapshot = await loadDashboardOrdersSnapshot();

      if (!isMounted) {
        return;
      }

      setProfile(snapshot.profile);
      setProductOrders(snapshot.productOrders);
      setRepairBookings(snapshot.repairBookings);
      setOrderItemsMap(snapshot.orderItemsMap);
      setError(snapshot.error);
      setLoading(false);
    }

    refreshDashboardOrders();

    const unsubscribe = subscribeToDashboardOrders(() => {
      refreshDashboardOrders();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const stats = useMemo(
    () =>
      buildDashboardOrdersStats({
        productOrders,
        repairBookings,
      }),
    [productOrders, repairBookings]
  );

  return {
    productOrders,
    repairBookings,
    orderItemsMap,
    profile,
    activeFilter,
    loading,
    error,
    stats,
    setActiveFilter,
  };
}
