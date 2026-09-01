// 네이버 모바일 플레이스에서 상세주소(지하/층/호 포함 roadAddress)를 긁어 번들 파일로 저장.
// 예의 크롤링: 3~8초 랜덤, 모바일 헤더, 이름 매칭될 때만 사용.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });
const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const MUA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) =>
  (s || "")
    .replace(/\(.*?\)/g, "")
    .replace(/(본점|직영점|지점|송파문정|문정역|문정동|문정|송파|역점|점)/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

async function scrapeAddr(name) {
  const url = `https://m.place.naver.com/restaurant/list?query=${encodeURIComponent(name + " 문정")}`;
  const r = await fetch(url, { headers: { "User-Agent": MUA, Referer: "https://m.place.naver.com/" } });
  if (!r.ok) return null;
  const html = await r.text();
  const m = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  let s;
  try {
    s = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const places = Object.values(s).filter(
    (v) => v && typeof v === "object" && v.name && v.roadAddress,
  );
  const t = places.find((v) => {
    const a = norm(name),
      b = norm(v.name);
    return a && b && (a.includes(b) || b.includes(a));
  });
  return t ? t.roadAddress : null;
}

async function main() {
  const { data } = await svc.from("restaurants").select("name");
  const names = (data ?? []).map((r) => r.name);
  const out = {};
  let ok = 0;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const addr = await scrapeAddr(name);
      if (addr) {
        out[name] = addr;
        ok += 1;
        console.log(`[${i + 1}/${names.length}] ✅ ${name} → ${addr}`);
      } else {
        console.log(`[${i + 1}/${names.length}] — ${name}`);
      }
    } catch (e) {
      console.log(`[${i + 1}/${names.length}] ✖ ${name} (${e.message})`);
    }
    await sleep(3000 + Math.floor(Math.random() * 5000));
  }
  const entries = Object.entries(out)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  const content = `// 네이버에서 긁은 상세주소(지하/층/호 포함). 번들 제공.\nexport const ADDRESSES: Record<string, string> = {\n${entries}\n};\n`;
  await writeFile("lib/addresses.ts", content);
  console.log(`\n완료: 주소 ${ok}곳 → lib/addresses.ts`);
}

main();
