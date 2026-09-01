import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";

import type { SoloStatus, WaitLevel } from "../lib/types";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SOLO_STATUSES = new Set(["green", "yellow", "red"]);
const ORDER_TYPES = new Set(["kiosk", "table_tablet", "staff_call"]);
const WAIT_LEVELS = new Set([0, 5, 15]);

type SeedRestaurant = {
  name: string;
  category: string;
  walk_min: number;
  price_min: number;
  price_max: number;
  solo_status: SoloStatus;
  solo_note: string | null;
  wait_1200: WaitLevel;
  wait_1230: WaitLevel;
  order_type: "kiosk" | "table_tablet" | "staff_call";
  self_bar: boolean;
  noise_level: number;
  staff_talk: number;
  signature: string | null;
  closed_days: number[];
  open_time: string;
  close_time: string;
  kakaomap_url: string | null;
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
};

function requiredInteger(value: string, field: string): number {
  if (!/^-?\d+$/.test(value.trim())) {
    throw new Error(`${field}: 정수가 아닙니다`);
  }
  return Number(value);
}

function parseWaitLevel(value: string, field: string): WaitLevel {
  if (value.trim() === "") return null;
  const level = requiredInteger(value, field);
  if (!WAIT_LEVELS.has(level)) {
    throw new Error(`${field}: 0, 5, 15 또는 빈 값이어야 합니다`);
  }
  return level as Exclude<WaitLevel, null>;
}

function parseBoolean(value: string, field: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${field}: true 또는 false여야 합니다`);
}

function parseClosedDays(value: string): number[] {
  if (value.trim() === "") return [];
  const days = value.split(";").map((day) => requiredInteger(day, "closed_days"));
  if (days.some((day) => day < 0 || day > 6)) {
    throw new Error("closed_days: 0부터 6 사이의 요일이어야 합니다");
  }
  return days;
}

function nullable(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

function parseFloatOpt(value: string, field: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`${field}: 숫자가 아닙니다`);
  return n;
}

function validateRow(row: Record<string, string>): SeedRestaurant {
  const name = row.name?.trim();
  const category = row.category?.trim();
  if (!name) throw new Error("name: 필수 값입니다");
  if (!category) throw new Error("category: 필수 값입니다");

  const soloStatus = row.solo_status?.trim();
  if (!SOLO_STATUSES.has(soloStatus)) {
    throw new Error("solo_status: green, yellow, red 중 하나여야 합니다");
  }

  const orderType = row.order_type?.trim();
  if (!ORDER_TYPES.has(orderType)) {
    throw new Error("order_type: kiosk, table_tablet, staff_call 중 하나여야 합니다");
  }

  const walkMin = requiredInteger(row.walk_min ?? "", "walk_min");
  const priceMin = requiredInteger(row.price_min ?? "", "price_min");
  const priceMax = requiredInteger(row.price_max ?? "", "price_max");
  const noiseLevel = requiredInteger(row.noise_level ?? "", "noise_level");
  const staffTalk = requiredInteger(row.staff_talk ?? "", "staff_talk");

  if (walkMin < 0) throw new Error("walk_min: 0 이상이어야 합니다");
  if (priceMin > priceMax) throw new Error("price_min: price_max 이하여야 합니다");
  if (noiseLevel < 1 || noiseLevel > 3) {
    throw new Error("noise_level: 1부터 3 사이여야 합니다");
  }
  if (staffTalk < 1 || staffTalk > 3) {
    throw new Error("staff_talk: 1부터 3 사이여야 합니다");
  }

  return {
    name,
    category,
    walk_min: walkMin,
    price_min: priceMin,
    price_max: priceMax,
    solo_status: soloStatus as SoloStatus,
    solo_note: nullable(row.solo_note ?? ""),
    wait_1200: parseWaitLevel(row.wait_1200 ?? "", "wait_1200"),
    wait_1230: parseWaitLevel(row.wait_1230 ?? "", "wait_1230"),
    order_type: orderType as SeedRestaurant["order_type"],
    self_bar: parseBoolean(row.self_bar ?? "", "self_bar"),
    noise_level: noiseLevel,
    staff_talk: staffTalk,
    signature: nullable(row.signature ?? ""),
    closed_days: parseClosedDays(row.closed_days ?? ""),
    open_time: row.open_time?.trim() || "11:00",
    close_time: row.close_time?.trim() || "21:00",
    kakaomap_url: nullable(row.kakaomap_url ?? ""),
    photo_url: nullable(row.photo_url ?? ""),
    lat: parseFloatOpt(row.lat ?? "", "lat"),
    lng: parseFloatOpt(row.lng ?? "", "lng"),
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      ".env.local에 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정하세요.",
    );
  }

  const csvPath = path.resolve(process.cwd(), "data/restaurants.csv");
  const csv = await readFile(csvPath, "utf8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  const validRows: SeedRestaurant[] = [];
  let failureCount = 0;
  rows.forEach((row, index) => {
    try {
      validRows.push(validateRow(row));
    } catch (error) {
      failureCount += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`행 ${index + 2}: ${reason}`);
    }
  });

  let successCount = 0;
  if (validRows.length > 0) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("restaurants")
      .upsert(validRows, { onConflict: "name" })
      .select("name");

    if (error) {
      failureCount += validRows.length;
      console.error(`DB 저장 실패: ${error.message}`);
    } else {
      successCount = data?.length ?? validRows.length;
    }
  }

  console.log(`성공 ${successCount}건 / 실패 ${failureCount}건`);
  if (failureCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
