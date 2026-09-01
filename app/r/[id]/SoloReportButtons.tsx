"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDeviceId } from "@/lib/deviceId";
import { getBrowserClient } from "@/lib/supabaseClient";
import type { SoloStatus } from "@/lib/types";

const OPTIONS: Array<{ v: SoloStatus; label: string; color: string }> = [
  { v: "green", label: "혼자 편해요", color: "text-emerald-600" },
  { v: "yellow", label: "혼자 가능(눈치)", color: "text-amber-600" },
  { v: "red", label: "혼밥 어려움", color: "text-rose-600" },
];

export default function SoloReportButtons({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<SoloStatus | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(`solo_${restaurantId}`)) setVoted(true);
  }, [restaurantId]);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  }

  async function vote(status: SoloStatus) {
    if (voted || pending !== null) {
      flash("이미 알려주셨어요. 감사합니다!");
      return;
    }
    setPending(status);
    try {
      const insert = getBrowserClient()
        .from("solo_reports")
        .insert({ restaurant_id: restaurantId, status, device_id: getDeviceId() });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("응답 지연(타임아웃)")), 10000),
      );
      const { error } = (await Promise.race([insert, timeout])) as { error: { message: string } | null };
      if (error) throw new Error(error.message);

      localStorage.setItem(`solo_${restaurantId}`, "1");
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
      <p className="mb-2 text-sm font-semibold text-slate-700">여기 혼밥 어때요?</p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => vote(o.v)}
            disabled={voted || pending !== null}
            className={`rounded-xl border border-slate-200 bg-white py-3 text-xs font-semibold ${o.color} transition active:scale-95 disabled:opacity-40`}
          >
            {pending === o.v ? "…" : o.label}
          </button>
        ))}
      </div>
      {voted && (
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
