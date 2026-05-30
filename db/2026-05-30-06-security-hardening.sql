-- ============================================================================
-- 2026-05-30-06  Security hardening (advisor follow-ups)
-- ----------------------------------------------------------------------------
-- Addresses Supabase database-linter findings without weakening RLS:
--   1. function_search_path_mutable on two utility/trigger helpers.
--   2. anon/authenticated can call two trigger-only SECURITY DEFINER functions
--      via /rest/v1/rpc. Triggers fire in the table-owner context regardless of
--      EXECUTE grants, so revoking client EXECUTE is safe and closes the RPC.
--   3. Enables realtime on audit_logs so the admin "سجل العمليات" view live-updates.
--
-- NOT touched on purpose: is_current_admin(), is_admin_user(uuid),
-- is_panel_staff(uuid). These helpers are referenced inside RLS USING/CHECK
-- clauses on public-readable tables (products, categories, coupons, ...). In
-- PostgreSQL a function called from an RLS policy requires the querying role to
-- hold EXECUTE, so revoking anon/authenticated would break the public
-- storefront. Their "executable by anon" advisor warning is acknowledged and
-- intentional.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Pin search_path so the function body always resolves objects in `public`.
alter function public.generate_prefixed_id(text) set search_path = public;
alter function public.set_updated_at_now() set search_path = public;

-- 2. Trigger-only SECURITY DEFINER functions: remove client-facing EXECUTE.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_legacy_app_user_from_profile() from public, anon, authenticated;

-- 3. Live-update audit log entries in the dashboard.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end $$;
