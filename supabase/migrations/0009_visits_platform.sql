-- 방문 기기 구분 (mobile / web). 기존 행은 null(기타).
alter table visits add column if not exists platform text;
