// 제보 확인 (가게 추가/기능 제안). 로컬에서만: node scripts/suggestions.mjs
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await c
  .from("suggestions")
  .select("kind,body,created_at")
  .order("created_at", { ascending: false });

if (error) {
  console.error("조회 실패:", error.message);
  process.exit(1);
}

const label = { place: "🏪 가게추가", feature: "💡 기능제안" };
console.log(`── 제보 ${data.length}건 (최신순) ──`);
for (const s of data) {
  const when = new Date(s.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  console.log(`\n[${label[s.kind] ?? s.kind}] ${when}`);
  console.log(`  ${s.body}`);
}
