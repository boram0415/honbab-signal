"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDeviceId } from "@/lib/deviceId";
import { getBrowserClient } from "@/lib/supabaseClient";
import type { SpeedLevel } from "@/lib/types";

const OPTIONS: Array<{ v: SpeedLevel; label: string; color: string }> = [
  { v: "fast", label: "빨리 나와요", color: "text-emerald-600" },
  { v: "medium", label: "좀 오래 걸려요", color: "text-amber-600" },
  { v: "slow", label: "20분 이상", color: "text-rose-600" },
];

export default function SpeedReportButtons({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<SpeedLevel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [isLunch, setIsLunch] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(`speed_${restaurantId}`)) setVoted(true);
    // 음식 속도는 점심 러시(12~1시)에 제보받아야 정확 → 그 시간대만 허용
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    const m = kst.getUTCHours() * 60 + kst.getUTCMinutes();
    setIsLunch(m >= 720 && m <= 780);
  }, [restaurantId]);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  }

  async function vote(level: SpeedLevel) {
    if (!isLunch) {
      flash("음식 속도는 점심시간(12~1시)에만 받아요");
      return;
    }
    if (voted || pending !== null) {
      flash("이미 알려주셨어요. 감사합니다!");
      return;
    }
    setPending(level);
    try {
      const sb = getBrowserClient();
      const { data: { session } } = await sb.auth.getSession();
      const dev = session?.user?.id ?? getDeviceId();
      const insert = sb
        .from("speed_reports")
        .insert({ restaurant_id: restaurantId, level, device_id: dev });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("응답 지연(타임아웃)")), 10000),
      );
      const { error } = (await Promise.race([insert, timeout])) as { error: { message: string } | null };
      if (error) throw new Error(error.message);

      localStorage.setItem(`speed_${restaurantId}`, "1");
      setVoted(true);
      flash("알려주셔서 감사합니다");
      router.refresh();
    } catch (e) {
      flash(`실패: ${e instanceof Error ? e.message : "네트워크 오류"}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">음식 얼마나 빨리 나와요?</p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => vote(o.v)}
            disabled={!isLunch || voted || pending !== null}
            className={`rounded-xl border border-slate-200 bg-white py-3 text-xs font-semibold ${o.color} transition active:scale-95 disabled:opacity-40`}
          >
            {pending === o.v ? "…" : o.label}
          </button>
        ))}
      </div>
      {!isLunch && (
        <p className="mt-2 text-center text-xs text-slate-400">
          점심시간(12~1시)에만 제보받아요 — 그때 속도가 제일 정확해서요
        </p>
      )}
      {isLunch && voted && (
        <p className="mt-2 text-center text-xs text-slate-400">알려주셔서 감사합니다!</p>
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
