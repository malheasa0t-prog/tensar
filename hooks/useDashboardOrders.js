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
 *   serviceOrders: Array<Record<string, unknown>>,
 *   repairBookings: Array<Record<string, unknown>>,
 *   orderItemsMap: Record<string, Array<Record<string, unknown>>>,
 *   profile: { full_name?: string, phone?: string } | null,
 *   activeFilter: string,
 *   loading: boolean,
 *   error: string,
 *   stats: { total: number, products: number, digital: number, repairs: number },
 *   setActiveFilter: (value: string) => void,
 * }}
 */
export function useDashboardOrders() {
  const [productOrders, setProductOrders] = useState([]);
  const [serviceOrders, setServiceOrders] = useState([]);
  const [repairBookings, setRepairBookings] = useState([]);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [profile, setProfile] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    /**
     * Refreshes the dashboard state from Supabase while guarding against stale updates.
     *
     * @returns {Promise<void>}
     */
    async function refreshDashboardOrders() {
      setLoading(true);
      setError('');

      const snapshot = await loadDashboardOrdersSnapshot();

      if (!isMounted) {
        return;
      }

      setProfile(snapshot.profile);
      setProductOrders(snapshot.productOrders);
      setServiceOrders(snapshot.serviceOrders);
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
        serviceOrders,
        repairBookings,
      }),
    [productOrders, repairBookings, serviceOrders]
  );

  return {
    productOrders,
    serviceOrders,
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
