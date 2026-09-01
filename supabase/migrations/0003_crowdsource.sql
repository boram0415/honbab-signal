-- 미조사(빈 값) 허용
alter table restaurants alter column solo_status drop not null;
alter table restaurants alter column walk_min drop not null;
alter table restaurants alter column price_min drop not null;
alter table restaurants alter column price_max drop not null;

-- 혼밥 크라우드소싱 제보 테이블
create table solo_reports (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  status        text not null check (status in ('green','yellow','red')),
  device_id     text not null,
  created_at    timestamptz default now()
);
create index on solo_reports (restaurant_id, created_at desc);
alter table solo_reports enable row level security;
create policy "anon insert solo" on solo_reports for insert to anon with check (true);
create policy "anon read solo" on solo_reports for select to anon using (true);
