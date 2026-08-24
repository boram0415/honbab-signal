import Link from "next/link";

import { getSignal, getWaitInfo, isQuickMeal } from "@/lib/signal";
import { createServerClient } from "@/lib/supabaseServer";
import { CHIP, TrafficLight } from "@/app/TrafficLight";
import type { Restaurant, SignalColor, WaitReport } from "@/lib/types";

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

function filterHref(solo: boolean, nowait: boolean, quick: boolean): string {
  const p = new URLSearchParams();
  if (solo) p.set("solo", "1");
  if (nowait) p.set("nowait", "1");
  if (quick) p.set("quick", "1");
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

  const supabase = createServerClient();
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

  const [restaurantsRes, reportsRes] = await Promise.all([
    supabase.from("restaurants").select("*"),
    supabase.from("wait_reports").select("*").gt("created_at", cutoffIso),
  ]);

  const restaurants = (restaurantsRes.data ?? []) as Restaurant[];
  const reports = (reportsRes.data ?? []) as WaitReport[];

  const items = restaurants
    .map((r) => {
      const own = reports.filter((x) => x.restaurant_id === r.id);
      const signal = getSignal(r, own, now);
      const wait = getWaitInfo(r, own, now);
      const quick = isQuickMeal(r);
      return { r, signal, wait, quick };
    })
    .filter((x) => !soloOnly || x.r.solo_status !== "red")
    .filter((x) => !noWaitOnly || x.signal.color === "green")
    .filter((x) => !quickOnly || x.quick)
    .sort(
      (a, b) =>
        RANK[a.signal.color] - RANK[b.signal.color] || a.r.walk_min - b.r.walk_min,
    );

  const loadError = restaurantsRes.error?.message ?? reportsRes.error?.message;

  return (
    <div>
      <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold tracking-tight">🚦 혼밥 신호등</h1>
          <span className="text-xs font-medium text-slate-500">
            지금 {nowLabel(now)} 기준
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">문정동 · 점심 혼밥 상태</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip active={soloOnly} href={filterHref(!soloOnly, noWaitOnly, quickOnly)}>
            혼밥 가능만
          </FilterChip>
          <FilterChip active={noWaitOnly} href={filterHref(soloOnly, !noWaitOnly, quickOnly)}>
            웨이팅 없는 곳만
          </FilterChip>
          <FilterChip active={quickOnly} href={filterHref(soloOnly, noWaitOnly, !quickOnly)}>
            ⚡ 빨리 먹기
          </FilterChip>
        </div>
      </header>

      {loadError ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          데이터를 불러오지 못했어요: {loadError}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-slate-400">
          조건에 맞는 식당이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map(({ r, signal, wait, quick }) => (
            <li key={r.id}>
              <Link
                href={`/r/${r.id}`}
                className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.99]"
              >
                <div role="img" aria-label={`신호등 ${signal.label}`} className="shrink-0">
                  <TrafficLight color={signal.color} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-semibold text-slate-900">{r.name}</h2>
                    {wait.source === "report" ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                        실시간 {wait.freshestMin}분 전
                      </span>
                    ) : wait.source === "default" ? (
                      <span className="shrink-0 rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                        평소 기준
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.category} · 도보 {r.walk_min}분 · {won(r.price_min)}~{won(r.price_max)}원
                  </p>

                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${CHIP[signal.color]}`}
                    >
                      {signal.label}
                    </span>
                    {quick && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                        ⚡ 빨리
                      </span>
                    )}
                    <span className="text-slate-500">{signal.reason}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-600 ring-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}
