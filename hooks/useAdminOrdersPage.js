'use client';

import { useEffect, useState } from 'react';
import { getVisibleAdminOrders } from '@/lib/adminOrdersModel';
import {
  fetchAdminOrdersSnapshot,
  updateAdminOrderStatus,
} from '@/services/adminOrdersService';

/**
 * Manages loading, filtering, and editing admin orders.
 *
 * @returns {{
 *   loading: boolean,
 *   error: string,
 *   activeTab: string,
 *   draftStatus: Record<string, string>,
 *   savingKey: string,
 *   visibleProductOrders: Array<Record<string, unknown>>,
 *   visibleDigitalOrders: Array<Record<string, unknown>>,
 *   setActiveTab: (value: string) => void,
 *   setDraftStatus: React.Dispatch<React.SetStateAction<Record<string, string>>>,
 *   saveStatus: (orderType: string, id: string, currentStatus: string) => Promise<void>,
 * }}
 */
export function useAdminOrdersPage() {
  const [data, setData] = useState({ productOrders: [], digitalOrders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [draftStatus, setDraftStatus] = useState({});
  const [savingKey, setSavingKey] = useState('');

  /**
   * Refreshes the admin orders snapshot from the API.
   *
   * @returns {Promise<void>}
   */
  async function loadOrders() {
    setLoading(true);
    setError('');

    try {
      const snapshot = await fetchAdminOrdersSnapshot();
      setData(snapshot);
    } catch (err) {
      setError(err.message || 'تعذر تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  /**
   * Persists the currently selected status for an order and reloads the list.
   *
   * @param {string} orderType
   * @param {string} id
   * @param {string} currentStatus
   * @returns {Promise<void>}
   */
  async function saveStatus(orderType, id, currentStatus) {
    const key = `${orderType}:${id}`;
    const nextStatus = draftStatus[key] || currentStatus;

    if (!nextStatus || nextStatus === currentStatus) {
      return;
    }

    setSavingKey(key);
    setError('');

    try {
      await updateAdminOrderStatus({ orderType, id, status: nextStatus });
      await loadOrders();
    } catch (err) {
      setError(err.message || 'تعذر تحديث الحالة.');
    } finally {
      setSavingKey('');
    }
  }

  const { visibleProductOrders, visibleDigitalOrders } = getVisibleAdminOrders({
    activeTab,
    productOrders: data.productOrders,
    digitalOrders: data.digitalOrders,
  });

  return {
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
  };
}
