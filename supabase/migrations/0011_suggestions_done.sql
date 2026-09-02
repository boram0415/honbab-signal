-- 제보 완료 처리(관리자용). 기본 미완료.
alter table suggestions add column if not exists done boolean not null default false;
