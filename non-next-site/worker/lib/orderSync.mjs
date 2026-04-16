export const SYNCABLE_ORDER_STATUSES = Object.freeze(["processing", "in_progress", "pending"]);

/**
 * Maps one provider status into the internal order status.
 *
 * @param {unknown} providerStatus
 * @returns {string}
 */
export function mapProviderStatus(providerStatus) {
  const normalized = String(providerStatus || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const statusMap = {
    canceled: "cancelled",
    cancelled: "cancelled",
    completed: "completed",
    error: "failed",
    failed: "failed",
    in_progress: "in_progress",
    partial: "partial",
    pending: "processing",
    processing: "processing",
    refund: "refunded",
    refunded: "refunded"
  };

  return statusMap[normalized] || "processing";
}
