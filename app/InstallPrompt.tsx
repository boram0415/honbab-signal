"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
};

// 안드로이드 크롬: 설치 가능해지면(beforeinstallprompt) 하단에 설치 배너.
// iOS 사파리는 이 이벤트가 없어 배너 대신 공유→홈화면추가로 설치(별도 안내).
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!deferred) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-[440px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800">앱으로 설치하기</p>
        <p className="text-[11px] text-slate-500">홈 화면에 추가하면 앱처럼 바로 열려요</p>
      </div>
      <button
        type="button"
        onClick={() => setDeferred(null)}
        className="text-xs font-semibold text-slate-400"
      >
        닫기
      </button>
      <button
        type="button"
        onClick={async () => {
          deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
        className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
      >
        설치
      </button>
    </div>
  );
}
