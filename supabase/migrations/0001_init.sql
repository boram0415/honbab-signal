create table restaurants (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,
  walk_min     int  not null,
  price_min    int  not null,
  price_max    int  not null,
  solo_status  text not null check (solo_status in ('green','yellow','red')),
  solo_note    text,
  wait_1200    int  check (wait_1200 in (0,5,15)),
  wait_1230    int  check (wait_1230 in (0,5,15)),
  order_type   text check (order_type in ('kiosk','table_tablet','staff_call')),
  self_bar     boolean default false,
  noise_level  int check (noise_level between 1 and 3),
  staff_talk   int check (staff_talk between 1 and 3),
  signature    text,
  closed_days  int[] default '{}',
  open_time    time default '11:00',
  close_time   time default '21:00',
  kakaomap_url text,
  photo_url    text,
  updated_at   timestamptz default now()
);

alter table restaurants
  add constraint restaurants_name_key unique (name);

create table wait_reports (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  level         int  not null check (level in (0,5,15)),
  device_id     text not null,
  created_at    timestamptz default now()
);

create index on wait_reports (restaurant_id, created_at desc);

alter table restaurants enable row level security;
alter table wait_reports enable row level security;

create policy "anon can read restaurants"
  on restaurants
  for select
  to anon
  using (true);

create policy "anon can insert wait reports"
  on wait_reports
  for insert
  to anon
  with check (true);

create policy "anon can read recent wait reports"
  on wait_reports
  for select
  to anon
  using (created_at > now() - interval '90 minutes');
