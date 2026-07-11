// Konnect Service Worker for Background and PWA Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Store userId across background restarts in cache storage
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_USER_ID') {
    const userId = event.data.userId;
    event.waitUntil(
      caches.open('konnect-user-cache').then((cache) => {
        return cache.put('/userId', new Response(userId));
      })
    );
  }
});

// Listen for Web Push events from Google, Apple, or Mozilla push servers
self.addEventListener('push', (event) => {
  event.waitUntil(
    caches.open('konnect-user-cache').then((cache) => {
      return cache.match('/userId');
    }).then((response) => {
      if (response) {
        return response.text();
      }
      return null;
    }).then((userId) => {
      if (!userId) {
        return showDefaultNotification();
      }
      
      // Fetch latest public notification parameters from Firestore REST API
      const projectId = 'gen-lang-client-0349257004';
      const databaseId = 'ai-studio-1e13eb29-90d7-4200-9ffc-8dd3ddfc6cd8';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/profiles/${userId}`;
      
      return fetch(url).then((res) => {
        if (!res.ok) throw new Error('Firestore REST read failed');
        return res.json();
      }).then((doc) => {
        const fields = doc.fields || {};
        const title = fields.latestNotificationTitle?.stringValue || 'New Message!';
        const body = fields.latestNotificationBody?.stringValue || 'You have received an incoming update.';
        const type = fields.latestNotificationType?.stringValue || 'message';
        
        return self.registration.showNotification(title, {
          body: body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'konnect-notif',
          data: { type },
          vibrate: [200, 100, 200],
          actions: [
            { action: 'open', title: 'Open Konnect' }
          ]
        });
      }).catch((err) => {
        console.error('Service worker background fetch error:', err);
        return showDefaultNotification();
      });
    })
  );
});

function showDefaultNotification() {
  return self.registration.showNotification('Konnect', {
    body: 'New secure real-time message or call received!',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'konnect-notif',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open Konnect' }
    ]
  });
}

// Open application and focus window on click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
