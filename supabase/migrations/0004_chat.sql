-- 식당별 실시간 채팅 (지금 웨이팅 있어요? 문답)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  device_id text not null,
  nickname text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_restaurant_created_idx
  on messages (restaurant_id, created_at);

alter table messages enable row level security;

-- 읽기: 누구나
drop policy if exists messages_select on messages;
create policy messages_select on messages
  for select to anon, authenticated using (true);

-- 쓰기: 누구나(익명 허용) — 본문/닉네임 길이만 제한
drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert to anon, authenticated
  with check (
    char_length(body) between 1 and 300
    and char_length(nickname) between 1 and 40
  );

-- Realtime 발행 등록 (이미 있으면 건너뜀)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
