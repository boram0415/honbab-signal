-- 실시간 웨이팅 채팅: 24시간 지난 메시지 자동 삭제 (pg_cron)
create extension if not exists pg_cron;

-- 매시간 정각에 24시간 지난 채팅 삭제
select cron.schedule(
  'purge-old-messages',
  '0 * * * *',
  $$ delete from messages where created_at < now() - interval '24 hours' $$
);
