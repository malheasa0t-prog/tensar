import NotificationCard from "@/components/dashboard-notifications/NotificationCard";
import DashboardNotificationsOverview from "@/components/dashboard-notifications/DashboardNotificationsOverview";
import NotificationEmptyState from "@/components/dashboard-notifications/NotificationEmptyState";
import { buildAlertStyle } from "@/components/dashboard-notifications/dashboardNotificationsStyles";
import { useDashboardNotifications } from "@/hooks/useDashboardNotifications";

/**
 * Renders the dashboard notifications route in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function DashboardNotificationsRoute() {
  const {
    loading,
    error,
    refreshing,
    bulkActionLoading,
    showUnreadOnly,
    visibleNotifications,
    busyIds,
    stats,
    setShowUnreadOnly,
    refreshNotifications,
    markAsRead,
    markAllAsRead
  } = useDashboardNotifications();

  if (loading) {
    return <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>جارٍ تحميل الإشعارات...</div>;
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      {error ? (
        <div
          style={{
            borderRadius: "14px",
            padding: "14px 16px",
            textAlign: "center",
            ...buildAlertStyle("error")
          }}
        >
          {error}
        </div>
      ) : null}

      <DashboardNotificationsOverview
        stats={stats}
        refreshing={refreshing}
        bulkActionLoading={bulkActionLoading}
        showUnreadOnly={showUnreadOnly}
        onRefresh={refreshNotifications}
        onMarkAllAsRead={markAllAsRead}
        onToggleUnreadOnly={setShowUnreadOnly}
      />

      {visibleNotifications.length === 0 ? (
        <NotificationEmptyState showUnreadOnly={showUnreadOnly} />
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {visibleNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              busy={!!busyIds[notification.id]}
              onMarkAsRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
