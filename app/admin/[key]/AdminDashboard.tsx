"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export type Summary = {
  today: number;
  todayMobile: number;
  todayWeb: number;
  todayEtc: number;
  total: number;
  returningPct: number;
  returningCount: number;
  retentionPct: number;
  cohortSize: number;
  days: { day: string; count: number }[];
  totalRest: number;
  grayCount: number;
  waitToday: number;
  soloToday: number;
};
export type SugItem = { kind: string; body: string; time: string };
export type MsgItem = { nickname: string; body: string; time: string };

const KIND: Record<string, string> = { place: "가게추가", feature: "기능제안" };

export default function AdminDashboard({
  summary,
  suggestions,
  messages,
}: {
  summary: Summary;
  suggestions: SugItem[];
  messages: MsgItem[];
}) {
  const [tab, setTab] = useState<"summary" | "suggest" | "chat">("summary");
  const router = useRouter();

  // 서버 데이터를 15초마다 다시 당겨온다(탭 상태는 유지) → 채팅/제보 자동 갱신
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="mx-auto max-w-[720px] pb-16">
      <h1 className="mb-1 text-lg font-bold">혼밥신호등 · 백오피스</h1>
      <p className="mb-3 text-xs text-slate-400">시간은 한국시간(KST) · 15초마다 자동 갱신</p>

      <div className="sticky top-0 z-10 -mx-4 mb-3 flex gap-1 bg-white/90 px-4 py-2 backdrop-blur">
        <Tab on={tab === "summary"} onClick={() => setTab("summary")}>
          요약
        </Tab>
        <Tab on={tab === "suggest"} onClick={() => setTab("suggest")}>
          제보함 {suggestions.length}
        </Tab>
        <Tab on={tab === "chat"} onClick={() => setTab("chat")}>
          채팅 {messages.length}
        </Tab>
      </div>

      {tab === "summary" && (
        <>
          <Section title="방문">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="오늘 방문" value={`${summary.today}`} sub="⚠ 인앱브라우저로 과대집계 가능" />
              <Stat label="전체 순방문" value={`${summary.total}`} />
              <Stat label="재방문률" value={`${summary.returningPct}%`} sub={`${summary.returningCount}명`} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="모바일" value={`${summary.todayMobile}`} sub="오늘" />
              <Stat label="웹" value={`${summary.todayWeb}`} sub="오늘" />
              <Stat label="기타" value={`${summary.todayEtc}`} sub="구분전 기록" />
            </div>
            <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
              <b>D+1 리텐션: {summary.retentionPct}%</b>{" "}
              <span className="text-slate-400">(코호트 {summary.cohortSize}명)</span>
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {summary.days.map((d) => (
                  <tr key={d.day} className="border-b border-slate-100">
                    <td className="py-1 text-slate-500">{d.day}</td>
                    <td className="py-1 text-right font-semibold">{d.count}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="식당 / 제보 현황">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="총 식당" value={`${summary.totalRest}`} />
              <Stat label="미조사(회색)" value={`${summary.grayCount}`} />
              <Stat label="최근 웨이팅제보" value={`${summary.waitToday}`} sub="90분내" />
            </div>
            <p className="mt-1 text-xs text-slate-400">최근 혼밥제보(90분내): {summary.soloToday}건</p>
          </Section>
        </>
      )}

      {tab === "suggest" && (
        <Section title={`제보함 (${suggestions.length})`}>
          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-400">아직 없음</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {suggestions.map((s, i) => (
                <li key={i} className="rounded-xl border border-slate-100 p-3 text-sm">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.kind === "place" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}
                  >
                    {KIND[s.kind] ?? s.kind}
                  </span>
                  {s.body}
                  <span className="ml-2 text-[11px] text-slate-400">{s.time}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "chat" && (
        <Section title={`최근 채팅 (${messages.length})`}>
          {messages.length === 0 ? (
            <p className="text-sm text-slate-400">아직 없음</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {messages.map((m, i) => (
                <li key={i}>
                  <b className="text-slate-700">{m.nickname}</b>{" "}
                  <span className="text-slate-500">{m.body}</span>
                  <span className="ml-2 text-[11px] text-slate-400">{m.time}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-1.5 text-sm font-semibold ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
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
