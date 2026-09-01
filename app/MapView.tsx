"use client";

import dynamic from "next/dynamic";

import type { MapPoint } from "./KakaoMap";

// 카카오맵은 window(SDK)에 의존 → 클라이언트에서만 로드
const KakaoMap = dynamic(() => import("./KakaoMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[72vh] items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
      지도 불러오는 중…
    </div>
  ),
});

export default function MapView({ points, height }: { points: MapPoint[]; height?: string }) {
  return <KakaoMap points={points} height={height} />;
}
