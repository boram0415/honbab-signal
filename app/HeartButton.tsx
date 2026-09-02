"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    const sync = () => setSaved(read().includes(id));
    sync();
    // 로그인 동기화·다른 곳 저장/해제·로그아웃 정리 시 즉시 반영
    window.addEventListener("honbab-saved-changed", sync);
    return () => window.removeEventListener("honbab-saved-changed", sync);
  }, [id]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // 카드 링크 이동 막기
    e.stopPropagation();

    // 하트 저장은 로그인 필수 — localStorage만 믿으면 지워질 때 날아가서 계정(카카오)에 묶는다.
    const sb = getBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      if (confirm("하트 저장은 로그인이 필요해요. 카카오로 로그인할까요?")) {
        await sb.auth.signInWithOAuth({
          provider: "kakao",
          options: { redirectTo: window.location.href, scopes: "profile_nickname" },
        });
      }
      return;
    }
    const uid = session.user.id;

    const cur = read();
    const nowSaved = !cur.includes(id);
    const next = nowSaved ? [...cur, id] : cur.filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
    setSaved(nowSaved);
    window.dispatchEvent(new Event("honbab-saved-changed"));

    // 계정(user_id) 기준으로 DB 저장 → 기기·스토리지 바뀌어도 유지.
    try {
      if (nowSaved) {
        await sb
          .from("hearts")
          .upsert({ restaurant_id: id, device_id: uid }, { onConflict: "restaurant_id,device_id", ignoreDuplicates: true });
      } else {
        await sb.from("hearts").delete().eq("restaurant_id", id).eq("device_id", uid);
      }
      router.refresh(); // 카운트 갱신
    } catch {
      /* 네트워크 등 무시 (로컬 미러는 이미 반영됨) */
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
