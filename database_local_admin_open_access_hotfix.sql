-- Temporary local-only hotfix:
-- Enables admin.html to manage data directly without signed-in Supabase admin auth.
-- Remove these policies before making the site public.

grant usage on schema public to anon;
grant usage, select on all sequences in schema public to anon;
grant execute on all functions in schema public to anon;

grant select, insert, update, delete on public.categories to anon;
grant select, insert, update, delete on public.products to anon;
grant select, insert, update, delete on public.services to anon;
grant select, insert, update, delete on public.repair_services to anon;
grant select, insert, update, delete on public.coupons to anon;
grant select, insert, update, delete on public.settings to anon;
grant select, insert, update, delete on public.user_profiles to anon;
grant select, insert, update, delete on public.app_users to anon;
grant select, insert, update, delete on public.audit_logs to anon;
grant select, insert, update, delete on public.orders to anon;
grant select, insert, update, delete on public.order_items to anon;
grant select, insert, update, delete on public.repair_bookings to anon;
grant select, insert, update, delete on public.contact_messages to anon;
grant select, insert, update, delete on public.deposits to anon;
grant select, insert, update, delete on public.wallets to anon;
grant select, insert, update, delete on public.wallet_transactions to anon;
grant select, insert, update, delete on public.notifications to anon;
grant select, insert, update, delete on public.service_orders to anon;

drop policy if exists local_admin_open_categories on public.categories;
create policy local_admin_open_categories
on public.categories
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_products on public.products;
create policy local_admin_open_products
on public.products
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_services on public.services;
create policy local_admin_open_services
on public.services
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_repair_services on public.repair_services;
create policy local_admin_open_repair_services
on public.repair_services
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_coupons on public.coupons;
create policy local_admin_open_coupons
on public.coupons
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_settings on public.settings;
create policy local_admin_open_settings
on public.settings
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_app_users on public.app_users;
create policy local_admin_open_app_users
on public.app_users
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_user_profiles on public.user_profiles;
create policy local_admin_open_user_profiles
on public.user_profiles
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_audit_logs on public.audit_logs;
create policy local_admin_open_audit_logs
on public.audit_logs
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_orders on public.orders;
create policy local_admin_open_orders
on public.orders
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_order_items on public.order_items;
create policy local_admin_open_order_items
on public.order_items
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_repair_bookings on public.repair_bookings;
create policy local_admin_open_repair_bookings
on public.repair_bookings
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_contact_messages on public.contact_messages;
create policy local_admin_open_contact_messages
on public.contact_messages
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_deposits on public.deposits;
create policy local_admin_open_deposits
on public.deposits
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_wallets on public.wallets;
create policy local_admin_open_wallets
on public.wallets
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_wallet_transactions on public.wallet_transactions;
create policy local_admin_open_wallet_transactions
on public.wallet_transactions
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_notifications on public.notifications;
create policy local_admin_open_notifications
on public.notifications
for all
to anon
using (true)
with check (true);

drop policy if exists local_admin_open_service_orders on public.service_orders;
create policy local_admin_open_service_orders
on public.service_orders
for all
to anon
using (true)
with check (true);
