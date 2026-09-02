
import { effectiveSolo, getSignal, getWaitInfo } from "@/lib/signal";
import { DEMO_COORDS } from "@/lib/demoCoords";
import { FOOD_GROUPS, foodGroup } from "@/lib/foodType";
import { createServerClient } from "@/lib/supabaseServer";
import HomeClient, { type HomeItem } from "@/app/HomeClient";
import type { RankEntry } from "@/app/Ranking";
import type { Restaurant, SignalColor, SoloReport, WaitReport } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANK: Record<SignalColor, number> = { green: 0, yellow: 1, red: 2, gray: 3 };

function nowLabel(now: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export default async function Home() {
  const supabase = createServerClient();
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const monthLabel = `${kst.getUTCMonth() + 1}월`;
  const monthStartMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600 * 1000;
  const monthStartIso = new Date(monthStartMs).toISOString();

  const [restaurantsRes, reportsRes, soloRes, waitMonthRes, msgMonthRes, profilesRes] =
    await Promise.all([
      supabase.from("restaurants").select("*"),
      supabase.from("wait_reports").select("*").gt("created_at", cutoffIso),
      supabase.from("solo_reports").select("*"),
      supabase.from("wait_reports").select("device_id").gte("created_at", monthStartIso),
      supabase.from("messages").select("device_id,restaurant_id,created_at").gte("created_at", monthStartIso),
      supabase.from("profiles").select("id,nickname"),
    ]);

  const restaurants = (restaurantsRes.data ?? []) as Restaurant[];
  const reports = (reportsRes.data ?? []) as WaitReport[];
  const soloReports = (soloRes.data ?? []) as SoloReport[];

  // 최근 30분 내 채팅이 있는 식당 = "대화중"
  const chatCutoff = now.getTime() - 30 * 60 * 1000;
  const activeChat = new Set(
    ((msgMonthRes.data ?? []) as { restaurant_id: string; created_at: string }[])
      .filter((m) => new Date(m.created_at).getTime() >= chatCutoff)
      .map((m) => m.restaurant_id),
  );

  const presentGroups = new Set(restaurants.map((r) => foodGroup(r.category)));
  const categories = FOOD_GROUPS.filter((g) => presentGroups.has(g));

  // 전체를 크라우드소싱 반영 + 정렬해서 통째로 내려주고, 필터/탭은 클라이언트에서 즉시 처리
  const items: HomeItem[] = restaurants
    .map((raw) => {
      const r: Restaurant = { ...raw, solo_status: effectiveSolo(raw, soloReports, now) };
      const own = reports.filter((x) => x.restaurant_id === r.id);
      const signal = getSignal(r, own, now);
      const wait = getWaitInfo(r, own, now);
      const coord: [number, number] | null =
        r.lat != null && r.lng != null ? [r.lat, r.lng] : (DEMO_COORDS[r.name] ?? null);
      return { r, signal, wait, coord };
    })
    .sort(
      (a, b) =>
        RANK[a.signal.color] - RANK[b.signal.color] ||
        (a.r.walk_min ?? 999) - (b.r.walk_min ?? 999),
    )
    .map(({ r, signal, wait, coord }) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      walkMin: r.walk_min,
      priceMin: r.price_min,
      priceMax: r.price_max,
      color: signal.color,
      label: signal.label,
      reason: signal.reason,
      waitSource: wait.source,
      waitFreshestMin: wait.freshestMin,
      lat: coord ? coord[0] : null,
      lng: coord ? coord[1] : null,
      soloStatus: r.solo_status,
      group: foodGroup(r.category),
      chatting: activeChat.has(r.id),
    }));

  const filledCount = restaurants.filter((r) => effectiveSolo(r, soloReports, now) !== null).length;

  // 이달의 외식왕 (로그인 기여만: device_id가 profiles.id인 것). 제보 +3, 채팅 +1.
  const nick = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; nickname: string }[])
    nick.set(p.id, p.nickname);
  const score = new Map<string, number>();
  const add = (dev: string | null, pts: number) => {
    if (dev && nick.has(dev)) score.set(dev, (score.get(dev) ?? 0) + pts);
  };
  for (const s of soloReports)
    if (new Date(s.created_at).getTime() >= monthStartMs) add(s.device_id, 3);
  for (const w of (waitMonthRes.data ?? []) as { device_id: string }[]) add(w.device_id, 3);
  for (const m of (msgMonthRes.data ?? []) as { device_id: string }[]) add(m.device_id, 1);
  const ranking: RankEntry[] = [...score.entries()]
    .map(([id, s]) => ({ nickname: nick.get(id) as string, score: s }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const loadError = restaurantsRes.error?.message ?? reportsRes.error?.message;

  return (
    <div>
      {loadError ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          데이터를 불러오지 못했어요: {loadError}
        </p>
      ) : (
        <HomeClient
          items={items}
          categories={categories}
          ranking={ranking}
          monthLabel={monthLabel}
          filledCount={filledCount}
          total={restaurants.length}
          nowLabel={nowLabel(now)}
        />
      )}

      <div className="mt-6 pb-4 text-center">
        <p className="text-[11px] leading-relaxed text-slate-300">
          혼밥·웨이팅 정보는 이용자 제보로 함께 채워가고 있어요
        </p>
      </div>
    </div>
  );
}
