'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getPostAuthDestination, syncProfileFromAuthUser } from '@/lib/authProfileSync';

export default function AuthCallback() {
  useEffect(() => {
    let redirected = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !redirected) {
        redirected = true;
        await syncProfileFromAuthUser(session.user);
        window.location.href = await getPostAuthDestination(session.user);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session && !redirected) {
        redirected = true;
        await syncProfileFromAuthUser(data.session.user);
        window.location.href = await getPostAuthDestination(data.session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
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
