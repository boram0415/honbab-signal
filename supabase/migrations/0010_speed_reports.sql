-- 음식 나오는 속도 제보 (빠름/보통/오래). 웨이팅(줄)과 별개로 '제공 속도'.
create table if not exists speed_reports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  level text not null check (level in ('fast', 'medium', 'slow')),
  device_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists speed_reports_restaurant_idx on speed_reports (restaurant_id);

alter table speed_reports enable row level security;

drop policy if exists speed_select on speed_reports;
create policy speed_select on speed_reports for select to anon, authenticated using (true);

drop policy if exists speed_insert on speed_reports;
create policy speed_insert on speed_reports
  for insert to anon, authenticated
  with check (level in ('fast', 'medium', 'slow'));
