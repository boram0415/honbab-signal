import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import type { Restaurant, SoloReport } from "@/lib/types";
import AdminDashboard, { type Summary } from "./AdminDashboard";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Visit = { device_id: string; user_id: string | null; day: string; platform: string | null };
type Row = { kind?: string; nickname?: string; body: string; created_at: string };

function kstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16);
}

export default async function Admin({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) notFound();

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const now = Date.now();
  const kstToday = new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const dayCutoff = new Date(now - 90 * 60 * 1000).toISOString();

  const [restRes, soloRes, visitRes, sugRes, msgRes, waitTodayRes] = await Promise.all([
    svc.from("restaurants").select("id,name,solo_status"),
    svc.from("solo_reports").select("restaurant_id,status,created_at"),
    svc.from("visits").select("device_id,user_id,day,platform"),
    svc.from("suggestions").select("kind,body,created_at").order("created_at", { ascending: false }).limit(50),
    svc.from("messages").select("nickname,body,created_at").order("created_at", { ascending: false }).limit(50),
    svc.from("wait_reports").select("id").gt("created_at", dayCutoff),
  ]);

  const restaurants = (restRes.data ?? []) as Pick<Restaurant, "id" | "name" | "solo_status">[];
  const solo = (soloRes.data ?? []) as SoloReport[];
  const visits = (visitRes.data ?? []) as Visit[];

  const idOf = (v: Visit) => v.user_id || v.device_id;
  const byId = new Map<string, Set<string>>();
  const perDay = new Map<string, Set<string>>();
  for (const v of visits) {
    const id = idOf(v);
    (byId.get(id) ?? byId.set(id, new Set()).get(id)!).add(v.day);
    (perDay.get(v.day) ?? perDay.set(v.day, new Set()).get(v.day)!).add(id);
  }
  const returning = [...byId.values()].filter((d) => d.size >= 2).length;
  const days = [...perDay.keys()].sort().slice(-7).map((day) => ({ day, count: perDay.get(day)!.size }));

  // 오늘 방문을 기기(mobile/web)로 분리
  const todayRows = visits.filter((v) => v.day === kstToday);
  const uniqBy = (p: string) => new Set(todayRows.filter((v) => v.platform === p).map(idOf)).size;
  const todayMobile = uniqBy("mobile");
  const todayWeb = uniqBy("web");
  const todayEtc = new Set(todayRows.filter((v) => !v.platform).map(idOf)).size;

  // D+1 리텐션
  const firstDay = new Map<string, string>();
  for (const [id, d] of byId) firstDay.set(id, [...d].sort()[0]);
  const nextOf = (d: string) => new Date(new Date(d).getTime() + 86400000).toISOString().slice(0, 10);
  const cohort = new Map<string, { s: number; r: number }>();
  for (const [id, fd] of firstDay) {
    const co = cohort.get(fd) ?? cohort.set(fd, { s: 0, r: 0 }).get(fd)!;
    co.s++;
    if (byId.get(id)!.has(nextOf(fd))) co.r++;
  }
  let coSize = 0, coRet = 0;
  for (const [d, co] of cohort) {
    if (d === kstToday) continue;
    coSize += co.s;
    coRet += co.r;
  }
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  const grayCount = restaurants.filter(
    (r) => r.solo_status == null && !solo.some((s) => s.restaurant_id === r.id),
  ).length;
  const soloToday = solo.filter((s) => new Date(s.created_at).getTime() > new Date(dayCutoff).getTime()).length;

  const summary: Summary = {
    today: perDay.get(kstToday)?.size ?? 0,
    todayMobile,
    todayWeb,
    todayEtc,
    total: byId.size,
    returningPct: pct(returning, byId.size),
    returningCount: returning,
    retentionPct: pct(coRet, coSize),
    cohortSize: coSize,
    days,
    totalRest: restaurants.length,
    grayCount,
    waitToday: (waitTodayRes.data ?? []).length,
    soloToday,
  };

  const suggestions = ((sugRes.data ?? []) as Row[]).map((s) => ({
    kind: s.kind as string,
    body: s.body,
    time: kstDate(s.created_at),
  }));
  const messages = ((msgRes.data ?? []) as Row[]).map((m) => ({
    nickname: m.nickname as string,
    body: m.body,
    time: kstDate(m.created_at),
  }));

  return <AdminDashboard summary={summary} suggestions={suggestions} messages={messages} />;
}
