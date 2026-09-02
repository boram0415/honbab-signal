-- 1st-party 방문 로그 (DAU·재방문률). device_id + 로그인 user_id 기반, 하루 1행.
-- 브라우저 핑거프린팅 아님(우리 UUID). 읽기는 service_role만.
create table if not exists visits (
  device_id text not null,
  user_id uuid,
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at timestamptz not null default now(),
  primary key (device_id, day)
);

alter table visits enable row level security;

-- 쓰기만 허용(익명 포함). 조회 정책 없음 → anon/authenticated는 못 읽음(집계는 서버에서).
drop policy if exists visits_insert on visits;
create policy visits_insert on visits
  for insert to anon, authenticated with check (true);
