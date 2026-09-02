"use client";

import { useEffect, useRef, useState } from "react";

import { getDeviceId } from "@/lib/deviceId";
import { getBrowserClient } from "@/lib/supabaseClient";
import { randomNickname } from "@/lib/nickname";
import type { Message } from "@/lib/types";

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function ChatBox({ restaurantId }: { restaurantId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [me, setMe] = useState<{ deviceId: string; nick: string } | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 신원(닉네임·device_id) 확정: 로그인=카카오 닉네임, 아니면 랜덤 닉네임
  useEffect(() => {
    const sb = getBrowserClient();
    sb.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id;
      if (uid) {
        const cached = localStorage.getItem("honbab_nick");
        if (cached) return setMe({ deviceId: uid, nick: cached });
        const { data: p } = await sb.from("profiles").select("nickname").eq("id", uid).maybeSingle();
        setMe({ deviceId: uid, nick: (p?.nickname as string) ?? "익명" });
      } else {
        let n = localStorage.getItem("honbab_anon_nick");
        if (!n) {
          n = randomNickname();
          localStorage.setItem("honbab_anon_nick", n);
        }
        setMe({ deviceId: getDeviceId(), nick: n });
      }
    });
  }, []);

  // 최근 50개 로드 + 실시간 신규 메시지 구독
  useEffect(() => {
    const sb = getBrowserClient();
    let active = true;
    sb.from("messages")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active && data) setMessages((data as Message[]).slice().reverse());
      });

    const channel = sb
      .channel(`msgs:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, [restaurantId]);

  // 새 메시지 오면 맨 아래로
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send() {
    const body = input.trim();
    if (!body || sending || !me) return;
    setSending(true);
    try {
      const { data, error } = await getBrowserClient()
        .from("messages")
        .insert({ restaurant_id: restaurantId, device_id: me.deviceId, nickname: me.nick, body })
        .select()
        .single();
      if (error) throw error;
      setInput("");
      const m = data as Message;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch {
      /* 전송 실패는 조용히 무시 (RLS/네트워크). 다시 누르면 됨 */
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 헤더: 실시간 표시로 눈에 띄게 */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <h2 className="text-[13px] font-bold text-slate-800">실시간 웨이팅 채팅</h2>
        {me && <span className="ml-auto text-[11px] text-slate-400">{me.nick}</span>}
      </div>

      {/* 대화 영역: 옅은 배경으로 채팅방 느낌 */}
      <div
        ref={listRef}
        className="flex max-h-64 min-h-[6.5rem] flex-col gap-2.5 overflow-y-auto bg-slate-50 px-3 py-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 py-6 text-center">
            <p className="text-[12px] leading-relaxed text-slate-400">
              지금 이 앞이신가요? 웨이팅 상황을 알려주세요.
              <br />
              <span className="text-slate-300">예) 지금 웨이팅 있나요?</span>
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = me?.deviceId === m.device_id;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && (
                  <span className="mb-0.5 px-1 text-[11px] font-medium text-slate-500">
                    {m.nickname}
                  </span>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2 text-[13px] leading-snug shadow-sm ${
                    mine
                      ? "rounded-2xl rounded-tr-md bg-slate-900 text-white"
                      : "rounded-2xl rounded-tl-md border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-slate-400">
                  {ago(m.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 입력 바 */}
      <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
          }}
          maxLength={300}
          placeholder="메시지 보내기"
          className="min-w-0 flex-1 rounded-full border border-transparent bg-slate-100 px-4 py-2 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-slate-200 focus:bg-white"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim() || !me}
          aria-label="전송"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition active:scale-90 disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
