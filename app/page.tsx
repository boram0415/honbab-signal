import Link from "next/link";

import { effectiveSolo, getSignal, getWaitInfo, isQuickMeal } from "@/lib/signal";
import { DEMO_COORDS } from "@/lib/demoCoords";
import { FOOD_GROUPS, foodGroup } from "@/lib/foodType";
import { createServerClient } from "@/lib/supabaseServer";
import { AuthButton } from "@/app/AuthButton";
import MapView from "@/app/MapView";
import { Ranking, type RankEntry } from "@/app/Ranking";
import { RestaurantList, type ListItem } from "@/app/RestaurantList";
import type { MapPoint } from "@/app/KakaoMap";
import type { Restaurant, SignalColor, SoloReport, WaitReport } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANK: Record<SignalColor, number> = { green: 0, yellow: 1, red: 2, gray: 3 };

function won(n: number): string {
  return n.toLocaleString("ko-KR");
}

function nowLabel(now: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

function hrefFor(o: {
  map: boolean;
  solo: boolean;
  nowait: boolean;
  quick: boolean;
  cat: string;
}): string {
  const p = new URLSearchParams();
  if (o.map) p.set("view", "map");
  if (o.solo) p.set("solo", "1");
  if (o.nowait) p.set("nowait", "1");
  if (o.quick) p.set("quick", "1");
  if (o.cat) p.set("cat", o.cat);
  const q = p.toString();
  return q ? `/?${q}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const soloOnly = sp.solo === "1";
  const noWaitOnly = sp.nowait === "1";
  const quickOnly = sp.quick === "1";
  const mapView = sp.view === "map";
  const rankingView = sp.view === "ranking";
  const catFilter = typeof sp.cat === "string" ? sp.cat : "";

  const supabase = createServerClient();
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

  const [restaurantsRes, reportsRes, soloRes] = await Promise.all([
    supabase.from("restaurants").select("*"),
    supabase.from("wait_reports").select("*").gt("created_at", cutoffIso),
    supabase.from("solo_reports").select("*"),
  ]);

  const restaurants = (restaurantsRes.data ?? []) as Restaurant[];
  const reports = (reportsRes.data ?? []) as WaitReport[];
  const soloReports = (soloRes.data ?? []) as SoloReport[];

  // 원본 64종 카테고리를 8개 대분류로 묶어 필터 칩으로 (있는 그룹만, 정해진 순서로)
  const presentGroups = new Set(restaurants.map((r) => foodGroup(r.category)));
  const categories = FOOD_GROUPS.filter((g) => presentGroups.has(g));

  const items = restaurants
    .map((raw) => {
      // 크라우드소싱 반영: 시드 solo_status 없으면 제보로 채운다
      const r: Restaurant = { ...raw, solo_status: effectiveSolo(raw, soloReports) };
      const own = reports.filter((x) => x.restaurant_id === r.id);
      const signal = getSignal(r, own, now);
      const wait = getWaitInfo(r, own, now);
      const quick = isQuickMeal(r);
      return { r, signal, wait, quick };
    })
    .filter((x) => !soloOnly || x.r.solo_status !== "red")
    .filter((x) => !noWaitOnly || x.signal.color === "green")
    .filter((x) => !quickOnly || x.quick)
    .filter((x) => !catFilter || foodGroup(x.r.category) === catFilter)
    .sort(
      (a, b) =>
        RANK[a.signal.color] - RANK[b.signal.color] ||
        (a.r.walk_min ?? 999) - (b.r.walk_min ?? 999),
    );

  const filledCount = restaurants.filter(
    (r) => effectiveSolo(r, soloReports) !== null,
  ).length;

  const points: MapPoint[] = items
    .map((x) => {
      // DB 좌표 우선, 없으면 데모 좌표 폴백
      const coord: [number, number] | null =
        x.r.lat != null && x.r.lng != null
          ? [x.r.lat, x.r.lng]
          : (DEMO_COORDS[x.r.name] ?? null);
      if (!coord) return null;
      return {
        id: x.r.id,
        name: x.r.name,
        lat: coord[0],
        lng: coord[1],
        color: x.signal.color,
        label: x.signal.label,
        quick: x.quick,
      };
    })
    .filter((p): p is MapPoint => p !== null);

  const listItems: ListItem[] = items.map(({ r, signal, wait, quick }) => {
    const coord =
      r.lat != null && r.lng != null ? [r.lat, r.lng] : (DEMO_COORDS[r.name] ?? null);
    return {
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
      quick,
      lat: coord ? coord[0] : null,
      lng: coord ? coord[1] : null,
    };
  });

  // solo_reports 테이블이 아직 없어도(마이그레이션 전) 페이지는 동작하게 loadError에서 제외
  const loadError = restaurantsRes.error?.message ?? reportsRes.error?.message;
  const pct = restaurants.length ? Math.round((filledCount / restaurants.length) * 100) : 0;

  // 이달의 외식왕 랭킹 (로그인 기여만: device_id가 profiles.id인 것). 제보 +3, 채팅 +1.
  let ranking: RankEntry[] = [];
  let monthLabel = "";
  if (rankingView) {
    const kst = new Date(now.getTime() + 9 * 3600 * 1000);
    monthLabel = `${kst.getUTCMonth() + 1}월`;
    const monthStartMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600 * 1000;
    const monthStartIso = new Date(monthStartMs).toISOString();
    const [waitMonthRes, msgMonthRes, profilesRes] = await Promise.all([
      supabase.from("wait_reports").select("device_id").gte("created_at", monthStartIso),
      supabase.from("messages").select("device_id").gte("created_at", monthStartIso),
      supabase.from("profiles").select("id,nickname"),
    ]);
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
    ranking = [...score.entries()]
      .map(([id, s]) => ({ nickname: nick.get(id) as string, score: s }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  return (
    <div>
      <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold tracking-tight">혼밥 신호등</h1>
          <AuthButton />
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          문정동 · 점심 혼밥 상태 · 지금 {nowLabel(now)} 기준
        </p>

        <div className="mt-3 flex gap-1 rounded-full bg-slate-100 p-1 text-center text-sm font-semibold">
          <Link
            href={hrefFor({ map: false, solo: soloOnly, nowait: noWaitOnly, quick: quickOnly, cat: catFilter })}
            className={`flex-1 rounded-full py-1.5 ${!mapView && !rankingView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            목록
          </Link>
          <Link
            href={hrefFor({ map: true, solo: soloOnly, nowait: noWaitOnly, quick: quickOnly, cat: catFilter })}
            className={`flex-1 rounded-full py-1.5 ${mapView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            지도
          </Link>
          <Link
            href="/?view=ranking"
            className={`flex-1 rounded-full py-1.5 ${rankingView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            랭킹
          </Link>
        </div>

        {!rankingView && (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterChip active={soloOnly} href={hrefFor({ map: mapView, solo: !soloOnly, nowait: noWaitOnly, quick: quickOnly, cat: catFilter })}>
                혼밥 가능만
              </FilterChip>
              <FilterChip active={noWaitOnly} href={hrefFor({ map: mapView, solo: soloOnly, nowait: !noWaitOnly, quick: quickOnly, cat: catFilter })}>
                웨이팅 없는 곳만
              </FilterChip>
              <FilterChip active={quickOnly} href={hrefFor({ map: mapView, solo: soloOnly, nowait: noWaitOnly, quick: !quickOnly, cat: catFilter })}>
                빨리 나와요
              </FilterChip>
            </div>

            {categories.length > 1 && (
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                <FilterChip active={!catFilter} href={hrefFor({ map: mapView, solo: soloOnly, nowait: noWaitOnly, quick: quickOnly, cat: "" })}>
                  전체
                </FilterChip>
                {categories.map((c) => (
                  <FilterChip
                    key={c}
                    active={catFilter === c}
                    href={hrefFor({ map: mapView, solo: soloOnly, nowait: noWaitOnly, quick: quickOnly, cat: catFilter === c ? "" : c })}
                  >
                    {c}
                  </FilterChip>
                ))}
              </div>
            )}
          </>
        )}
      </header>

      {rankingView ? (
        <Ranking entries={ranking} monthLabel={monthLabel} />
      ) : (
        <>
          <div className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span>문정동 혼밥 지도, 같이 만들어요</span>
              <span>{filledCount} / {restaurants.length}곳</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-700">
              회색은 아직 아무도 안 알려준 집이에요. 가보셨다면 상세에서 3초만 알려주세요.
            </p>
          </div>

          {loadError ? (
            <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
              데이터를 불러오지 못했어요: {loadError}
            </p>
          ) : (
            <>
              {mapView && (
                <div className="mb-3">
                  <MapView points={points} height="46vh" />
                  {points.length === 0 && (
                    <p className="mt-2 text-center text-xs text-slate-400">
                      아직 좌표 데이터가 없어 핀이 안 보여요 (지도는 자유롭게 움직여볼 수 있어요).
                    </p>
                  )}
                </div>
              )}
              <RestaurantList items={listItems} mapView={mapView} />
            </>
          )}
        </>
      )}

      <div className="mt-6 pb-4 text-center">
        <Link href="/suggest" className="text-xs font-semibold text-slate-500 underline">
          가게 추가·기능 제안하기
        </Link>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-300">
          혼밥·웨이팅 정보는 이용자 제보로 함께 채워가고 있어요
        </p>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-600 ring-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}
