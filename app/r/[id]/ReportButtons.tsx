"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserClient } from "@/lib/supabaseClient";

const LEVELS: Array<{ v: 0 | 5 | 15; label: string }> = [
  { v: 0, label: "없음" },
  { v: 5, label: "5~10분" },
  { v: 15, label: "15분 이상" },
];

const DEDUP_MS = 10 * 60 * 1000; // 동일 기기 10분 내 재제보 방지

function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
}

export default function ReportButtons({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);

  useEffect(() => {
    const v = Number(localStorage.getItem(`report_${restaurantId}`) || 0);
    if (v > Date.now()) setBlockedUntil(v);
  }, [restaurantId]);

  const blocked = blockedUntil > Date.now();

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function report(level: 0 | 5 | 15) {
    if (blocked || pending !== null) {
      flash("방금 제보하셨어요. 잠시 후 다시 부탁해요");
      return;
    }
    setPending(level);
    const { error } = await getBrowserClient()
      .from("wait_reports")
      .insert({ restaurant_id: restaurantId, level, device_id: getDeviceId() });
    setPending(null);

    if (error) {
      flash("제보에 실패했어요. 잠시 후 다시");
      return;
    }
    const until = Date.now() + DEDUP_MS;
    localStorage.setItem(`report_${restaurantId}`, String(until));
    setBlockedUntil(until);
    flash("제보 감사합니다 🙏");
    router.refresh(); // 서버 컴포넌트 재계산 → 신호등 반영
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">지금 웨이팅 어때요?</p>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.v}
            type="button"
            onClick={() => report(l.v)}
            disabled={blocked || pending !== null}
            className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition active:scale-95 disabled:opacity-40"
          >
            {pending === l.v ? "…" : l.label}
          </button>
        ))}
      </div>
      {blocked && (
        <p className="mt-2 text-center text-xs text-slate-400">방금 제보해주셨어요. 감사합니다!</p>
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
