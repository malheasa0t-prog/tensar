"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ADMIN_DEV_BYPASS, ADMIN_PANEL_ENABLED } from "@/lib/adminFeature";
import { canAccessAdminRecord, getAdminDisplayName } from "@/lib/adminRoles";

export function useAdminAccess() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminName, setAdminName] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        if (!ADMIN_PANEL_ENABLED) {
          if (!mounted) return;
          setAllowed(false);
          setLoading(false);
          router.replace("/dashboard");
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!mounted) return;
          setAllowed(false);
          setLoading(false);
          router.replace("/auth/login");
          return;
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role, full_name, status")
          .eq("user_id", user.id)
          .maybeSingle();

        let legacyUser = null;
        if (!canAccessAdminRecord(profile) && user.email) {
          const { data } = await supabase
            .from("app_users")
            .select("role, full_name, status")
            .ilike("email", user.email)
            .maybeSingle();
          legacyUser = data || null;
        }

        const isAdmin = canAccessAdminRecord(profile) || canAccessAdminRecord(legacyUser);

        if (!isAdmin && !ADMIN_DEV_BYPASS) {
          if (!mounted) return;
          setAllowed(false);
          setLoading(false);
          router.replace("/dashboard");
          return;
        }

        if (!mounted) return;

        setAdminName(
          getAdminDisplayName({
            profile,
            legacyUser,
            fallbackEmail: user.email || "Admin",
          })
        );
        setAllowed(true);
        setLoading(false);
      } catch (error) {
        if (!mounted) return;
        setAllowed(false);
        setLoading(false);
        router.replace("/auth/login");
      }
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  return {
    loading,
    allowed,
    adminName,
    pathname,
  };
}
