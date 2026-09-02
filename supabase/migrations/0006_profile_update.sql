-- 마이페이지 닉네임 변경: 로그인한 본인 프로필만 수정 가능(anon/타인 수정 차단)
alter table profiles enable row level security;

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
