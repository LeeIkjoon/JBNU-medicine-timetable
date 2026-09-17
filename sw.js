/* 서비스워커
   1) 푸시 알림 표시
   2) 앱 셸(index.html) 네트워크 우선 — 홈 화면 PWA가 오래된 HTML을 캐시로 계속 쓰는 문제 방지.
      오프라인이면 마지막으로 받은 사본을 보여줌
   3) 새 워커가 활성화되면 열려 있는 창을 한 번 새로고침 (오래된 페이지 즉시 교체) */
var SHELL_CACHE = 'shell-v1';

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    self.clients.claim().then(function(){
      return self.clients.matchAll({ type: 'window' });
    }).then(function(cs){
      cs.forEach(function(c){ if (c.navigate) c.navigate(c.url).catch(function(){}); });
    })
  );
});

self.addEventListener('fetch', function(e){
  if (e.request.mode !== 'navigate') return; /* JS/CSS는 ?v= 버전으로 관리 — 브라우저 기본 캐시 사용 */
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(function(res){
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
      }
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(r){ return r || caches.match('./index.html'); });
    })
  );
});

self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || '시간표', {
    body: d.body || '',
    icon: 'icons/icon-180.png',
    badge: 'icons/icon-180.png',
    data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(clients.openWindow((e.notification.data && e.notification.data.url) || './'));
});
