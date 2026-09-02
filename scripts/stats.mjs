// 방문 통계 (DAU·재방문률). 로컬에서만: node scripts/stats.mjs
// service_role로 visits를 읽어 집계. 브라우저엔 노출 안 됨.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await c.from("visits").select("device_id,day");
if (error) {
  console.error("visits 조회 실패:", error.message);
  process.exit(1);
}

const kstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// device -> 방문한 날짜 집합
const byDevice = new Map();
const perDay = new Map(); // day -> Set(device)
for (const v of data) {
  if (!byDevice.has(v.device_id)) byDevice.set(v.device_id, new Set());
  byDevice.get(v.device_id).add(v.day);
  if (!perDay.has(v.day)) perDay.set(v.day, new Set());
  perDay.get(v.day).add(v.device_id);
}

const totalDevices = byDevice.size;
const returning = [...byDevice.values()].filter((days) => days.size >= 2).length;

// device -> 최초 방문일
const firstDay = new Map();
for (const [dev, days] of byDevice) firstDay.set(dev, [...days].sort()[0]);

// D+1 리텐션: 신규 코호트(최초방문=d) 중 다음날(d+1)에도 온 비율 (코호트 평균)
const nextDay = (d) => new Date(new Date(d).getTime() + 86400000).toISOString().slice(0, 10);
const cohorts = new Map(); // d -> {size, retained}
for (const [dev, fd] of firstDay) {
  if (!cohorts.has(fd)) cohorts.set(fd, { size: 0, retained: 0 });
  const co = cohorts.get(fd);
  co.size++;
  if (byDevice.get(dev).has(nextDay(fd))) co.retained++;
}
let coSize = 0, coRet = 0;
for (const [d, co] of cohorts) {
  if (d === kstToday) continue; // 오늘 코호트는 내일이 안 왔으니 제외
  coSize += co.size;
  coRet += co.retained;
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

console.log("── 혼밥신호등 방문 통계 (KST 기준) ──");
console.log(`오늘(${kstToday}) 방문자: ${perDay.get(kstToday)?.size ?? 0}명`);
console.log("\n최근 7일 일별 방문자:");
const days = [...perDay.keys()].sort().slice(-7);
for (const d of days) console.log(`  ${d}: ${perDay.get(d).size}명`);
console.log(`\n전체 순 방문자: ${totalDevices}명`);
console.log(`재방문자(2일 이상 방문): ${returning}명 → 재방문률 ${pct(returning, totalDevices)}%`);
console.log(`D+1 리텐션(신규 다음날 복귀): ${pct(coRet, coSize)}% (코호트 ${coSize}명 기준)`);
