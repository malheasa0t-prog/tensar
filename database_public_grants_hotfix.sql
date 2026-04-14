grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

grant select on public.settings to anon;
grant select on public.categories to anon;
grant select on public.products to anon;
grant select on public.services to anon;
grant select on public.repair_services to anon;
grant select on public.reviews to anon;
grant select on public.coupons to anon;
grant insert on public.contact_messages to anon;
grant insert on public.repair_bookings to anon;
