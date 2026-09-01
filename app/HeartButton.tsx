"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDeviceId } from "@/lib/deviceId";
import { getBrowserClient } from "@/lib/supabaseClient";
import { HeartIcon } from "@/app/icons";

const KEY = "honbab_saved";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function HeartButton({ id, big = false }: { id: string; big?: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(read().includes(id));
  }, [id]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // 카드 링크 이동 막기
    e.stopPropagation();
    const cur = read();
    const nowSaved = !cur.includes(id);
    const next = nowSaved ? [...cur, id] : cur.filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
    setSaved(nowSaved);
    window.dispatchEvent(new Event("honbab-saved-changed"));

    // DB 카운트 (테이블 없으면 조용히 무시)
    try {
      const sb = getBrowserClient();
      const dev = getDeviceId();
      if (nowSaved) {
        await sb
          .from("hearts")
          .upsert({ restaurant_id: id, device_id: dev }, { onConflict: "restaurant_id,device_id", ignoreDuplicates: true });
      } else {
        await sb.from("hearts").delete().eq("restaurant_id", id).eq("device_id", dev);
      }
      router.refresh(); // 카운트 갱신
    } catch {
      /* 테이블 미생성 등은 무시 (개인 저장은 이미 됨) */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? "저장 취소" : "저장"}
      className="transition active:scale-90"
    >
      <HeartIcon filled={saved} className={big ? "h-7 w-7" : "h-6 w-6"} />
    </button>
  );
}
