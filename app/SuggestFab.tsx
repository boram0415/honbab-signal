"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 항상 떠있는 '+제보' 플로팅 버튼 (스크롤 위치 무관). 제보 페이지 자체에선 숨김.
export default function SuggestFab() {
  const pathname = usePathname();
  if (pathname?.startsWith("/suggest") || pathname?.startsWith("/admin")) return null;

  return (
    <Link
      href="/suggest"
      aria-label="가게·기능 제보하기"
      className="fixed bottom-6 right-4 z-20 flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg ring-1 ring-black/5 transition active:scale-95"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      제보
    </Link>
  );
}
