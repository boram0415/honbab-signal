// 제보된 가게를 네이버(pcmap SSR)에서 좌표·카테고리·주소 긁어 DB + 번들에 추가.
// 일회성 스크립트: node scripts/add_suggested.mjs
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
const CX = 127.122, CY = 37.485;
const dist = (x, y) => Math.hypot((x - CX) * 88, (y - CY) * 111);

const NAMES = ["녹정샤브샤브", "봄이보리밥", "강촌식당", "돈까스의집", "울트라아멘", "동원카레"];

function extractApollo(html) {
  const key = "__APOLLO_STATE__";
  let i = html.indexOf(key);
  if (i < 0) return null;
  i = html.indexOf("{", i);
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(i, j + 1);
    }
  }
  return null;
}

async function scrape(name) {
  const url = `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(name + " 문정")}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://pcmap.place.naver.com/" } });
  const html = await r.text();
  const raw = extractApollo(html);
  if (!raw) return null;
  let s;
  try {
    s = JSON.parse(raw);
  } catch {
    return null;
  }
  const places = Object.values(s)
    .filter((v) => v && typeof v === "object" && v.name && v.x && v.y)
    .map((v) => ({
      name: v.name,
      category: v.category || "기타",
      address: v.roadAddress || v.address || v.commonAddress || "",
      lat: +v.y,
      lng: +v.x,
      d: dist(+v.x, +v.y),
    }))
    .filter((v) => v.d < 2)
    .sort((a, b) => a.d - b.d);
  return places[0] || null;
}

async function main() {
  const { data: existing } = await svc.from("restaurants").select("name");
  const have = new Set((existing ?? []).map((r) => r.name));

  const results = [];
  for (const name of NAMES) {
    try {
      const p = await scrape(name);
      if (p) {
        results.push({ query: name, ...p });
        console.log(`✅ ${name} → ${p.name} | ${p.category} | ${p.address} | ${p.lat},${p.lng}`);
      } else {
        console.log(`— ${name}: 문정 근처 결과 없음`);
      }
    } catch (e) {
      console.log(`✖ ${name}: ${e.message}`);
    }
    await sleep(3000 + Math.floor(Math.random() * 3000));
  }

  // DB insert (미조사=gray, 기본 영업시간)
  for (const p of results) {
    if (have.has(p.name)) {
      console.log(`(이미 있음) ${p.name}`);
      continue;
    }
    const { error } = await svc.from("restaurants").insert({
      name: p.name,
      category: p.category,
      self_bar: false,
      closed_days: [],
      open_time: "11:00:00",
      close_time: "21:00:00",
    });
    console.log(error ? `❌ DB ${p.name}: ${error.message}` : `＋ DB 추가: ${p.name}`);
  }

  // demoCoords.ts / addresses.ts 갱신 (기존 유지, 신규만 삽입)
  async function upsertBundle(file, opener, lineFor) {
    let src = await readFile(file, "utf8");
    const insertAt = src.indexOf(opener) + opener.length;
    let add = "";
    for (const p of results) {
      if (src.includes(`"${p.name}":`)) continue; // 중복 방지
      add += lineFor(p);
    }
    if (add) {
      src = src.slice(0, insertAt) + add + src.slice(insertAt);
      await writeFile(file, src);
    }
    console.log(`갱신: ${file} (+${add ? add.trim().split("\n").length : 0}줄)`);
  }

  await upsertBundle(
    "lib/demoCoords.ts",
    "Record<string, [number, number]> = {\n",
    (p) => `  ${JSON.stringify(p.name)}: [${p.lat}, ${p.lng}],\n`,
  );
  await upsertBundle(
    "lib/addresses.ts",
    "Record<string, string> = {\n",
    (p) => (p.address ? `  ${JSON.stringify(p.name)}: ${JSON.stringify(p.address)},\n` : ""),
  );

  console.log(`\n완료: ${results.length}곳 처리`);
}

main();
