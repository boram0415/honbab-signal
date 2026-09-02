"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
};

// 안드로이드 크롬: beforeinstallprompt → 설치 버튼.
// iOS 사파리: 이 이벤트가 없어(애플 정책) 공유→홈화면추가 수동 안내.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // 이미 설치(홈화면 실행)면 안 띄움
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (sessionStorage.getItem("honbab_install_dismiss") === "1") return;

    // 모바일에서만 설치 안내(PC 웹은 홈화면 추가가 의미 없어 배너 안 띄움)
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS 사파리 감지 (크롬/인앱 브라우저는 iOS에서 설치 불가라 제외)
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|kakaotalk|naver/i.test(ua);
    if (isIOS && isSafari) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    sessionStorage.setItem("honbab_install_dismiss", "1");
    setDeferred(null);
    setIosHint(false);
  }

  // 안드로이드: 원탭 설치
  if (deferred) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-[440px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">앱으로 설치하기</p>
          <p className="text-[11px] text-slate-500">홈 화면에 추가하면 앱처럼 바로 열려요</p>
        </div>
        <button type="button" onClick={dismiss} className="text-xs font-semibold text-slate-400">
          닫기
        </button>
        <button
          type="button"
          onClick={async () => {
            deferred.prompt();
            await deferred.userChoice;
            dismiss();
          }}
          className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
        >
          설치
        </button>
      </div>
    );
  }

  // iOS 사파리: 수동 설치 안내
  if (iosHint) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-[440px] items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">앱으로 설치하기</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            사파리 아래 <span className="font-semibold text-slate-700">공유</span> 버튼 →{" "}
            <span className="font-semibold text-slate-700">홈 화면에 추가</span> 를 누르면 앱처럼 써요.
          </p>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 text-xs font-semibold text-slate-400">
          닫기
        </button>
      </div>
    );
  }

  return null;
}
