"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";

function getUnreadLabel(count) {
  if (count <= 0) return "لا توجد إشعارات جديدة";
  if (count === 1) return "لديك إشعار جديد";
  if (count === 2) return "لديك إشعاران جديدان";
  if (count <= 10) return `لديك ${count} إشعارات جديدة`;
  return `لديك ${count} إشعارًا جديدًا`;
}

export default function HomeNotificationBell() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let refreshInterval = null;
    let unsubscribe = () => {};

    async function loadUnreadCount(userId) {
      const supabase = await loadSupabaseClient();

      if (!userId) {
        if (mounted) setUnreadCount(0);
        return;
      }

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (mounted) {
        setUnreadCount(Number(count || 0));
      }
    }

    async function init() {
      const supabase = await loadSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setIsAuthenticated(false);
        setUnreadCount(0);
        setAuthLoading(false);
        return;
      }

      setIsAuthenticated(true);
      setAuthLoading(false);
      await loadUnreadCount(user.id);

      refreshInterval = window.setInterval(() => {
        loadUnreadCount(user.id);
      }, 20000);
    }

    init();

    /**
     * Attaches the auth listener after Supabase is available.
     *
     * @returns {Promise<void>}
     */
    async function attachAuthListener() {
      const supabase = await loadSupabaseClient();

      if (!mounted) {
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const sessionUser = session?.user || null;

        if (!sessionUser) {
          if (mounted) {
            setIsAuthenticated(false);
            setUnreadCount(0);
            setAuthLoading(false);
          }
          return;
        }

        if (mounted) {
          setIsAuthenticated(true);
          setAuthLoading(false);
        }

        await loadUnreadCount(sessionUser.id);
      });

      unsubscribe = () => subscription.unsubscribe();
    }

    void attachAuthListener();

    function handleNotificationsUpdated() {
      loadSupabaseClient().then((supabase) => supabase.auth.getUser()).then(({ data }) => {
        const currentUser = data?.user;
        if (currentUser) {
          loadUnreadCount(currentUser.id);
        }
      });
    }

    window.addEventListener("tz-notifications-updated", handleNotificationsUpdated);

    return () => {
      mounted = false;
      unsubscribe();
      if (refreshInterval) {
        window.clearInterval(refreshInterval);
      }
      window.removeEventListener("tz-notifications-updated", handleNotificationsUpdated);
    };
  }, []);

  const href = isAuthenticated ? "/dashboard/notifications" : "/auth/login";
  const note = authLoading
    ? "جاري تحميل الإشعارات..."
    : isAuthenticated
      ? getUnreadLabel(unreadCount)
      : "سجّل الدخول لعرض إشعاراتك";

  return (
    <div className="hero-notification-row">
      <Link
        href={href}
        className={`hero-notification-chip${unreadCount > 0 ? " has-unread" : ""}`}
        aria-label={isAuthenticated ? "فتح مركز الإشعارات" : "تسجيل الدخول لعرض الإشعارات"}
      >
        <span className="hero-notification-bell" aria-hidden="true">
          🔔
        </span>

        <span className="hero-notification-copy">
          <strong>الإشعارات</strong>
          <span>{note}</span>
        </span>

        {isAuthenticated && unreadCount > 0 ? (
          <span className="hero-notification-badge" aria-label={`${unreadCount} غير مقروءة`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : (
          <span className="hero-notification-arrow" aria-hidden="true">
            ←
          </span>
        )}
      </Link>
    </div>
  );
}
