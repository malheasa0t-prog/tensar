'use client';

import { useEffect } from 'react';
import { getPostAuthDestination, syncProfileFromAuthUser } from '@/lib/authProfileSync';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';

export default function AuthCallback() {
  useEffect(() => {
    let active = true;
    let redirected = false;
    let unsubscribe = () => {};

    /**
     * Resolves the post-auth redirect once a session is available.
     *
     * @param {{ user?: Record<string, unknown> | null } | null} session
     * @returns {Promise<void>}
     */
    async function redirectFromSession(session) {
      if (!active || !session?.user || redirected) {
        return;
      }

      redirected = true;
      await syncProfileFromAuthUser(session.user);
      window.location.href = await getPostAuthDestination(session.user);
    }

    /**
     * Attaches auth callbacks after loading the Supabase client.
     *
     * @returns {Promise<void>}
     */
    async function attachAuthCallback() {
      const supabase = await loadSupabaseClient();

      if (!active) {
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          void redirectFromSession(session);
        }
      });

      unsubscribe = () => subscription.unsubscribe();
      const { data } = await supabase.auth.getSession();
      await redirectFromSession(data?.session || null);
    }

    void attachAuthCallback();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <section className="section" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⚙️</div>
        <h2>جاري تسجيل الدخول...</h2>
        <p style={{ color: 'var(--text-muted)' }}>يرجى الانتظار قليلاً</p>
      </div>
    </section>
  );
}
