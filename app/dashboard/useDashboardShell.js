"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useFavorites } from "@/components/FavoritesProvider";
import {
  buildDashboardNavItems,
  createDashboardShellTimeoutError,
  DASHBOARD_SHELL_TIMEOUT_MS,
  resolveDashboardDisplayName,
} from "@/lib/dashboardShellModel";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  fetchDashboardProfile,
  fetchDashboardSessionUser,
  fetchDashboardWalletSnapshot,
  fetchUnreadNotificationsCount,
  subscribeToDashboardAuthChanges,
} from "@/services/dashboardShellService";

/**
 * Stores the authenticated dashboard shell state and live subscriptions.
 *
 * @returns {{
 *   displayName: string,
 *   error: Error | null,
 *   handleLogout: () => Promise<void>,
 *   isReady: boolean,
 *   loading: boolean,
 *   navItems: Array<{ href: string, label: string, icon: string, badge?: string }>,
 *   retry: () => void,
 *   wallet: Record<string, unknown> | null,
 * }}
 */
export default function useDashboardShell() {
  const { favoriteCount } = useFavorites();
  const [bootstrapKey, setBootstrapKey] = useState(0);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resetDashboardState = useCallback(() => {
    setProfile(null);
    setUnreadNotifications(0);
    setUser(null);
    setWallet(null);
  }, []);

  const refreshUnreadNotifications = useCallback(async (userId) => {
    try {
      const nextUnreadNotifications = await fetchUnreadNotificationsCount({ userId });
      if (isMountedRef.current) {
        setUnreadNotifications(nextUnreadNotifications);
      }
    } catch (refreshError) {
      console.error("[DSH-301] Failed to refresh dashboard notifications:", refreshError);
      if (isMountedRef.current) {
        setUnreadNotifications(0);
      }
    }
  }, []);

  const refreshWallet = useCallback(async (userId) => {
    try {
      const nextWallet = await fetchDashboardWalletSnapshot({ userId });
      if (isMountedRef.current) {
        setWallet(nextWallet);
      }
    } catch (refreshError) {
      console.error("[DSH-302] Failed to refresh dashboard wallet:", refreshError);
      if (isMountedRef.current) {
        setWallet(null);
      }
    }
  }, []);

  const refreshLiveStats = useCallback(
    async (userId) => {
      await Promise.all([refreshUnreadNotifications(userId), refreshWallet(userId)]);
    },
    [refreshUnreadNotifications, refreshWallet]
  );

  const retry = useCallback(() => {
    resetDashboardState();
    setError(null);
    setLoading(true);
    setBootstrapKey((currentValue) => currentValue + 1);
  }, [resetDashboardState]);

  useEffect(() => {
    let active = true;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      if (!active || !isMountedRef.current) {
        return;
      }

      didTimeout = true;
      resetDashboardState();
      setError(createDashboardShellTimeoutError());
      setLoading(false);
    }, DASHBOARD_SHELL_TIMEOUT_MS);

    async function bootstrapDashboardShell() {
      setLoading(true);
      setError(null);

      try {
        const currentUser = await fetchDashboardSessionUser();
        if (!active || !isMountedRef.current || didTimeout) {
          return;
        }

        if (!currentUser) {
          resetDashboardState();
          navigate("/auth/login");
          return;
        }

        setUser(currentUser);

        try {
          const nextProfile = await fetchDashboardProfile({ userId: currentUser.id });
          if (active && isMountedRef.current && !didTimeout) {
            setProfile(nextProfile);
          }
        } catch (profileError) {
          console.error("[DSH-303] Failed to load dashboard profile:", profileError);
          if (active && isMountedRef.current && !didTimeout) {
            setProfile(null);
          }
        }

        await refreshLiveStats(currentUser.id);
      } catch (bootstrapError) {
        console.error("[DSH-304] Failed to bootstrap dashboard shell:", bootstrapError);
        if (active && isMountedRef.current && !didTimeout) {
          resetDashboardState();
          setError(
            bootstrapError instanceof Error
              ? bootstrapError
              : new Error("[DSH-304] تعذر تحميل لوحة الحساب الآن.")
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (active && isMountedRef.current && !didTimeout) {
          setLoading(false);
        }
      }
    }

    void bootstrapDashboardShell();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [bootstrapKey, navigate, refreshLiveStats, resetDashboardState]);

  useEffect(() => {
    return subscribeToDashboardAuthChanges({
      onAuthChange({ event, session }) {
        if (!isMountedRef.current) {
          return;
        }

        if (!session?.user) {
          resetDashboardState();
          setError(null);
          setLoading(false);
          navigate("/auth/login");
          return;
        }

        setUser(session.user);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          void refreshLiveStats(session.user.id);
        }
      },
    });
  }, [navigate, refreshLiveStats, resetDashboardState]);

  useEffect(() => {
    if (!user?.id || error) {
      return undefined;
    }

    let active = true;
    let cleanup = () => {};

    /**
     * Attaches the realtime notifications channel after loading the client.
     *
     * @returns {Promise<void>}
     */
    async function attachNotificationsChannel() {
      const supabase = await loadSupabaseClient();

      if (!active) {
        return;
      }

      const notificationsChannel = supabase
        .channel(`dashboard-shell-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refreshUnreadNotifications(user.id);
          }
        )
        .subscribe();

      cleanup = () => {
        void supabase.removeChannel(notificationsChannel);
      };
    }

    void attachNotificationsChannel();

    return () => {
      active = false;
      cleanup();
    };
  }, [error, refreshUnreadNotifications, user?.id]);

  useEffect(() => {
    if (!user?.id || error) {
      return undefined;
    }

    let active = true;
    let cleanup = () => {};

    /**
     * Attaches the realtime wallet channel after loading the client.
     *
     * @returns {Promise<void>}
     */
    async function attachWalletChannel() {
      const supabase = await loadSupabaseClient();

      if (!active) {
        return;
      }

      const walletChannel = supabase
        .channel(`dashboard-shell-wallet-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallets",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refreshWallet(user.id);
          }
        )
        .subscribe();

      cleanup = () => {
        void supabase.removeChannel(walletChannel);
      };
    }

    void attachWalletChannel();

    return () => {
      active = false;
      cleanup();
    };
  }, [error, refreshWallet, user?.id]);

  useEffect(() => {
    if (!user?.id || error) {
      return undefined;
    }

    function handleNotificationsUpdate() {
      void refreshUnreadNotifications(user.id);
    }

    window.addEventListener("tz-notifications-updated", handleNotificationsUpdate);
    return () => {
      window.removeEventListener("tz-notifications-updated", handleNotificationsUpdate);
    };
  }, [error, refreshUnreadNotifications, user?.id]);

  const handleLogout = useCallback(async () => {
    const supabase = await loadSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  return {
    displayName: resolveDashboardDisplayName({ profile, user }),
    error,
    handleLogout,
    isReady: Boolean(user) && !error,
    loading,
    navItems: buildDashboardNavItems({ favoriteCount, unreadNotifications }),
    retry,
    wallet,
  };
}
