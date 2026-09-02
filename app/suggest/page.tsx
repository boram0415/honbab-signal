"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getDeviceId } from "@/lib/deviceId";
import { getBrowserClient } from "@/lib/supabaseClient";

type Kind = "place" | "feature";

const PLACEHOLDER: Record<Kind, string> = {
  place: "예) 뚠뚠한고등어 (송파대로 167) 추가해주세요",
  feature: "예) 오늘 갈 만한 곳 랜덤 추천 버튼이 있으면 좋겠어요",
};

export default function SuggestPage() {
  const [kind, setKind] = useState<Kind>("place");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    if (t === "feature" || t === "place") setKind(t);
  }, []);

  async function submit() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    try {
      const sb = getBrowserClient();
      const { data: { session } } = await sb.auth.getSession();
      const { error } = await sb.from("suggestions").insert({
        kind,
        body: text,
        device_id: session?.user?.id ?? getDeviceId(),
        user_id: session?.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "전송에 실패했어요");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <header className="mb-4 flex items-center gap-2">
        <Link href="/" aria-label="뒤로" className="text-slate-400">
          ←
        </Link>
        <h1 className="text-lg font-bold tracking-tight">제보하기</h1>
      </header>

      {done ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm font-semibold text-emerald-800">제보 감사합니다!</p>
          <p className="mt-1 text-xs text-emerald-700">보내주신 내용은 잘 검토할게요.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBody("");
                setDone(false);
              }}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700"
            >
              또 제보하기
            </button>
            <Link
              href="/"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              홈으로
            </Link>
          </div>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-center text-sm font-semibold">
            <button
              type="button"
              onClick={() => setKind("place")}
              className={`flex-1 rounded-full py-1.5 ${kind === "place" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              가게 추가 요청
            </button>
            <button
              type="button"
              onClick={() => setKind("feature")}
              className={`flex-1 rounded-full py-1.5 ${kind === "feature" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              기능 제안
            </button>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder={PLACEHOLDER[kind]}
            className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {kind === "place" ? "가게 이름·위치를 적어주시면 빨라요" : "어떤 기능이 필요한지 편하게 적어주세요"}
            </span>
            <span className="text-[11px] text-slate-300">{body.length}/1000</span>
          </div>

          {err && <p className="mt-2 text-xs text-rose-600">전송 실패: {err}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={sending || !body.trim()}
            className="mt-3 w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-40"
          >
            {sending ? "보내는 중…" : "제보 보내기"}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">로그인 없이도 보낼 수 있어요</p>
        </section>
      )}
    </div>
  );
}
