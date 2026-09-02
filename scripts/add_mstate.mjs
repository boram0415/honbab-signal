// 엠스테이트(법원로 114) 점심 식당을 네이버에서 긁어, 카페/술집/고기구이/비식당 제외하고
// 기존에 없는 것만 DB + 번들에 추가. node scripts/add_mstate.mjs
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

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 점심 혼밥에 안 맞는 업종 제외
const SKIP =
  /카페|디저트|커피|베이커리|빵|편의점|중개|부동산|오피스텔|당구|노래방|세탁|네일|전자담배|임대|주점|이자카야|맥주|호프|펍|와인|육류|고기|구이|곱창|막창|꼬치|갈비|삼겹|스테이크|냉삼|양갈비|족발|보쌈|치킨|당구장/;

function extractApollo(html) {
  const key = "__APOLLO_STATE__";
  let i = html.indexOf(key);
  if (i < 0) return null;
  i = html.indexOf("{", i);
  if (i < 0) return null;
  let d = 0, s = false, e = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (s) {
      if (e) e = false;
      else if (c === "\\") e = true;
      else if (c === '"') s = false;
    } else if (c === '"') s = true;
    else if (c === "{") d++;
    else if (c === "}") {
      d--;
      if (d === 0) return html.slice(i, j + 1);
    }
  }
  return null;
}

async function main() {
  const seen = new Map();
  for (const q of ["문정 엠스테이트", "법원로 114 맛집", "문정역 엠스테이트 식당", "엠스테이트 지하 식당"]) {
    try {
      const url = `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://pcmap.place.naver.com/" } });
      const raw = extractApollo(await r.text());
      if (!raw) continue;
      const s = JSON.parse(raw);
      for (const v of Object.values(s)) {
        if (!v || typeof v !== "object" || !v.name || !v.x || !v.y) continue;
        const addr = v.roadAddress || v.address || "";
        if (!/엠스테이트|법원로 114/.test(addr)) continue;
        if (SKIP.test(v.category || "")) continue;
        if (!seen.has(v.name))
          seen.set(v.name, { name: v.name, category: v.category || "기타", address: addr, lat: +v.y, lng: +v.x });
      }
    } catch (e) {
      console.log(`쿼리 실패 ${q}: ${e.message}`);
    }
    await sleep(3000);
  }

  const { data: existing } = await svc.from("restaurants").select("name");
  const have = new Set((existing ?? []).map((r) => r.name));
  const fresh = [...seen.values()].filter((p) => !have.has(p.name));

  console.log(`엠스테이트 식당 후보 ${seen.size} → 신규 ${fresh.length}곳`);
  for (const p of fresh) {
    const { error } = await svc.from("restaurants").insert({
      name: p.name,
      category: p.category,
      self_bar: false,
      closed_days: [],
      open_time: "11:00:00",
      close_time: "21:00:00",
    });
    console.log(error ? `❌ ${p.name}: ${error.message}` : `＋ ${p.name} | ${p.category}`);
  }

  async function upsertBundle(file, opener, lineFor) {
    let src = await readFile(file, "utf8");
    const at = src.indexOf(opener) + opener.length;
    let add = "";
    for (const p of fresh) {
      if (src.includes(`${JSON.stringify(p.name)}:`)) continue;
      add += lineFor(p);
    }
    if (add) await writeFile(file, src.slice(0, at) + add + src.slice(at));
  }
  await upsertBundle("lib/demoCoords.ts", "Record<string, [number, number]> = {\n", (p) => `  ${JSON.stringify(p.name)}: [${p.lat}, ${p.lng}],\n`);
  await upsertBundle("lib/addresses.ts", "Record<string, string> = {\n", (p) => (p.address ? `  ${JSON.stringify(p.name)}: ${JSON.stringify(p.address)},\n` : ""));

  console.log(`\n완료: 신규 ${fresh.length}곳 추가`);
}

main();
