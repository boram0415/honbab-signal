import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "혼밥 신호등",
  description: "회사 근처 혼밥 식당의 상태를 확인합니다.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "혼밥신호등",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <main className="mx-auto min-h-screen w-full max-w-[640px] px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
