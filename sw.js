/* 最小可用的 Service Worker
   目标只有两个：① 让 Chrome / Edge 认可"可安装" ② 断网时不至于白屏。
   策略刻意保守：
   - HTML（导航请求）永远网络优先 —— 你改完代码，强刷就是新版，不会被旧缓存糊住；
   - 小静态资源（图片/字体/脚本）缓存优先，回填缓存；
   - 音视频不进缓存（一首歌就几十 MB，交给浏览器自己的 HTTP 缓存）。
   改动站点后想强制更新：把 CACHE 的版本号 +1 再推即可。 */

const CACHE = 'sheci-v1';
const CORE = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png',
  './bg-poster.webp',
  './cursor-fish.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;          // 跨域（GitHub API / 外链）不插手
  if (/\.(mp3|m4a|mp4|webm|ogg)$/i.test(url.pathname)) return; // 音视频交给 HTTP 缓存

  const isDoc = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isDoc) {
    e.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((hit) => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
