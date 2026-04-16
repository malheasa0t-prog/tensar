import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getPostAuthDestination, syncProfileFromAuthUser } from "@/lib/authProfileSync";

/**
 * Finalizes the Supabase authentication callback and redirects the user.
 *
 * @returns {JSX.Element}
 */
export default function AuthCallbackRoute() {
  useEffect(() => {
    let redirected = false;

    /**
     * Syncs the signed-in user profile once and forwards the browser to the destination page.
     *
     * @param {import("@supabase/supabase-js").Session | null} session
     * @returns {Promise<void>}
     */
    async function redirectWithSession(session) {
      if (!session || redirected) {
        return;
      }

      redirected = true;
      await syncProfileFromAuthUser(session.user);
      window.location.href = await getPostAuthDestination(session.user);
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN") {
        await redirectWithSession(session);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      await redirectWithSession(data?.session || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section
      className="section"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "16px", animation: "spin 1s linear infinite" }}>
          ⚙️
        </div>
        <h2>جارٍ تسجيل الدخول...</h2>
        <p style={{ color: "var(--text-muted)" }}>يرجى الانتظار قليلًا</p>
      </div>
    </section>
  );
}
