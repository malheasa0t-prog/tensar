-- Safe grant baseline for public and authenticated roles.
-- Avoid broad anon access and keep privileged RPCs off user-facing roles.

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.is_current_admin() to authenticated;

revoke execute on function public.create_service_order_tx(uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.admin_adjust_wallet_balance(uuid, uuid, numeric, text) from public, anon, authenticated;

grant select on public.settings to anon;
grant select on public.categories to anon;
grant select on public.products to anon;
grant select on public.services to anon;
grant select on public.repair_services to anon;
grant select on public.reviews to anon;
grant select on public.coupons to anon;
grant insert on public.contact_messages to anon;
grant insert on public.repair_bookings to anon;
