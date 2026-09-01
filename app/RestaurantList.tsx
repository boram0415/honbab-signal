"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { SignalColor } from "@/lib/types";
import { CHIP, TrafficLight } from "@/app/TrafficLight";
import { HeartButton } from "@/app/HeartButton";
import { HeartIcon, LocationIcon } from "@/app/icons";

export interface ListItem {
  id: string;
  name: string;
  category: string;
  walkMin: number | null;
  priceMin: number | null;
  priceMax: number | null;
  color: SignalColor;
  label: string;
  reason: string;
  waitSource: "report" | "default" | "none";
  waitFreshestMin: number | null;
  quick: boolean;
  hearts: number;
  lat: number | null;
  lng: number | null;
}

const won = (n: number) => n.toLocaleString("ko-KR");

function meters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const k = 111320;
  const dy = (bLat - aLat) * k;
  const dx = (bLng - aLng) * k * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

function readSaved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem("honbab_saved") || "[]"));
  } catch {
    return new Set();
  }
}

export function RestaurantList({ items, mapView }: { items: ListItem[]; mapView: boolean }) {
  const [query, setQuery] = useState("");
  const [near, setNear] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    setSavedSet(readSaved());
    const onSaved = () => setSavedSet(readSaved());
    window.addEventListener("honbab-saved-changed", onSaved);
    const onBounds = (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail;
      setVisibleIds(new Set(ids));
    };
    window.addEventListener("honbab-mapbounds", onBounds);
    return () => {
      window.removeEventListener("honbab-saved-changed", onSaved);
      window.removeEventListener("honbab-mapbounds", onBounds);
    };
  }, []);

  function toggleNear() {
    if (near) {
      setNear(false);
      return;
    }
    if (myPos) {
      setNear(true);
      return;
    }
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setMyPos([pos.coords.latitude, pos.coords.longitude]);
        setNear(true);
      },
      () => alert("위치 권한을 허용해주세요"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((it) => {
      if (q && !`${it.name}${it.category}`.toLowerCase().includes(q)) return false;
      if (savedOnly && !savedSet.has(it.id)) return false;
      if (mapView && visibleIds && !visibleIds.has(it.id)) return false;
      return true;
    });
    if (near && myPos) {
      list = [...list].sort((a, b) => {
        const da = a.lat != null && a.lng != null ? meters(myPos[0], myPos[1], a.lat, a.lng) : Infinity;
        const db = b.lat != null && b.lng != null ? meters(myPos[0], myPos[1], b.lat, b.lng) : Infinity;
        return da - db;
      });
    }
    return list;
  }, [items, query, savedOnly, savedSet, near, myPos, mapView, visibleIds]);

  return (
    <div>
      {/* 검색 + 정렬/필터 */}
      <div className="mb-2 flex flex-col gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="가게 이름·종류 검색"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleNear}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${near ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"}`}
          >
            <LocationIcon className="h-3.5 w-3.5" />
            가까운 순
          </button>
          <button
            type="button"
            onClick={() => setSavedOnly((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${savedOnly ? "bg-rose-500 text-white ring-rose-500" : "bg-white text-slate-600 ring-slate-200"}`}
          >
            <HeartIcon filled className="h-3.5 w-3.5" />
            저장
          </button>
          <span className="ml-auto self-center text-xs font-semibold text-slate-400">
            {mapView ? `지도 영역 ${shown.length}곳` : `${shown.length}곳`}
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-400">
          {savedOnly ? "저장한 곳이 없어요. 하트를 눌러 저장해보세요." : "조건에 맞는 식당이 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((it) => {
            const distM =
              near && myPos && it.lat != null && it.lng != null
                ? Math.round(meters(myPos[0], myPos[1], it.lat, it.lng))
                : null;
            return (
              <li key={it.id} className="relative">
                <Link
                  href={`/r/${it.id}`}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 pr-11 shadow-sm transition active:scale-[0.99]"
                >
                  <div role="img" aria-label={`신호등 ${it.label}`} className="shrink-0">
                    <TrafficLight color={it.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="truncate font-semibold text-slate-900">{it.name}</h2>
                      {it.waitSource === "report" ? (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                          실시간 {it.waitFreshestMin}분 전
                        </span>
                      ) : it.waitSource === "default" ? (
                        <span className="shrink-0 rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                          평소 기준
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {it.category}
                      {distM != null
                        ? ` · ${distM >= 1000 ? `${(distM / 1000).toFixed(1)}km` : `${distM}m`}`
                        : it.walkMin != null
                          ? ` · 도보 ${it.walkMin}분`
                          : ""}
                      {it.priceMin != null && it.priceMax != null
                        ? ` · ${won(it.priceMin)}~${won(it.priceMax)}원`
                        : ""}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${CHIP[it.color]}`}
                      >
                        {it.label}
                      </span>
                      {it.quick && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                          빨리 나옴
                        </span>
                      )}
                      <span className="text-slate-500">{it.reason}</span>
                    </p>
                  </div>
                </Link>
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center">
                  <HeartButton id={it.id} />
                  {it.hearts > 0 && (
                    <span className="text-[10px] font-bold text-rose-500">{it.hearts}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
