"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getDeviceId } from "@/lib/deviceId";
import { getBrowserClient } from "@/lib/supabaseClient";
import { randomNickname } from "@/lib/nickname";

const SAVED_KEY = "honbab_saved";

function readSaved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

// 첫 로그인 시 프로필(닉네임) 자동 생성, 있으면 그대로
async function ensureProfile(sb: ReturnType<typeof getBrowserClient>, userId: string) {
  const { data } = await sb.from("profiles").select("nickname").eq("id", userId).maybeSingle();
  if (data?.nickname) return data.nickname as string;
  for (let i = 0; i < 8; i++) {
    const nick = randomNickname(i > 0); // 겹치면 숫자 붙여 재시도
    const { error } = await sb.from("profiles").insert({ id: userId, nickname: nick });
    if (!error) return nick;
  }
  return "익명";
}

// 로그인하면: localStorage 하트 → 계정으로 이전 + 계정 하트 → 이 기기로 병합
async function syncHearts(
  sb: ReturnType<typeof getBrowserClient>,
  userId: string,
): Promise<boolean> {
  const local = readSaved();
  if (local.length) {
    await sb
      .from("hearts")
      .upsert(
        local.map((rid) => ({ restaurant_id: rid, device_id: userId })),
        { onConflict: "restaurant_id,device_id", ignoreDuplicates: true },
      );
  }
  // 익명(device_id) 시절 하트 → 계정으로 이전 후 익명 행 삭제 → 카운트 2배 방지(유실 없음)
  const anonId = getDeviceId();
  let removedAnon = false;
  if (anonId !== userId) {
    const { data: anonHearts } = await sb
      .from("hearts")
      .select("restaurant_id")
      .eq("device_id", anonId);
    if (anonHearts?.length) {
      await sb.from("hearts").upsert(
        anonHearts.map((h) => ({ restaurant_id: h.restaurant_id as string, device_id: userId })),
        { onConflict: "restaurant_id,device_id", ignoreDuplicates: true },
      );
      await sb.from("hearts").delete().eq("device_id", anonId);
      removedAnon = true;
    }
  }
  const { data } = await sb.from("hearts").select("restaurant_id").eq("device_id", userId);
  const merged = new Set([...local, ...(data ?? []).map((h) => h.restaurant_id as string)]);
  localStorage.setItem(SAVED_KEY, JSON.stringify([...merged]));
  window.dispatchEvent(new Event("honbab-saved-changed"));
  return local.length > 0 || removedAnon; // DB가 바뀌었으면 카운트 갱신 필요
}

export function AuthButton() {
  const router = useRouter();
  const [nick, setNick] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getBrowserClient();
    let active = true;
    // 캐시된 닉네임 즉시 표시 → 새로고침 깜빡임 방지
    const cached = localStorage.getItem("honbab_nick");
    if (cached) setNick(cached);

    const handle = async (userId: string | undefined) => {
      if (!userId) {
        if (active) {
          setNick(null);
          localStorage.removeItem("honbab_nick");
          setReady(true);
        }
        return;
      }
      const n = await ensureProfile(sb, userId);
      const changed = await syncHearts(sb, userId);
      if (active) {
        setNick(n);
        localStorage.setItem("honbab_nick", n);
        setReady(true);
        if (changed) router.refresh(); // 중복 정리·이전 반영됐으면 카운트 새로고침
      }
    };
    sb.auth.getSession().then(({ data }) => handle(data.session?.user?.id));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) =>
      handle(session?.user?.id),
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function login() {
    setBusy(true);
    await getBrowserClient().auth.signInWithOAuth({
      provider: "kakao",
      // 이메일 미요청(검수 필요) — 닉네임만. 어차피 랜덤 닉네임 쓰므로 프로필도 불필요.
      options: { redirectTo: window.location.origin, scopes: "profile_nickname" },
    });
  }

  if (nick) {
    return (
      <Link
        href="/mypage"
        className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
      >
        {nick}
      </Link>
    );
  }
  // 세션 확인 전엔 자리만(깜빡임 방지)
  if (!ready) return <span className="inline-block h-6 w-16" aria-hidden />;
  return (
    <button
      type="button"
      onClick={login}
      disabled={busy}
      className="shrink-0 whitespace-nowrap rounded-full bg-[#FEE500] px-3 py-1 text-xs font-bold text-[#191600] disabled:opacity-60"
    >
      카카오 로그인
    </button>
  );
}
