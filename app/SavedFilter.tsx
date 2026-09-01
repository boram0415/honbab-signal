"use client";

import { useEffect, useState } from "react";

import { HeartIcon } from "@/app/icons";

const KEY = "honbab_saved";
const read = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

// "저장한 곳만" 토글. 서버 렌더된 목록의 li[data-rid]를 클라이언트에서 보이기/숨기기.
export function SavedFilter() {
  const [on, setOn] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const apply = () => {
      const saved = read();
      setCount(saved.length);
      document.querySelectorAll<HTMLElement>("li[data-rid]").forEach((el) => {
        const id = el.getAttribute("data-rid");
        el.style.display = !on || (id && saved.includes(id)) ? "" : "none";
      });
    };
    apply();
    window.addEventListener("honbab-saved-changed", apply);
    return () => {
      window.removeEventListener("honbab-saved-changed", apply);
      // 언마운트 시 다시 다 보이게
      document.querySelectorAll<HTMLElement>("li[data-rid]").forEach((el) => {
        el.style.display = "";
      });
    };
  }, [on]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
        on ? "bg-rose-500 text-white ring-rose-500" : "bg-white text-slate-600 ring-slate-200"
      }`}
    >
      <HeartIcon filled className="h-3.5 w-3.5" />
      저장{count ? ` ${count}` : ""}
    </button>
  );
}
