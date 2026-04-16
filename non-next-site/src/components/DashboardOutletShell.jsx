import { Outlet } from "react-router-dom";
import DashboardLayoutShell from "./DashboardLayoutShell.jsx";

/**
 * Wraps dashboard routes with the original customer dashboard layout.
 *
 * @returns {JSX.Element}
 */
export default function DashboardOutletShell() {
  return (
    <DashboardLayoutShell>
      <Outlet />
    </DashboardLayoutShell>
  );
}
