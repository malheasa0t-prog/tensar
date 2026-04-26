-- Deprecated insecure admin hotfix.
-- This script now removes the old anon-wide admin access instead of enabling it.

revoke all on public.app_users from anon;
revoke all on public.audit_logs from anon;
revoke all on public.contact_messages from anon;
revoke all on public.deposits from anon;
revoke all on public.notifications from anon;
revoke all on public.order_items from anon;
revoke all on public.orders from anon;
revoke all on public.repair_bookings from anon;
revoke all on public.service_orders from anon;
revoke all on public.user_profiles from anon;
revoke all on public.wallet_transactions from anon;
revoke all on public.wallets from anon;

drop policy if exists local_admin_open_app_users on public.app_users;
drop policy if exists local_admin_open_audit_logs on public.audit_logs;
drop policy if exists local_admin_open_categories on public.categories;
drop policy if exists local_admin_open_contact_messages on public.contact_messages;
drop policy if exists local_admin_open_coupons on public.coupons;
drop policy if exists local_admin_open_deposits on public.deposits;
drop policy if exists local_admin_open_notifications on public.notifications;
drop policy if exists local_admin_open_order_items on public.order_items;
drop policy if exists local_admin_open_orders on public.orders;
drop policy if exists local_admin_open_products on public.products;
drop policy if exists local_admin_open_repair_bookings on public.repair_bookings;
drop policy if exists local_admin_open_repair_services on public.repair_services;
drop policy if exists local_admin_open_service_orders on public.service_orders;
drop policy if exists local_admin_open_services on public.services;
drop policy if exists local_admin_open_settings on public.settings;
drop policy if exists local_admin_open_user_profiles on public.user_profiles;
drop policy if exists local_admin_open_wallet_transactions on public.wallet_transactions;
drop policy if exists local_admin_open_wallets on public.wallets;
