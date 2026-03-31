// Firebase Cloud Messaging Service Worker
// 백그라운드 푸시 알림 수신 처리

// push 이벤트: FCM에서 백그라운드 메시지가 올 때
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return;
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const options = {
    body: notification.body || '',
    icon: notification.icon || '/logo.png',
    badge: '/logo.png',
    tag: data.type || 'default',
    data: {
      url: data.url || '/',
      expenseId: data.expenseId || '',
      type: data.type || '',
    },
  };

  event.waitUntil(
    self.registration.showNotification(notification.title || '인재원 알림', options)
  );
});

// 알림 클릭 시 앱으로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: event.notification.data,
          });
          return;
        }
      }
      // 없으면 새 탭 열기
      return clients.openWindow(url);
    })
  );
});
