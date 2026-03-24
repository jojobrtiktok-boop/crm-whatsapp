self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'NexoFlow';
  const options = {
    body: data.body || '',
    icon: 'https://i.postimg.cc/rwCggDFM/23-de-mar-de-2026-16-12-56.png',
    badge: 'https://i.postimg.cc/rwCggDFM/23-de-mar-de-2026-16-12-56.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'nexoflow',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
