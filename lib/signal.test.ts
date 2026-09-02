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

describe("getSignal — 색은 혼밥 1차원 (웨이팅은 색에 안 섞임)", () => {
  // 색 = solo_status 그대로. 웨이팅이 뭐든 색은 안 바뀐다.
  const cases: Array<[SoloStatus, WaitLevel]> = [
    ["green", 0], ["green", 5], ["green", 15], ["green", null],
    ["yellow", 0], ["yellow", 5], ["yellow", 15], ["yellow", null],
    ["red", 0], ["red", 5], ["red", 15], ["red", null],
  ];
  for (const [solo, wait] of cases) {
    it(`혼밥 ${solo} × 웨이팅 ${wait ?? "정보없음"} → 색 ${solo}`, () => {
      const r = makeRestaurant({ solo_status: solo });
      if (wait === null) {
        expect(getSignal(r, [], FRI_1400).color).toBe(solo);
      } else {
        expect(getSignal(r, [report(wait, 1, FRI_1200)], FRI_1200).color).toBe(solo);
      }
    });
  }

  it("웨이팅 붐빔이어도 혼밥 green이면 색은 green (배지로만 표시)", () => {
    const r = makeRestaurant({ solo_status: "green" });
    expect(getSignal(r, [report(15, 1, FRI_1200)], FRI_1200).color).toBe("green");
  });

  it("웨이팅 문구는 reason에 남는다", () => {
    const r = makeRestaurant({ solo_status: "green" });
    expect(getSignal(r, [report(15, 1, FRI_1200)], FRI_1200).reason).toContain("웨이팅 15분+");
    expect(getSignal(r, [], FRI_1400).reason).toContain("웨이팅 정보 없음");
  });
});

describe("웨이팅 시간대 경계 (기본값)", () => {
  const r = makeRestaurant({ wait_1200: 0, wait_1230: 15 });
  const at = (hhmmUtc: string) => new Date(`2026-08-21T${hhmmUtc}:00Z`);

  it("11:29 → 기본값 시간대 밖 → 정보없음", () => {
    expect(getWaitInfo(r, [], at("02:29")).source).toBe("none");
  });
  it("11:30 → wait_1200 적용(0)", () => {
    expect(getWaitInfo(r, [], at("02:30")).level).toBe(0);
  });
  it("12:14 → 여전히 wait_1200(0)", () => {
    expect(getWaitInfo(r, [], at("03:14")).level).toBe(0);
  });
  it("12:15 → wait_1230으로 전환(15)", () => {
    expect(getWaitInfo(r, [], at("03:15")).level).toBe(15);
  });
  it("13:00 → 여전히 wait_1230(15)", () => {
    expect(getWaitInfo(r, [], at("04:00")).level).toBe(15);
  });
  it("13:01 → 기본값 시간대 밖 → 정보없음", () => {
    expect(getWaitInfo(r, [], at("04:01")).source).toBe("none");
  });
});

describe("웨이팅 제보 90분 유효 경계", () => {
  const r = makeRestaurant({ wait_1200: null });
  it("89분 전 제보는 유효 → 15", () => {
    expect(getWaitInfo(r, [report(15, 89, FRI_1200)], FRI_1200).level).toBe(15);
  });
  it("90분 전 제보는 만료(strict >) → 정보없음", () => {
    expect(getWaitInfo(r, [report(15, 90, FRI_1200)], FRI_1200).source).toBe("none");
  });
  it("91분 전 제보는 만료 → 정보없음", () => {
    expect(getWaitInfo(r, [report(15, 91, FRI_1200)], FRI_1200).source).toBe("none");
  });
});

describe("웨이팅 최근 3건의 최댓값", () => {
  it("4번째(가장 오래된) 제보는 제외된다", () => {
    const r = makeRestaurant();
    const reports: WaitReport[] = [
      report(0, 1, FRI_1200),
      report(0, 2, FRI_1200),
      report(0, 3, FRI_1200),
      report(15, 4, FRI_1200), // 최근 3건 밖 → 무시
    ];
    expect(getWaitInfo(r, reports, FRI_1200).level).toBe(0);
  });
  it("최근 3건 안의 최댓값을 채택한다", () => {
    const r = makeRestaurant();
    const reports: WaitReport[] = [
      report(0, 1, FRI_1200),
      report(15, 2, FRI_1200),
      report(5, 3, FRI_1200),
    ];
    expect(getWaitInfo(r, reports, FRI_1200).level).toBe(15);
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

describe("effectiveSolo — 혼밥 크라우드소싱 집계(최근 30일 다수결)", () => {
  const soloReport = (status: SoloStatus, agoDays = 0, rid = "r1"): SoloReport => ({
    id: `s-${status}-${agoDays}-${Math.round(Math.random() * 1e6)}`,
    restaurant_id: rid,
    status,
    device_id: "d",
    created_at: new Date(FRI_1200.getTime() - agoDays * 24 * 3600 * 1000).toISOString(),
  });
  it("시드 값이 있으면 그걸 우선", () => {
    expect(effectiveSolo(makeRestaurant({ solo_status: "yellow" }), [soloReport("red")], FRI_1200)).toBe("yellow");
  });
  it("시드 값 없으면 최근 제보 최다득표", () => {
    const r = makeRestaurant({ solo_status: null });
    const reports = [soloReport("green"), soloReport("green"), soloReport("red")];
    expect(effectiveSolo(r, reports, FRI_1200)).toBe("green");
  });
  it("30일 지난 제보는 제외된다(자정)", () => {
    const r = makeRestaurant({ solo_status: null });
    // 옛날 red 2표(40일 전) + 최근 green 1표 → 최근 30일 기준 green
    const reports = [soloReport("red", 40), soloReport("red", 40), soloReport("green", 1)];
    expect(effectiveSolo(r, reports, FRI_1200)).toBe("green");
  });
  it("시드 값도 제보도 없으면 null(미조사)", () => {
    expect(effectiveSolo(makeRestaurant({ solo_status: null }), [], FRI_1200)).toBeNull();
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
