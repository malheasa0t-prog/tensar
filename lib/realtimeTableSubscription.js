import { loadSupabaseClient } from "./loadSupabaseClient.js";

/**
 * Subscribes to Postgres realtime changes on one or more public tables and
 * invokes `onChange` whenever any of them changes. Shared by the storefront
 * services so an admin edit surfaces on the site within moments instead of
 * waiting for the per-service cache TTL.
 *
 * @param {{ channel: string, tables: string[], onChange: () => void, client?: Record<string, unknown> }} params
 * @returns {() => void} Unsubscribe callback (safe to call once).
 */
export function subscribeToTableChanges({ channel, tables, onChange, client }) {
  if (typeof onChange !== "function" || !Array.isArray(tables) || tables.length === 0) {
    return () => {};
  }

  let active = true;
  let cleanup = () => {};

  async function attach() {
    const supabase = client || (await loadSupabaseClient());
    if (!active) return;

    let builder = supabase.channel(channel);
    tables.forEach((table) => {
      builder = builder.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange()
      );
    });
    const subscribed = builder.subscribe();

    cleanup = () => supabase.removeChannel(subscribed);
  }

  void attach();

  return () => {
    active = false;
    cleanup();
  };
}
