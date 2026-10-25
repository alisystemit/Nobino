/* نوبینو — سرویس‌ورکر PWA
 * راهبرد:
 *  - ناوبری (صفحات): اول شبکه، در صورت قطعی → صفحه آفلاین
 *  - آیکون/مانیفست/فونت: کش‌اول (با به‌روزرسانی در پس‌زمینه)
 *  - API و بقیه: فقط شبکه
 */
const CACHE = "nobino-v1";
const PRECACHE = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // صفحه‌ها: اول شبکه، در قطعی → /offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/offline").then((c) => c || caches.match("/")))
    );
    return;
  }

  // فایل‌های ثابت (آیکون/فونت/مانیفست): کش‌اول + به‌روزرسانی پس‌زمینه
  if (/\.(png|svg|webp|jpg|jpeg|woff2?|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // بقیه (API، صفحات داینامیک): فقط شبکه
  event.respondWith(fetch(req));
});
