"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// 페이지 이동 중 상단에 얇게 흐르는 진행바 (내부 링크 클릭 시 즉시 표시, 경로 바뀌면 사라짐)
export default function TopProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  // 경로가 바뀌면(=이동 완료) 숨김
  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  // 같은 origin 링크 클릭을 감지해 즉시 표시
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || a.target === "_blank") return;
      if (href === pathname) return;
      setLoading(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-emerald-100">
      <div className="honbab-topbar h-full w-1/4 bg-emerald-500" />
    </div>
  );
}
