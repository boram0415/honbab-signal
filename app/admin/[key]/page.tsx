import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import type { Restaurant, SoloReport } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Visit = { device_id: string; user_id: string | null; day: string };
type Suggestion = { kind: string; body: string; created_at: string };
type Msg = { nickname: string; body: string; created_at: string };

function kstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16);
}

export default async function Admin({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // URL 키가 서버 env와 일치할 때만 통과 (아니면 404 — 관리자 존재 자체를 숨김)
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) notFound();

  // service_role은 서버에서만 사용(브라우저로 안 나감)
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
    svc.from("visits").select("device_id,user_id,day"),
    svc.from("suggestions").select("kind,body,created_at").order("created_at", { ascending: false }).limit(30),
    svc.from("messages").select("nickname,body,created_at").order("created_at", { ascending: false }).limit(20),
    svc.from("wait_reports").select("id").gt("created_at", dayCutoff),
  ]);

  const restaurants = (restRes.data ?? []) as Pick<Restaurant, "id" | "name" | "solo_status">[];
  const solo = (soloRes.data ?? []) as SoloReport[];
  const visits = (visitRes.data ?? []) as Visit[];
  const suggestions = (sugRes.data ?? []) as Suggestion[];
  const messages = (msgRes.data ?? []) as Msg[];

  // 방문 집계 (로그인=계정 기준으로 합산, 그 외 device)
  const idOf = (v: Visit) => v.user_id || v.device_id;
  const byId = new Map<string, Set<string>>();
  const perDay = new Map<string, Set<string>>();
  for (const v of visits) {
    const id = idOf(v);
    (byId.get(id) ?? byId.set(id, new Set()).get(id)!).add(v.day);
    (perDay.get(v.day) ?? perDay.set(v.day, new Set()).get(v.day)!).add(id);
  }
  const totalVisitors = byId.size;
  const returning = [...byId.values()].filter((d) => d.size >= 2).length;
  const days = [...perDay.keys()].sort().slice(-7);

  // D+1 리텐션
  const firstDay = new Map<string, string>();
  for (const [id, d] of byId) firstDay.set(id, [...d].sort()[0]);
  const nextOf = (d: string) => new Date(new Date(d).getTime() + 86400000).toISOString().slice(0, 10);
  let coSize = 0, coRet = 0;
  const cohort = new Map<string, { s: number; r: number }>();
  for (const [id, fd] of firstDay) {
    const co = cohort.get(fd) ?? cohort.set(fd, { s: 0, r: 0 }).get(fd)!;
    co.s++;
    if (byId.get(id)!.has(nextOf(fd))) co.r++;
  }
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

  const KIND: Record<string, string> = { place: "가게추가", feature: "기능제안" };

  return (
    <div className="mx-auto max-w-[720px] pb-16">
      <h1 className="mb-1 text-lg font-bold">혼밥신호등 · 백오피스</h1>
      <p className="mb-4 text-xs text-slate-400">시간은 한국시간(KST) · 새로고침하면 최신</p>

      <Section title="방문">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="오늘 방문" value={`${perDay.get(kstToday)?.size ?? 0}`} sub="⚠ 인앱브라우저로 과대집계 가능" />
          <Stat label="전체 순방문" value={`${totalVisitors}`} />
          <Stat label="재방문률" value={`${pct(returning, totalVisitors)}%`} sub={`${returning}명`} />
        </div>
        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
          <b>D+1 리텐션: {pct(coRet, coSize)}%</b> <span className="text-slate-400">(코호트 {coSize}명)</span>
        </div>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {days.map((d) => (
              <tr key={d} className="border-b border-slate-100">
                <td className="py-1 text-slate-500">{d}</td>
                <td className="py-1 text-right font-semibold">{perDay.get(d)!.size}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="식당 / 제보 현황">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="총 식당" value={`${restaurants.length}`} />
          <Stat label="미조사(회색)" value={`${grayCount}`} />
          <Stat label="최근 웨이팅제보" value={`${(waitTodayRes.data ?? []).length}`} sub="90분내" />
        </div>
        <p className="mt-1 text-xs text-slate-400">최근 혼밥제보(90분내): {soloToday}건</p>
      </Section>

      <Section title={`제보함 (${suggestions.length})`}>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-400">아직 없음</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <li key={i} className="rounded-xl border border-slate-100 p-3 text-sm">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.kind === "place" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                  {KIND[s.kind] ?? s.kind}
                </span>
                {s.body}
                <span className="ml-2 text-[11px] text-slate-400">{kstDate(s.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="최근 채팅">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">아직 없음</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {messages.map((m, i) => (
              <li key={i}>
                <b className="text-slate-700">{m.nickname}</b> <span className="text-slate-500">{m.body}</span>
                <span className="ml-2 text-[11px] text-slate-400">{kstDate(m.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
