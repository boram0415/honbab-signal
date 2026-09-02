"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import type { SoloStatus } from "@/lib/types";
import { AuthButton } from "@/app/AuthButton";
import MapView from "@/app/MapView";
import { Ranking, type RankEntry } from "@/app/Ranking";
import { RestaurantList, type ListItem } from "@/app/RestaurantList";
import type { MapPoint } from "@/app/KakaoMap";

// 목록/지도 필터·정렬에 필요한 필드까지 포함(서버에서 전체·정렬해서 내려줌)
export type HomeItem = ListItem & { soloStatus: SoloStatus | null; group: string };

type View = "list" | "map" | "ranking";

export default function HomeClient({
  items,
  categories,
  ranking,
  monthLabel,
  filledCount,
  total,
  nowLabel,
}: {
  items: HomeItem[];
  categories: string[];
  ranking: RankEntry[];
  monthLabel: string;
  filledCount: number;
  total: number;
  nowLabel: string;
}) {
  // 탭·필터를 클라이언트 상태로 → 클릭 시 서버 왕복/재렌더 없이 즉시 전환
  const [view, setView] = useState<View>("list");
  const [soloOnly, setSoloOnly] = useState(false);
  const [noWaitOnly, setNoWaitOnly] = useState(false);
  const [cat, setCat] = useState("");

  const filtered = items.filter((it) => {
    if (soloOnly && it.soloStatus === "red") return false;
    if (noWaitOnly && it.color !== "green") return false;
    if (cat && it.group !== cat) return false;
    return true;
  });

  const points: MapPoint[] = filtered
    .filter((it) => it.lat != null && it.lng != null)
    .map((it) => ({
      id: it.id,
      name: it.name,
      lat: it.lat as number,
      lng: it.lng as number,
      color: it.color,
      label: it.label,
    }));

  const pct = total ? Math.round((filledCount / total) * 100) : 0;

  return (
    <div>
      <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon" alt="혼밥 신호등 로고" className="h-7 w-7 rounded-lg" />
            <h1 className="text-lg font-bold tracking-tight">혼밥 신호등</h1>
          </div>
          <AuthButton />
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          문정동 · 점심 혼밥 상태 · 지금 {nowLabel} 기준
        </p>

        <div className="mt-3 flex gap-1 rounded-full bg-slate-100 p-1 text-center text-sm font-semibold">
          {(["list", "map", "ranking"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex-1 rounded-full py-1.5 ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {v === "list" ? "목록" : v === "map" ? "지도" : "랭킹"}
            </button>
          ))}
        </div>

        {view !== "ranking" && (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={soloOnly} onClick={() => setSoloOnly((v) => !v)}>
                혼밥 가능만
              </Chip>
              <Chip active={noWaitOnly} onClick={() => setNoWaitOnly((v) => !v)}>
                웨이팅 없는 곳만
              </Chip>
            </div>

            {categories.length > 1 && (
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                <Chip active={!cat} onClick={() => setCat("")}>
                  전체
                </Chip>
                {categories.map((c) => (
                  <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? "" : c)}>
                    {c}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}
      </header>

      {view === "ranking" ? (
        <Ranking entries={ranking} monthLabel={monthLabel} />
      ) : (
        <>
          {view === "list" && (
            <div className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>문정동 혼밥 지도, 같이 만들어요</span>
                <span>
                  {filledCount} / {total}곳
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-700">
                회색은 아직 아무도 안 알려준 집이에요. 가보셨다면 상세에서 3초만 알려주세요.
              </p>
            </div>
          )}

          {view === "map" && (
            <div className="mb-3">
              <MapView points={points} height="46vh" />
              {points.length === 0 && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  아직 좌표 데이터가 없어 핀이 안 보여요 (지도는 자유롭게 움직여볼 수 있어요).
                </p>
              )}
            </div>
          )}
          <RestaurantList items={filtered} mapView={view === "map"} />
        </>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
        active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
