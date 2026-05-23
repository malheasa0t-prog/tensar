"use client";

/**
 * MaintenanceGate — Blocks non-admin visitors when maintenance mode is active.
 *
 * Reads the `maintenanceMode` flag from siteSettings. If active and the user
 * is not an admin, renders a full-screen maintenance page instead of children.
 */

import { useSiteRuntime } from "@/components/SiteRuntimeProvider";

const ADMIN_PANEL_PATH = "/__tz-panel";

/**
 * Checks if the current user has admin privileges.
 *
 * @param {Record<string, unknown> | null} user
 * @returns {boolean}
 */
function isAdminUser(user) {
  if (!user) return false;
  const role = user.user_metadata?.role || user.app_metadata?.role || "";
  return role === "admin" || role === "super_admin";
}

/**
 * Renders the maintenance page shown to non-admin visitors.
 *
 * @param {{ storeName: string }} props
 * @returns {JSX.Element}
 */
function MaintenancePage({ storeName }) {
  return (
    <div className="maintenance-page">
      <div className="maintenance-card">
        <div className="maintenance-icon-wrap">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h1>الموقع تحت الصيانة</h1>
        <p>
          نعمل حالياً على تحسين <strong>{storeName}</strong> لتقديم تجربة أفضل لك.
          <br />
          سنعود قريباً — شكراً لصبرك!
        </p>
        <div className="maintenance-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps children and shows a maintenance page when maintenance mode is active.
 *
 * @param {{ children: import("react").ReactNode }} props
 * @returns {JSX.Element}
 */
export default function MaintenanceGate({ children }) {
  const { siteSettings, user, authLoading } = useSiteRuntime();

  const isMaintenanceActive =
    siteSettings?.raw?.maintenanceMode === true;

  if (!isMaintenanceActive) {
    return <>{children}</>;
  }

  if (typeof window !== "undefined" && window.location.pathname.startsWith(ADMIN_PANEL_PATH)) {
    return <>{children}</>;
  }

  if (authLoading) {
    return null;
  }

  if (isAdminUser(user)) {
    return <>{children}</>;
  }

  const storeName = siteSettings?.company?.name || "TechZone";
  return <MaintenancePage storeName={storeName} />;
}
