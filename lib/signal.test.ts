import { describe, expect, it } from "vitest";

import { effectiveSolo, effectiveSpeed, getSignal, getWaitInfo } from "./signal";
import type { Restaurant, SoloReport, SoloStatus, SpeedLevel, SpeedReport, WaitLevel, WaitReport } from "./types";

// 기준 시각: 2026-08-21(금) 12:00 KST = 03:00 UTC
const FRI_1200 = new Date("2026-08-21T03:00:00Z");
// 영업 중이지만 점심 기본값 시간대 밖: 14:00 KST
const FRI_1400 = new Date("2026-08-21T05:00:00Z");

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "r1",
    name: "테스트식당",
    category: "한식",
    walk_min: 5,
    price_min: 8000,
    price_max: 12000,
    solo_status: "green",
    solo_note: null,
    wait_1200: null,
    wait_1230: null,
    order_type: "kiosk",
    self_bar: false,
    noise_level: 2,
    staff_talk: 2,
    signature: null,
    closed_days: [],
    open_time: "11:00",
    close_time: "21:00",
    kakaomap_url: null,
    photo_url: null,
    lat: null,
    lng: null,
    updated_at: "2026-08-21T00:00:00Z",
    ...overrides,
  };
}

function report(level: Exclude<WaitLevel, null>, agoMin: number, now: Date): WaitReport {
  return {
    id: `rep-${level}-${agoMin}`,
    restaurant_id: "r1",
    level,
    device_id: "dev",
    created_at: new Date(now.getTime() - agoMin * 60 * 1000).toISOString(),
  };
}

describe("getSignal — 3.3 판정표 (더 나쁜 쪽 채택)", () => {
  // 웨이팅은 유효 제보(방금 제출)로 고정, 정보없음은 14:00·제보없음으로 만든다.
  const cases: Array<[SoloStatus, WaitLevel, string]> = [
    ["green", 0, "green"],
    ["green", 5, "yellow"],
    ["green", 15, "red"],
    ["green", null, "green"],
    ["yellow", 0, "yellow"],
    ["yellow", 5, "yellow"],
    ["yellow", 15, "red"],
    ["yellow", null, "yellow"],
    ["red", 0, "red"],
    ["red", 5, "red"],
    ["red", 15, "red"],
    ["red", null, "red"],
  ];

  for (const [solo, wait, expected] of cases) {
    it(`혼밥 ${solo} × 웨이팅 ${wait ?? "정보없음"} → ${expected}`, () => {
      if (wait === null) {
        const r = makeRestaurant({ solo_status: solo });
        expect(getSignal(r, [], FRI_1400).color).toBe(expected);
      } else {
        const r = makeRestaurant({ solo_status: solo });
        expect(getSignal(r, [report(wait, 1, FRI_1200)], FRI_1200).color).toBe(expected);
      }
    });
  }

  it("red는 웨이팅 0이어도 절대 green이 아니다", () => {
    const r = makeRestaurant({ solo_status: "red" });
    expect(getSignal(r, [report(0, 1, FRI_1200)], FRI_1200).color).toBe("red");
  });

  it("웨이팅 정보 없음이면 라벨에 표기된다", () => {
    const r = makeRestaurant({ solo_status: "green" });
    expect(getSignal(r, [], FRI_1400).reason).toContain("웨이팅 정보 없음");
  });
});

describe("시간대 경계 (기본값)", () => {
  // wait_1200=0(green), wait_1230=15(red)로 두어 경계에서 색이 바뀌게 함
  const r = makeRestaurant({ wait_1200: 0, wait_1230: 15 });
  const at = (hhmmUtc: string) => new Date(`2026-08-21T${hhmmUtc}:00Z`);

  it("11:29 → 기본값 시간대 밖 → 정보없음(green)", () => {
    expect(getSignal(r, [], at("02:29")).color).toBe("green");
    expect(getSignal(r, [], at("02:29")).reason).toContain("정보 없음");
  });
  it("11:30 → wait_1200 적용", () => {
    expect(getSignal(r, [], at("02:30")).reason).toContain("웨이팅 없음");
  });
  it("12:14 → 여전히 wait_1200", () => {
    expect(getSignal(r, [], at("03:14")).reason).toContain("웨이팅 없음");
  });
  it("12:15 → wait_1230으로 전환(red)", () => {
    expect(getSignal(r, [], at("03:15")).color).toBe("red");
  });
  it("13:00 → 여전히 wait_1230", () => {
    expect(getSignal(r, [], at("04:00")).color).toBe("red");
  });
  it("13:01 → 기본값 시간대 밖 → 정보없음(green)", () => {
    expect(getSignal(r, [], at("04:01")).color).toBe("green");
  });
});

describe("제보 90분 유효 경계", () => {
  const r = makeRestaurant({ solo_status: "green", wait_1200: null });
  it("89분 전 제보는 유효 → red", () => {
    expect(getSignal(r, [report(15, 89, FRI_1200)], FRI_1200).color).toBe("red");
  });
  it("90분 전 제보는 만료(strict >) → green", () => {
    expect(getSignal(r, [report(15, 90, FRI_1200)], FRI_1200).color).toBe("green");
  });
  it("91분 전 제보는 만료 → green", () => {
    expect(getSignal(r, [report(15, 91, FRI_1200)], FRI_1200).color).toBe("green");
  });
});

describe("최근 3건의 최댓값", () => {
  it("4번째(가장 오래된) 제보는 제외된다", () => {
    const r = makeRestaurant({ solo_status: "green" });
    const reports: WaitReport[] = [
      report(0, 1, FRI_1200),
      report(0, 2, FRI_1200),
      report(0, 3, FRI_1200),
      report(15, 4, FRI_1200), // 최근 3건 밖 → 무시되어야 함
    ];
    expect(getSignal(r, reports, FRI_1200).color).toBe("green");
  });
  it("최근 3건 안의 최댓값을 채택한다", () => {
    const r = makeRestaurant({ solo_status: "green" });
    const reports: WaitReport[] = [
      report(0, 1, FRI_1200),
      report(15, 2, FRI_1200),
      report(5, 3, FRI_1200),
    ];
    expect(getSignal(r, reports, FRI_1200).color).toBe("red");
  });
});

describe("gray 판정", () => {
  it("휴무 요일이면 gray", () => {
    const r = makeRestaurant({ closed_days: [5] }); // 금요일 휴무
    expect(getSignal(r, [], FRI_1200).color).toBe("gray");
  });
  it("영업시간 밖이어도 혼밥 색은 보인다 (gray 아님)", () => {
    const r = makeRestaurant({ solo_status: "green", open_time: "11:00", close_time: "21:00" });
    const at2200 = new Date("2026-08-21T13:00:00Z"); // 22:00 KST
    expect(getSignal(r, [], at2200).color).toBe("green");
  });
});

describe("getWaitInfo — 웨이팅 신뢰도(근거·개수·신선도)", () => {
  it("유효 제보가 있으면 source=report, 개수와 신선도 반환", () => {
    const r = makeRestaurant();
    const info = getWaitInfo(r, [report(5, 3, FRI_1200), report(15, 10, FRI_1200)], FRI_1200);
    expect(info.source).toBe("report");
    expect(info.level).toBe(15);
    expect(info.reportCount).toBe(2);
    expect(info.freshestMin).toBe(3);
  });
  it("제보 없고 점심시간대면 source=default", () => {
    const r = makeRestaurant({ wait_1200: 5 });
    const info = getWaitInfo(r, [], FRI_1200);
    expect(info.source).toBe("default");
    expect(info.level).toBe(5);
    expect(info.reportCount).toBe(0);
  });
  it("제보 없고 시간대 밖이면 source=none", () => {
    const info = getWaitInfo(makeRestaurant(), [], FRI_1400);
    expect(info.source).toBe("none");
    expect(info.level).toBeNull();
  });
});

describe("미조사(solo_status null) 판정", () => {
  it("solo_status가 null이면 gray '정보 없음'", () => {
    const r = makeRestaurant({ solo_status: null });
    const s = getSignal(r, [], FRI_1200);
    expect(s.color).toBe("gray");
    expect(s.label).toBe("정보 없음");
  });
});

describe("effectiveSolo — 혼밥 크라우드소싱 집계", () => {
  const soloReport = (status: SoloStatus, rid = "r1"): SoloReport => ({
    id: `s-${status}-${Math.round(Math.random() * 1e6)}`,
    restaurant_id: rid,
    status,
    device_id: "d",
    created_at: FRI_1200.toISOString(),
  });
  it("시드 값이 있으면 그걸 우선", () => {
    expect(effectiveSolo(makeRestaurant({ solo_status: "yellow" }), [soloReport("red")])).toBe("yellow");
  });
  it("시드 값 없으면 제보 최다득표", () => {
    const r = makeRestaurant({ solo_status: null });
    const reports = [soloReport("green"), soloReport("green"), soloReport("red")];
    expect(effectiveSolo(r, reports)).toBe("green");
  });
  it("시드 값도 제보도 없으면 null(미조사)", () => {
    expect(effectiveSolo(makeRestaurant({ solo_status: null }), [])).toBeNull();
  });
});

describe("effectiveSpeed — 음식 속도 가중평균", () => {
  const sr = (level: SpeedLevel): SpeedReport => ({
    id: "x",
    restaurant_id: "r1",
    level,
    device_id: "d",
    created_at: "",
  });
  it("제보 없으면 null", () => {
    expect(effectiveSpeed("r1", [])).toBeNull();
  });
  it("빠름 우세면 fast", () => {
    expect(effectiveSpeed("r1", [sr("fast"), sr("fast"), sr("medium")])?.level).toBe("fast");
  });
  it("느림 우세면 slow", () => {
    expect(effectiveSpeed("r1", [sr("slow"), sr("slow"), sr("medium")])?.level).toBe("slow");
  });
  it("다른 식당 제보는 무시", () => {
    expect(effectiveSpeed("r2", [sr("fast")])).toBeNull();
  });
});
