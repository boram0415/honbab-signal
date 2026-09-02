import Link from "next/link";
import { notFound } from "next/navigation";

import { ADDRESSES } from "@/lib/addresses";
import { DEMO_COORDS } from "@/lib/demoCoords";
import { PHONES } from "@/lib/phones";
import { effectiveSolo, effectiveSpeed, getSignal, getSummary, getWaitInfo, SPEED_TEXT } from "@/lib/signal";
import { createServerClient } from "@/lib/supabaseServer";
import { CHIP, TrafficLight } from "@/app/TrafficLight";
import { Thumb } from "@/app/Thumb";
import { HeartButton } from "@/app/HeartButton";
import type { Restaurant, SoloReport, SoloStatus, SpeedReport, WaitReport } from "@/lib/types";

import ChatBox from "./ChatBox";
import ReportButtons from "./ReportButtons";
import SoloReportButtons from "./SoloReportButtons";
import SpeedReportButtons from "./SpeedReportButtons";

export const dynamic = "force-dynamic";

const DAY = ["일", "월", "화", "수", "목", "금", "토"];
const SOLO_TEXT: Record<SoloStatus, string> = {
  green: "혼자 가도 편해요",
  yellow: "혼자 가능 (약간 눈치)",
  red: "혼밥 어려움",
};
const ORDER_TEXT: Record<string, string> = {
  kiosk: "키오스크",
  table_tablet: "테이블 태블릿",
  staff_call: "직원 주문",
};
const NOISE = { 1: "조용", 2: "보통", 3: "시끌" } as const;
const TALK = { 1: "무관심", 2: "보통", 3: "말 많음" } as const;

function won(n: number) {
  return n.toLocaleString("ko-KR");
}
function hhmm(t: string) {
  return (t || "").slice(0, 5);
}
function priceText(r: Restaurant) {
  return r.price_min != null && r.price_max != null
    ? `${won(r.price_min)}~${won(r.price_max)}원`
    : "정보 없음";
}

export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();
  const now = new Date();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!restaurant) notFound();

  const [{ data: reportData }, { data: soloData }, { data: speedData }] = await Promise.all([
    supabase.from("wait_reports").select("*").eq("restaurant_id", id),
    supabase.from("solo_reports").select("*").eq("restaurant_id", id),
    supabase.from("speed_reports").select("*").eq("restaurant_id", id),
  ]);
  const reports = (reportData ?? []) as WaitReport[];
  const soloReports = (soloData ?? []) as SoloReport[];
  const speedReports = (speedData ?? []) as SpeedReport[];
  const speed = effectiveSpeed(id, speedReports);

  // 크라우드소싱 반영
  const raw = restaurant as Restaurant;
  const r: Restaurant = { ...raw, solo_status: effectiveSolo(raw, soloReports, now) };
  const isMissing = r.solo_status == null;

  const signal = getSignal(r, reports, now);
  const wait = getWaitInfo(r, reports, now);
  const summary = getSummary(r);

  const waitConfidence =
    wait.source === "report"
      ? `실시간 제보 기준 · ${wait.reportCount}명 · 가장 최근 ${wait.freshestMin}분 전`
      : wait.source === "default"
        ? "평소 점심시간 기준 (추정)"
        : "웨이팅 정보 없음";

  const closed =
    r.closed_days.length > 0
      ? r.closed_days.map((d) => DAY[d]).join("·") + "요일"
      : "휴무 없음";

  const coord = DEMO_COORDS[r.name] ?? null;
  const phone = PHONES[r.name] ?? null;
  const kakaoDir = coord
    ? `https://map.kakao.com/link/to/${encodeURIComponent(r.name)},${coord[0]},${coord[1]}`
    : null;
  const naverDir = coord
    ? `https://map.naver.com/p/directions/-/${coord[1]},${coord[0]},${encodeURIComponent(r.name)}/-/car`
    : null;

  return (
    <div className="pb-24">
      <Link href="/" className="inline-block py-2 text-sm text-slate-500">
        ← 목록으로
      </Link>

      <div className="mt-1 flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-bold tracking-tight text-slate-900">{r.name}</h1>
        <HeartButton id={r.id} big />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {r.category}
        {r.walk_min != null ? ` · 도보 ${r.walk_min}분` : ""}
        {r.price_min != null && r.price_max != null
          ? ` · ${won(r.price_min)}~${won(r.price_max)}원`
          : ""}
      </p>
      {summary && (
        <p className="mt-2 text-[15px] font-semibold text-slate-800">“{summary}”</p>
      )}

      <Thumb url={r.photo_url} className="mt-3 h-48 w-full rounded-2xl" />

      {/* 큰 신호등 + 판정 이유 */}
      <section className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div role="img" aria-label={`신호등 ${signal.label}`} className="shrink-0">
          <TrafficLight color={signal.color} size="lg" />
        </div>
        <div>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${CHIP[signal.color]}`}
          >
            {signal.label}
          </span>
          <p className="mt-1.5 text-sm text-slate-600">{signal.reason}</p>
          {!isMissing && <p className="mt-1 text-xs text-slate-400">{waitConfidence}</p>}
        </div>
      </section>

      {phone && (
        <a
          href={`tel:${phone}`}
          className="mt-3 block rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 active:scale-[0.98]"
        >
          전화
        </a>
      )}
      {coord && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a
            href={kakaoDir!}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-slate-900 py-3 text-center text-sm font-semibold text-white active:scale-[0.98]"
          >
            카카오 길찾기
          </a>
          <a
            href={naverDir!}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 active:scale-[0.98]"
          >
            네이버 길찾기
          </a>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <a
          href={`https://map.naver.com/p/search/${encodeURIComponent(r.name + " 문정")}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-green-200 bg-green-50 py-3 text-center text-sm font-semibold text-green-700 active:scale-[0.98]"
        >
          네이버 리뷰
        </a>
        <a
          href={`https://map.kakao.com/?q=${encodeURIComponent(r.name + " 문정")}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-yellow-200 bg-yellow-50 py-3 text-center text-sm font-semibold text-yellow-800 active:scale-[0.98]"
        >
          카카오 리뷰
        </a>
      </div>

      {/* 혼밥 크라우드소싱 제보 (미조사면 강조) */}
      <section
        className={`mt-3 rounded-2xl border p-5 shadow-sm ${isMissing ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-white"}`}
      >
        {isMissing && (
          <p className="mb-3 text-sm leading-relaxed text-emerald-800">
            아직 아무도 안 알려준 집이에요. <br />
            가보셨다면 알려주세요 — 같은 점심을 고민하는 옆자리 동료에게 큰 힘이 됩니다.
          </p>
        )}
        <SoloReportButtons restaurantId={r.id} />
      </section>

      {/* 웨이팅 원탭 제보 — 혼밥 정보가 있을 때만 의미 있음 */}
      {!isMissing && (
        <section className="mt-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <ReportButtons restaurantId={r.id} />
        </section>
      )}

      {/* 음식 나오는 속도 (점심시간 제보 기반 가중평균) */}
      <section className="mt-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        {speed && (
          <p className="mb-3 text-sm text-slate-600">
            음식 속도: <b className="text-slate-900">{SPEED_TEXT[speed.level]}</b>{" "}
            <span className="text-xs text-slate-400">· 제보 {speed.count}명</span>
          </p>
        )}
        <SpeedReportButtons restaurantId={r.id} />
      </section>

      {/* 실시간 웨이팅 채팅 (미조사여도 물어볼 수 있게 항상 노출) */}
      <ChatBox restaurantId={r.id} />

      {/* 혼밥 정보 (값 있는 것만) */}
      {(r.solo_status || r.solo_note || r.order_type || r.self_bar) && (
        <Info title="혼밥 정보">
          {r.solo_status && <Row label="혼밥 난이도" value={SOLO_TEXT[r.solo_status]} />}
          {r.solo_note && <Row label="메모" value={r.solo_note} />}
          {r.order_type && <Row label="주문 방식" value={ORDER_TEXT[r.order_type]} />}
          {r.self_bar && <Row label="셀프바" value="있음 (물·반찬 셀프)" />}
        </Info>
      )}

      {/* 분위기 (값 있을 때만) */}
      {(r.noise_level || r.staff_talk) && (
        <Info title="분위기">
          {r.noise_level && <Row label="소음" value={NOISE[r.noise_level]} />}
          {r.staff_talk && <Row label="직원 말 걸기" value={TALK[r.staff_talk]} />}
        </Info>
      )}

      {/* 기본 정보 */}
      <Info title="기본 정보">
        {r.signature && <Row label="대표 메뉴" value={r.signature} />}
        {ADDRESSES[r.name] && <Row label="위치" value={ADDRESSES[r.name]} />}
        {r.price_min != null && r.price_max != null && (
          <Row label="가격" value={priceText(r)} />
        )}
        <Row label="영업시간" value={`${hhmm(r.open_time)}~${hhmm(r.close_time)}`} />
        <Row label="휴무" value={closed} />
      </Info>
    </div>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-sm font-bold text-slate-800">{title}</h2>
      <dl className="flex flex-col gap-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}
