// Service Worker for ColdCall CRM Mobile Notifications & Caching
const CACHE_NAME = 'coldcall-crm-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notification events from server or background
self.addEventListener('push', (event) => {
  let data = {
    title: 'Follow-Up Due',
    body: 'A scheduled sales lead call is due now!',
    url: '/',
    tag: 'followup-reminder',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const title = data.title || 'Follow-Up Due';

  // Base options supported by all browsers including iOS Safari 16.4+
  const baseOptions = {
    body: data.body || 'A scheduled sales lead call is due now!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'followup-reminder',
    data: data.url || '/',
    renotify: true,
  };

  // Enhanced options with action buttons & vibration (for Android/Desktop)
  const enhancedOptions = {
    ...baseOptions,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open CRM' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, enhancedOptions).catch((err) => {
      // Fallback for iOS Safari WebKit which throws on 'actions' or 'vibrate'
      return self.registration.showNotification(title, baseOptions);
    })
  );
});

// Open application when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
