-- 사용자 제보: 가게 추가 요청(place) / 기능 제안(feature)
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('place', 'feature')),
  body text not null,
  device_id text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);

alter table suggestions enable row level security;

-- 쓰기: 누구나(익명 포함). 본문 길이/종류만 제한
drop policy if exists suggestions_insert on suggestions;
create policy suggestions_insert on suggestions
  for insert to anon, authenticated
  with check (char_length(body) between 1 and 1000 and kind in ('place', 'feature'));

-- 조회 정책 없음 → 관리자(service_role)만 읽음
