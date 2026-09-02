import type {
  Restaurant,
  SignalColor,
  SoloReport,
  SoloStatus,
  SpeedLevel,
  SpeedReport,
  WaitLevel,
  WaitReport,
} from "./types";

export interface Signal {
  color: SignalColor;
  label: string;
  reason: string;
}

// 웨이팅이 어떻게 결정됐는지 + 신뢰도(제보 신선도/개수)
export interface WaitInfo {
  level: WaitLevel;
  source: "report" | "default" | "none"; // 실시간 제보 / 시간대 기본값 / 정보없음
  reportCount: number; // 유효 제보 수 (source=report일 때만 >0)
  freshestMin: number | null; // 가장 최근 제보 후 경과(분)
}

const RANK: Record<SoloStatus, number> = { green: 0, yellow: 1, red: 2 };

const LABELS: Record<SoloStatus, string> = {
  green: "혼밥 추천",
  yellow: "혼밥 가능",
  red: "지금은 붐빔",
};

const SOLO_REASON: Record<SoloStatus, string> = {
  green: "혼자 편해요",
  yellow: "혼자 가능(눈치)",
  red: "혼밥 어려움",
};

function waitReason(level: WaitLevel): string {
  if (level === 0) return "웨이팅 없음";
  if (level === 5) return "웨이팅 5~10분";
  if (level === 15) return "웨이팅 15분+";
  return "웨이팅 정보 없음";
}

function waitColor(level: Exclude<WaitLevel, null>): SoloStatus {
  if (level === 0) return "green";
  if (level === 5) return "yellow";
  return "red";
}

function worse(a: SoloStatus, b: SoloStatus): SoloStatus {
  return RANK[a] >= RANK[b] ? a : b;
}

// now(UTC 시각)를 한국시간 기준 요일(0=일~6=토)과 자정 기준 분으로 변환
function getKst(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekday: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute, 10);
  return { day: weekday[map.weekday], minutes: hour * 60 + minute };
}

// PRD 3.2: 유효 제보 최우선(최근 3건 최댓값), 없으면 시간대 기본값, 그 밖은 null
// + 어떤 근거로 나온 값인지(source)와 신뢰도(개수·신선도)를 함께 반환
export function getWaitInfo(
  restaurant: Restaurant,
  reports: WaitReport[],
  now: Date,
): WaitInfo {
  const cutoff = now.getTime() - 90 * 60 * 1000;
  const valid = reports
    .filter(
      (r) =>
        r.restaurant_id === restaurant.id &&
        new Date(r.created_at).getTime() > cutoff,
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  if (valid.length > 0) {
    const recent3 = valid.slice(0, 3);
    const level = Math.max(...recent3.map((r) => r.level)) as WaitLevel;
    const freshestMin = Math.floor(
      (now.getTime() - new Date(valid[0].created_at).getTime()) / 60000,
    );
    return { level, source: "report", reportCount: valid.length, freshestMin };
  }

  // 11:30~12:14 → wait_1200, 12:15~13:00 → wait_1230
  const { minutes } = getKst(now);
  let level: WaitLevel = null;
  if (minutes >= 690 && minutes <= 734) level = restaurant.wait_1200;
  else if (minutes >= 735 && minutes <= 780) level = restaurant.wait_1230;

  return {
    level,
    source: level === null ? "none" : "default",
    reportCount: 0,
    freshestMin: null,
  };
}

export function getSignal(
  restaurant: Restaurant,
  reports: WaitReport[],
  now: Date,
): Signal {
  const solo = restaurant.solo_status;
  if (solo == null) {
    // 미조사 — 아직 아무도 혼밥 정보를 안 알려준 집
    return { color: "gray", label: "정보 없음", reason: "아직 아무도 안 알려준 집이에요" };
  }

  const { day } = getKst(now);

  if (restaurant.closed_days.includes(day)) {
    return { color: "gray", label: "오늘 휴무", reason: "오늘은 쉬는 날이에요" };
  }

  // 영업시간 밖이어도 혼밥 색은 보여준다 (크라우드소싱 색이 밤에 가려지지 않게).
  const { level } = getWaitInfo(restaurant, reports, now);
  const color: SoloStatus = level === null ? solo : worse(solo, waitColor(level));

  return {
    color,
    label: LABELS[color],
    reason: `${SOLO_REASON[solo]} · ${waitReason(level)}`,
  };
}

// 크라우드소싱된 혼밥 제보에서 유효 solo_status를 뽑는다.
// 관리자/시드 값(restaurant.solo_status)이 있으면 그걸 우선, 없으면 제보 최다득표, 둘 다 없으면 null(미조사).
export function effectiveSolo(
  restaurant: Restaurant,
  soloReports: SoloReport[],
): SoloStatus | null {
  if (restaurant.solo_status != null) return restaurant.solo_status;
  const votes = soloReports.filter((s) => s.restaurant_id === restaurant.id);
  if (votes.length === 0) return null;
  const count: Record<SoloStatus, number> = { green: 0, yellow: 0, red: 0 };
  for (const v of votes) count[v.status] += 1;
  return (Object.keys(count) as SoloStatus[]).reduce((a, b) =>
    count[b] > count[a] ? b : a,
  );
}

// 음식 나오는 속도 제보(빠름/보통/오래)의 가중 평균 → 대표값. 제보 없으면 null.
export const SPEED_TEXT: Record<SpeedLevel, string> = {
  fast: "빨리 나와요",
  medium: "좀 오래 걸려요",
  slow: "20분 이상 걸려요",
};
const SPEED_VALUE: Record<SpeedLevel, number> = { fast: 1, medium: 2, slow: 3 };

export function effectiveSpeed(
  restaurantId: string,
  reports: SpeedReport[],
): { level: SpeedLevel; count: number } | null {
  const votes = reports.filter((r) => r.restaurant_id === restaurantId);
  if (votes.length === 0) return null;
  const avg = votes.reduce((s, v) => s + SPEED_VALUE[v.level], 0) / votes.length;
  const level: SpeedLevel = avg < 1.67 ? "fast" : avg <= 2.33 ? "medium" : "slow";
  return { level, count: votes.length };
}

// 우리 데이터(혼밥 상태 + 카테고리)로 자동 생성하는 한줄 요약. 미조사면 null.
export function getSummary(restaurant: Restaurant): string | null {
  const solo = restaurant.solo_status;
  if (solo == null) return null;
  const cat = restaurant.category;
  if (solo === "red") return `여럿이 가기 좋은 ${cat} · 혼밥은 어려운 편`;
  if (solo === "green") return `혼자 가기 편한 ${cat}`;
  return `혼자도 가능한 ${cat} · 약간 눈치`;
}
