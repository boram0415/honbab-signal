// 네이버 모바일 플레이스에서 식당 대표 사진을 긁어 restaurants.photo_url 업데이트.
// 예의 크롤링: 3~8초 랜덤 간격, 모바일 헤더, 각 식당 1회, 실패는 스킵.
import { readFile } from "node:fs/promises";
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
// 지점/지역 접미사를 떼어 핵심 상호로 비교 (정확도 유지하며 매칭률↑)
const norm = (s) =>
  (s || "")
    .replace(/\(.*?\)/g, "")
    .replace(/(본점|직영점|지점|송파문정|문정역|문정동|문정|송파|역점|점)/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

function getImage(v) {
  for (const c of [v.imageUrl, v.thumUrl, v.thumbUrl, v.mainImageUrl]) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  if (Array.isArray(v.images) && v.images.length) {
    const im = v.images[0];
    if (typeof im === "string" && im.startsWith("http")) return im;
    if (im && typeof im === "object") return im.url || im.imageUrl || null;
  }
  return null;
}

async function scrapeImage(name) {
  const url = `https://m.place.naver.com/restaurant/list?query=${encodeURIComponent(name + " 문정")}`;
  const r = await fetch(url, { headers: { "User-Agent": MUA, Referer: "https://m.place.naver.com/" } });
  if (!r.ok) return null;
  const html = await r.text();
  const m = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  let state;
  try {
    state = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const places = Object.values(state).filter(
    (v) => v && typeof v === "object" && v.name && getImage(v),
  );
  if (!places.length) return null;
  // 이름이 실제로 매칭될 때만 사용 (엉뚱한 가게 사진 방지). 매칭 없으면 스킵.
  const target = places.find((v) => {
    const a = norm(name),
      b = norm(v.name);
    return a && b && (a.includes(b) || b.includes(a));
  });
  return target ? getImage(target) : null;
}

async function main() {
  // 사진 아직 없는 곳만 다시 시도
  const { data } = await svc
    .from("restaurants")
    .select("id,name")
    .is("photo_url", null);
  const targets = data ?? [];
  let ok = 0,
    miss = 0;
  for (let i = 0; i < targets.length; i++) {
    const { id, name } = targets[i];
    try {
      const img = await scrapeImage(name);
      if (img) {
        await svc.from("restaurants").update({ photo_url: img }).eq("id", id);
        ok += 1;
        console.log(`[${i + 1}/${targets.length}] ✅ ${name}`);
      } else {
        miss += 1;
        console.log(`[${i + 1}/${targets.length}] — ${name} (사진 없음)`);
      }
    } catch (e) {
      miss += 1;
      console.log(`[${i + 1}/${targets.length}] ✖ ${name} (${e.message})`);
    }
    await sleep(3000 + Math.floor(Math.random() * 5000)); // 3~8초 랜덤
  }
  console.log(`\n완료: 사진 ${ok}곳 / 실패·없음 ${miss}곳`);
}

main();
