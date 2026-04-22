"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { getProductsExplorerAvailability } from "@/lib/productsExplorerModel";
import { requestStockAlert } from "@/services/stockAlertService";

const LOGIN_REQUIRED_MESSAGE = "[SAL-201] سجل الدخول أولاً لتفعيل تنبيه التوفر.";
const STOCK_ALERT_REQUEST_ERROR = "[SAL-301] تعذر تفعيل تنبيه التوفر حالياً.";

/**
 * Manages the stock-alert state shown inside a product card.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {{
 *   isOutOfStock: boolean,
 *   stockAlertActive: boolean,
 *   stockAlertPending: boolean,
 *   handleRequestStockAlert: () => Promise<void>,
 * }}
 */
export function useProductCardStockAlert(product) {
  const { showToast } = useToast();
  const [stockAlertPending, setStockAlertPending] = useState(false);
  const [stockAlertActive, setStockAlertActive] = useState(false);
  const isOutOfStock = getProductsExplorerAvailability(product) === "out_of_stock";

  useEffect(() => {
    setStockAlertPending(false);
    setStockAlertActive(false);
  }, [product?.id]);

  const handleRequestStockAlert = useCallback(async () => {
    if (!isOutOfStock || stockAlertPending || stockAlertActive) {
      return;
    }

    setStockAlertPending(true);

    try {
      const result = await requestStockAlert({ productId: product?.id });
      setStockAlertActive(true);
      showToast(
        result.alreadySubscribed
          ? "تنبيه التوفر مفعّل مسبقاً لهذا المنتج."
          : `سنخبرك فور توفر ${result.productName || "هذا المنتج"} من جديد.`,
        { type: result.alreadySubscribed ? "info" : "success" }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : STOCK_ALERT_REQUEST_ERROR;
      showToast(message, {
        type: message === LOGIN_REQUIRED_MESSAGE ? "info" : "error",
      });
    } finally {
      setStockAlertPending(false);
    }
  }, [isOutOfStock, product?.id, showToast, stockAlertActive, stockAlertPending]);

  return {
    isOutOfStock,
    stockAlertActive,
    stockAlertPending,
    handleRequestStockAlert,
  };
}
