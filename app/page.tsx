import Link from "next/link";

import { effectiveSolo, getSignal, getWaitInfo, isQuickMeal } from "@/lib/signal";
import { DEMO_COORDS } from "@/lib/demoCoords";
import { createServerClient } from "@/lib/supabaseServer";
import { HeartIcon } from "@/app/icons";
import MapView from "@/app/MapView";
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
  const catFilter = typeof sp.cat === "string" ? sp.cat : "";

  const supabase = createServerClient();
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

  const [restaurantsRes, reportsRes, soloRes, heartsRes] = await Promise.all([
    supabase.from("restaurants").select("*"),
    supabase.from("wait_reports").select("*").gt("created_at", cutoffIso),
    supabase.from("solo_reports").select("*"),
    supabase.from("hearts").select("restaurant_id"),
  ]);

  const restaurants = (restaurantsRes.data ?? []) as Restaurant[];
  const reports = (reportsRes.data ?? []) as WaitReport[];
  const soloReports = (soloRes.data ?? []) as SoloReport[];
  const heartRows = (heartsRes.data ?? []) as { restaurant_id: string }[];
  const heartCount = new Map<string, number>();
  for (const h of heartRows)
    heartCount.set(h.restaurant_id, (heartCount.get(h.restaurant_id) ?? 0) + 1);

  const categories = Array.from(new Set(restaurants.map((r) => r.category))).sort(
    (a, b) => a.localeCompare(b, "ko"),
  );

  const items = restaurants
    .map((raw) => {
      // 크라우드소싱 반영: 시드 solo_status 없으면 제보로 채운다
      const r: Restaurant = { ...raw, solo_status: effectiveSolo(raw, soloReports) };
      const own = reports.filter((x) => x.restaurant_id === r.id);
      const signal = getSignal(r, own, now);
      const wait = getWaitInfo(r, own, now);
      const quick = isQuickMeal(r);
      return { r, signal, wait, quick, hearts: heartCount.get(r.id) ?? 0 };
    })
    .filter((x) => !soloOnly || x.r.solo_status !== "red")
    .filter((x) => !noWaitOnly || x.signal.color === "green")
    .filter((x) => !quickOnly || x.quick)
    .filter((x) => !catFilter || x.r.category === catFilter)
    .sort(
      (a, b) =>
        RANK[a.signal.color] - RANK[b.signal.color] ||
        (a.r.walk_min ?? 999) - (b.r.walk_min ?? 999),
    );

  const filledCount = restaurants.filter(
    (r) => effectiveSolo(r, soloReports) !== null,
  ).length;

  const topHearted = restaurants
    .map((r) => ({ r, hearts: heartCount.get(r.id) ?? 0 }))
    .filter((x) => x.hearts > 0)
    .sort((a, b) => b.hearts - a.hearts)
    .slice(0, 5);

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

  const listItems: ListItem[] = items.map(({ r, signal, wait, quick, hearts }) => {
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
      hearts,
      lat: coord ? coord[0] : null,
      lng: coord ? coord[1] : null,
    };
  });

  // solo_reports 테이블이 아직 없어도(마이그레이션 전) 페이지는 동작하게 loadError에서 제외
  const loadError = restaurantsRes.error?.message ?? reportsRes.error?.message;
  const pct = restaurants.length ? Math.round((filledCount / restaurants.length) * 100) : 0;

  return (
    <div>
      <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold tracking-tight">혼밥 신호등</h1>
          <span className="text-xs font-medium text-slate-500">
            지금 {nowLabel(now)} 기준
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">문정동 · 점심 혼밥 상태</p>

        <div className="mt-3 flex gap-1 rounded-full bg-slate-100 p-1 text-center text-sm font-semibold">
          <Link
            href={hrefFor({ map: false, solo: soloOnly, nowait: noWaitOnly, quick: quickOnly, cat: catFilter })}
            className={`flex-1 rounded-full py-1.5 ${!mapView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            목록
          </Link>
          <Link
            href={hrefFor({ map: true, solo: soloOnly, nowait: noWaitOnly, quick: quickOnly, cat: catFilter })}
            className={`flex-1 rounded-full py-1.5 ${mapView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            지도
          </Link>
        </div>

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
      </header>

      <div className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3">
        <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
          <span>문정동 혼밥 지도, 같이 만들어요</span>
          <span>{filledCount} / {restaurants.length}곳</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-700">
          회색 신호등은 아직 아무도 안 알려준 집이에요. 가보셨다면 상세에서 3초만 탭해주세요 🙏
        </p>
      </div>

      {topHearted.length > 0 && (
        <div className="mb-3">
          <h2 className="mb-2 text-sm font-bold text-slate-800">이 주변 인기 (저장 많은 곳)</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {topHearted.map(({ r, hearts }, i) => (
              <Link
                key={r.id}
                href={`/r/${r.id}`}
                className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm"
              >
                <span className="text-sm font-bold text-slate-300">{i + 1}</span>
                <span className="max-w-[9rem] truncate text-sm font-semibold text-slate-800">
                  {r.name}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-500">
                  <HeartIcon filled className="h-3 w-3" />
                  {hearts}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

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

      <p className="mt-6 pb-4 text-center text-[11px] leading-relaxed text-slate-300">
        데모 데이터 · 혼밥/웨이팅 정보는 실제 조사값이 아닙니다
      </p>
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
