"use client";

import { useEffect, useRef } from "react";

import type { SignalColor } from "@/lib/types";
import { LocationIcon } from "@/app/icons";

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color: SignalColor;
  label: string;
  quick: boolean;
}

const COLOR: Record<SignalColor, string> = {
  green: "#10b981",
  yellow: "#fbbf24",
  red: "#f43f5e",
  gray: "#94a3b8",
};

declare global {
  interface Window {
    kakao: any;
  }
}

function loadSdk(appkey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.MarkerClusterer) {
      resolve(window.kakao);
      return;
    }
    const ready = () => window.kakao.maps.load(() => resolve(window.kakao));
    const existing = document.getElementById("kakao-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", ready);
      return;
    }
    const s = document.createElement("script");
    s.id = "kakao-sdk";
    s.async = true;
    // clusterer 라이브러리 포함 (마커 뭉침 해결)
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false&libraries=clusterer`;
    s.onload = ready;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// 마커 이미지. 저장한 곳은 작은 하트, 그 외는 신호등 색 원.
function markerSvg(color: string, saved: boolean): string {
  const svg = saved
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#f43f5e" stroke="#fff" stroke-width="1.5"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="7" fill="${color}" stroke="#fff" stroke-width="2.5"/></svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

const CLUSTER_STYLES = [
  {
    width: "34px", height: "34px", lineHeight: "34px", fontSize: "13px",
    background: "rgba(15,23,42,.85)", borderRadius: "17px",
  },
  {
    width: "42px", height: "42px", lineHeight: "42px", fontSize: "14px",
    background: "rgba(244,63,94,.9)", borderRadius: "21px",
  },
  {
    width: "52px", height: "52px", lineHeight: "52px", fontSize: "15px",
    background: "rgba(244,63,94,.95)", borderRadius: "26px",
  },
].map((s) => ({
  ...s,
  color: "#fff", textAlign: "center" as const, fontWeight: "700",
  border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,.3)",
}));

export default function KakaoMap({
  points,
  height = "72vh",
}: {
  points: MapPoint[];
  height?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const kakaoRef = useRef<any>(null);
  const myOverlayRef = useRef<any>(null);

  function locate(pan: boolean) {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!kakao || !map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        if (myOverlayRef.current) myOverlayRef.current.setMap(null);
        const el = document.createElement("div");
        el.innerHTML = `<div class="honbab-mypos"></div>`;
        myOverlayRef.current = new kakao.maps.CustomOverlay({
          position: loc, content: el, zIndex: 5,
        });
        myOverlayRef.current.setMap(map);
        if (pan) map.panTo(loc);
      },
      () => {
        if (pan) alert("위치 권한을 허용해주세요");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key || !ref.current) return;

    let saved = new Set<string>();
    try {
      saved = new Set(JSON.parse(localStorage.getItem("honbab_saved") || "[]"));
    } catch {
      /* noop */
    }

    let clusterer: any;
    loadSdk(key)
      .then((kakao) => {
        if (!ref.current) return;
        kakaoRef.current = kakao;
        const center = points.length
          ? new kakao.maps.LatLng(
              points.reduce((s, p) => s + p.lat, 0) / points.length,
              points.reduce((s, p) => s + p.lng, 0) / points.length,
            )
          : new kakao.maps.LatLng(37.4855, 127.1195);
        const map = new kakao.maps.Map(ref.current, { center, level: 3 });
        map.setMinLevel(1); // 최대 상세까지 확대 허용
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        mapRef.current = map;
        const iw = new kakao.maps.InfoWindow({ removable: true });

        const markers = points.map((p) => {
          const isSaved = saved.has(p.id);
          const image = new kakao.maps.MarkerImage(
            markerSvg(COLOR[p.color], isSaved),
            new kakao.maps.Size(isSaved ? 20 : 24, isSaved ? 20 : 24),
          );
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(p.lat, p.lng),
            image,
            title: p.name,
          });
          kakao.maps.event.addListener(marker, "click", () => {
            iw.setContent(
              `<div style="padding:8px 10px;min-width:140px;font-size:12px">
                 <div style="font-weight:700">${p.name}</div>
                 <div style="color:${COLOR[p.color]};font-weight:600;margin:2px 0 6px">${p.label}</div>
                 <a href="/r/${p.id}" style="color:#0f172a;font-weight:600">상세 보기</a>
               </div>`,
            );
            iw.open(map, marker);
          });
          return marker;
        });

        clusterer = new kakao.maps.MarkerClusterer({
          map,
          markers,
          averageCenter: true,
          minLevel: 3,
          gridSize: 45,
          calculator: [10, 30],
          styles: CLUSTER_STYLES,
        });

        // 지도에 보이는 영역(bounds) 안 식당 id를 리스트에 알림
        const syncList = () => {
          const bounds = map.getBounds();
          const ids = points
            .filter((p) => bounds.contain(new kakao.maps.LatLng(p.lat, p.lng)))
            .map((p) => p.id);
          window.dispatchEvent(new CustomEvent("honbab-mapbounds", { detail: ids }));
        };
        kakao.maps.event.addListener(map, "idle", syncList);
        syncList();

        // 이미 위치를 허용한 경우에만 자동 표시 → 매번 권한 팝업 뜨는 것 방지
        // (아직 결정 안 함/거부면 안 물어보고, 사용자가 '내 위치' 버튼 누를 때만 요청)
        navigator.permissions
          ?.query({ name: "geolocation" as PermissionName })
          .then((p) => {
            if (p.state === "granted") locate(false);
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      if (clusterer) clusterer.clear();
    };
  }, [points]);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={ref}
        style={{ height, width: "100%", borderRadius: "1rem", overflow: "hidden" }}
      />
      <button
        type="button"
        onClick={() => locate(true)}
        aria-label="내 위치로"
        className="absolute bottom-3 right-3 z-[1] flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-slate-200 transition active:scale-90"
      >
        <LocationIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
