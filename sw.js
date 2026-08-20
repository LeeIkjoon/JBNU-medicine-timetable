/* 푸시 알림 전용 서비스워커 (fetch 핸들러 없음 — 캐시에 관여하지 않음) */
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
