// 혼밥신호등 서비스워커 — 설치가능(PWA) + 정적 자산만 캐시(동적/외부는 항상 네트워크)
const CACHE = "honbab-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // supabase/kakao 등 외부는 개입 안 함

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);

  // 네트워크 우선 → 오프라인이면 캐시. 정적 자산만 캐시에 저장(동적 페이지/개인화는 캐시 안 함).
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (isStatic && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
