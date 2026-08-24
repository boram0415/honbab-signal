import type { Restaurant, SignalColor, SoloStatus, WaitLevel, WaitReport } from "./types";

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
  green: "1인석 있음",
  yellow: "혼자 가능(눈치)",
  red: "1인 입장 어려움",
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

function parseHm(value: string): number {
  const [h, m] = value.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
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
  const { day, minutes } = getKst(now);

  if (restaurant.closed_days.includes(day)) {
    return { color: "gray", label: "오늘 휴무", reason: "오늘은 쉬는 날이에요" };
  }

  const open = parseHm(restaurant.open_time);
  const close = parseHm(restaurant.close_time);
  if (minutes < open || minutes >= close) {
    return { color: "gray", label: "영업 전·후", reason: "지금은 영업시간이 아니에요" };
  }

  const { level } = getWaitInfo(restaurant, reports, now);
  const solo = restaurant.solo_status;
  const color: SoloStatus = level === null ? solo : worse(solo, waitColor(level));

  return {
    color,
    label: LABELS[color],
    reason: `${SOLO_REASON[solo]} · ${waitReason(level)}`,
  };
}

// 혼자 빨리 먹고 나오기 좋은가 (사무직 점심용 속도 추정)
// 빠른 카테고리(국밥/분식/면류 등)면 그 자체로, 아니면 키오스크+셀프바 조합으로 판정
const QUICK_CATEGORY =
  /국밥|국수|칼국수|냉면|분식|김밥|우동|라멘|라면|덮밥|돈까스|마라탕|샐러드|죽|백반|도시락|쌀국수|버거|샌드/;

export function isQuickMeal(restaurant: Restaurant): boolean {
  let score = 0;
  if (QUICK_CATEGORY.test(restaurant.category)) score += 2;
  if (restaurant.order_type === "kiosk") score += 1;
  if (restaurant.self_bar) score += 1;
  return score >= 2;
}
