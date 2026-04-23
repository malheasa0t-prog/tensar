-- Adds a human-friendly sequential number for physical orders.

create sequence if not exists public.order_display_number_seq
  as bigint
  start with 2000
  increment by 1
  minvalue 2000;

alter table public.orders
  add column if not exists display_number bigint;

alter table public.orders
  alter column display_number set default nextval('public.order_display_number_seq');

with ranked_orders as (
  select
    id,
    1999 + row_number() over (order by created_at asc, id asc) as next_display_number
  from public.orders
  where display_number is null
)
update public.orders as orders
set display_number = ranked_orders.next_display_number
from ranked_orders
where orders.id = ranked_orders.id;

select setval(
  'public.order_display_number_seq',
  greatest((select coalesce(max(display_number), 1999) from public.orders), 1999),
  true
);

alter table public.orders
  alter column display_number set not null;

create unique index if not exists idx_orders_display_number
  on public.orders(display_number);
