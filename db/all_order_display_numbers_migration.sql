-- Adds one human-friendly display number sequence across every order table.

begin;

create sequence if not exists public.order_display_number_seq
  as bigint
  start with 2000
  increment by 1
  minvalue 2000;

alter table public.orders
  add column if not exists display_number bigint;

alter table public.service_orders
  add column if not exists display_number bigint;

alter table public.repair_bookings
  add column if not exists display_number bigint;

alter table public.orders
  alter column display_number set default nextval('public.order_display_number_seq');

alter table public.service_orders
  alter column display_number set default nextval('public.order_display_number_seq');

alter table public.repair_bookings
  alter column display_number set default nextval('public.order_display_number_seq');

create temporary table tmp_order_display_numbers on commit drop as
with current_max as (
  select greatest(
    1999,
    (select coalesce(max(display_number), 1999) from public.orders),
    (select coalesce(max(display_number), 1999) from public.service_orders),
    (select coalesce(max(display_number), 1999) from public.repair_bookings)
  ) as value
),
missing_orders as (
  select 'orders' as table_name, id, created_at from public.orders where display_number is null
  union all
  select 'service_orders' as table_name, id, created_at from public.service_orders where display_number is null
  union all
  select 'repair_bookings' as table_name, id, created_at from public.repair_bookings where display_number is null
)
select
  missing_orders.table_name,
  missing_orders.id,
  current_max.value + row_number() over (
    order by missing_orders.created_at asc nulls last, missing_orders.id asc
  ) as display_number
from missing_orders
cross join current_max;

update public.orders as orders
set display_number = tmp_order_display_numbers.display_number
from tmp_order_display_numbers
where tmp_order_display_numbers.table_name = 'orders'
  and orders.id = tmp_order_display_numbers.id;

update public.service_orders as service_orders
set display_number = tmp_order_display_numbers.display_number
from tmp_order_display_numbers
where tmp_order_display_numbers.table_name = 'service_orders'
  and service_orders.id = tmp_order_display_numbers.id;

update public.repair_bookings as repair_bookings
set display_number = tmp_order_display_numbers.display_number
from tmp_order_display_numbers
where tmp_order_display_numbers.table_name = 'repair_bookings'
  and repair_bookings.id = tmp_order_display_numbers.id;

select setval(
  'public.order_display_number_seq',
  greatest(
    1999,
    (select coalesce(max(display_number), 1999) from public.orders),
    (select coalesce(max(display_number), 1999) from public.service_orders),
    (select coalesce(max(display_number), 1999) from public.repair_bookings)
  ),
  true
);

alter table public.orders
  alter column display_number set not null;

alter table public.service_orders
  alter column display_number set not null;

alter table public.repair_bookings
  alter column display_number set not null;

create unique index if not exists idx_orders_display_number
  on public.orders(display_number);

create unique index if not exists idx_service_orders_display_number
  on public.service_orders(display_number);

create unique index if not exists idx_repair_bookings_display_number
  on public.repair_bookings(display_number);

commit;
