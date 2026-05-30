-- ============================================================================
-- 2026-05-30-08  RLS auth.uid() initplan optimization
-- ----------------------------------------------------------------------------
-- Fixes the `auth_rls_initplan` performance lint on 24 policies. Postgres
-- re-evaluates a bare `auth.uid()` once PER ROW; wrapping it as
-- `(select auth.uid())` lets the planner evaluate it ONCE per query (InitPlan).
--
-- This is a faithful 1:1 rewrite: each policy keeps the exact same command,
-- roles, and logic — only `auth.uid()` is wrapped. No access-control change.
-- DROP + CREATE run inside the migration transaction, so each policy is never
-- absent to concurrent queries.
--
-- NOTE: `multiple_permissive_policies` (61 warnings) is intentionally NOT
-- addressed here — consolidating the per-table "own" + "admin" policies changes
-- the policy structure and needs a dedicated access-matrix review.
--
-- Review on staging before production; verify own-row vs admin access per table.
-- ============================================================================

-- deposits ------------------------------------------------------------------
drop policy if exists deposits_insert_own on public.deposits;
create policy deposits_insert_own on public.deposits
  for insert to authenticated
  with check ((((select auth.uid()) = user_id) AND (COALESCE(status, 'pending'::text) = 'pending'::text)));

drop policy if exists deposits_select_own_or_admin on public.deposits;
create policy deposits_select_own_or_admin on public.deposits
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

-- notifications -------------------------------------------------------------
drop policy if exists notifications_select_own_or_admin on public.notifications;
create policy notifications_select_own_or_admin on public.notifications
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

drop policy if exists notifications_update_own_or_admin on public.notifications;
create policy notifications_update_own_or_admin on public.notifications
  for update to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()))
  with check ((((select auth.uid()) = user_id) OR is_current_admin()));

-- orders --------------------------------------------------------------------
drop policy if exists orders_insert_own_or_admin on public.orders;
create policy orders_insert_own_or_admin on public.orders
  for insert to public
  with check ((is_current_admin() OR (((select auth.uid()) IS NOT NULL) AND ((select auth.uid()) = user_id))));

drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin on public.orders
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

-- refund_requests -----------------------------------------------------------
drop policy if exists refund_requests_insert_own on public.refund_requests;
create policy refund_requests_insert_own on public.refund_requests
  for insert to authenticated
  with check ((((select auth.uid()) = user_id) AND (COALESCE(status, 'pending'::text) = 'pending'::text) AND (amount > (0)::numeric)));

drop policy if exists refund_requests_select_own_or_admin on public.refund_requests;
create policy refund_requests_select_own_or_admin on public.refund_requests
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

-- repair_bookings -----------------------------------------------------------
drop policy if exists repair_bookings_insert_public on public.repair_bookings;
create policy repair_bookings_insert_public on public.repair_bookings
  for insert to anon, authenticated
  with check (((is_current_admin() OR (COALESCE(status, 'pending'::text) = 'pending'::text)) AND ((user_id IS NULL) OR (user_id = (select auth.uid())) OR is_current_admin())));

-- reviews -------------------------------------------------------------------
drop policy if exists reviews_insert_authenticated on public.reviews;
create policy reviews_insert_authenticated on public.reviews
  for insert to authenticated
  with check ((((user_id IS NULL) OR (user_id = (select auth.uid()))) AND (is_current_admin() OR (COALESCE(status, 'pending'::text) = 'pending'::text))));

-- service_orders ------------------------------------------------------------
drop policy if exists service_orders_insert_own_or_admin on public.service_orders;
create policy service_orders_insert_own_or_admin on public.service_orders
  for insert to public
  with check ((((select auth.uid()) = user_id) OR is_current_admin()));

drop policy if exists service_orders_select_own_or_admin on public.service_orders;
create policy service_orders_select_own_or_admin on public.service_orders
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

-- staff_permissions ---------------------------------------------------------
drop policy if exists staff_perm_self_read on public.staff_permissions;
create policy staff_perm_self_read on public.staff_permissions
  for select to authenticated
  using ((user_id = (select auth.uid())));

-- support_chat_messages -----------------------------------------------------
drop policy if exists support_chat_messages_insert_own_or_admin on public.support_chat_messages;
create policy support_chat_messages_insert_own_or_admin on public.support_chat_messages
  for insert to authenticated
  with check (((sender_user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
     FROM support_conversations conversations
    WHERE ((conversations.id = support_chat_messages.conversation_id) AND (((support_chat_messages.sender_role = 'customer'::text) AND (conversations.user_id = (select auth.uid()))) OR is_current_admin()))))));

drop policy if exists support_chat_messages_select_own_or_admin on public.support_chat_messages;
create policy support_chat_messages_select_own_or_admin on public.support_chat_messages
  for select to public
  using ((EXISTS ( SELECT 1
     FROM support_conversations conversations
    WHERE ((conversations.id = support_chat_messages.conversation_id) AND ((conversations.user_id = (select auth.uid())) OR is_current_admin())))));

drop policy if exists support_chat_messages_update_own_or_admin on public.support_chat_messages;
create policy support_chat_messages_update_own_or_admin on public.support_chat_messages
  for update to public
  using ((EXISTS ( SELECT 1
     FROM support_conversations conversations
    WHERE ((conversations.id = support_chat_messages.conversation_id) AND ((conversations.user_id = (select auth.uid())) OR is_current_admin())))))
  with check ((EXISTS ( SELECT 1
     FROM support_conversations conversations
    WHERE ((conversations.id = support_chat_messages.conversation_id) AND ((conversations.user_id = (select auth.uid())) OR is_current_admin())))));

-- support_conversations -----------------------------------------------------
drop policy if exists support_conversations_insert_own_or_admin on public.support_conversations;
create policy support_conversations_insert_own_or_admin on public.support_conversations
  for insert to authenticated
  with check ((((select auth.uid()) = user_id) OR is_current_admin()));

drop policy if exists support_conversations_select_own_or_admin on public.support_conversations;
create policy support_conversations_select_own_or_admin on public.support_conversations
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

drop policy if exists support_conversations_update_own_or_admin on public.support_conversations;
create policy support_conversations_update_own_or_admin on public.support_conversations
  for update to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()))
  with check ((((select auth.uid()) = user_id) OR is_current_admin()));

-- user_profiles -------------------------------------------------------------
drop policy if exists user_profiles_insert_own_or_admin on public.user_profiles;
create policy user_profiles_insert_own_or_admin on public.user_profiles
  for insert to public
  with check ((((select auth.uid()) = user_id) OR is_current_admin()));

drop policy if exists user_profiles_select_own_or_admin on public.user_profiles;
create policy user_profiles_select_own_or_admin on public.user_profiles
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

drop policy if exists user_profiles_update_own_or_admin on public.user_profiles;
create policy user_profiles_update_own_or_admin on public.user_profiles
  for update to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()))
  with check ((((select auth.uid()) = user_id) OR is_current_admin()));

-- wallet_transactions -------------------------------------------------------
drop policy if exists wallet_transactions_select_own_or_admin on public.wallet_transactions;
create policy wallet_transactions_select_own_or_admin on public.wallet_transactions
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));

-- wallets -------------------------------------------------------------------
drop policy if exists wallets_select_own_or_admin on public.wallets;
create policy wallets_select_own_or_admin on public.wallets
  for select to public
  using ((((select auth.uid()) = user_id) OR is_current_admin()));
