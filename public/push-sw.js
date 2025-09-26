/**
 * Push Notification Service Worker Extension
 * Handles push events when main SW delegates them
 * Minimal implementation - just show notifications
 */

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const options = event.data.json();

  const notificationOptions = {
    body: options.body || 'You have new updates!',
    icon: options.icon || '/favicon-192x192.png',
    badge: '/favicon-72x72.png',
    vibrate: [200, 100, 200],
    data: options.data || {},
    actions: options.actions || [],
    tag: options.tag || 'moshimoshi-notification',
    renotify: true,
    requireInteraction: false,
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(
      options.title || 'Moshimoshi',
      notificationOptions
    )
  );
});

// Notification click - handle notification interactions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.actionUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Background sync for notification delivery
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(syncOutbox());
  }
});

// Sync outbox helper
async function syncOutbox() {
  // This will be called by the IDB client when needed
  // The actual sync logic is in the main thread
  try {
    const allClients = await clients.matchAll({ includeUncontrolled: true });

    // Send message to all clients to trigger sync
    allClients.forEach(client => {
      client.postMessage({
        type: 'SYNC_TRIGGER',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    // Silent fail - will retry on next sync
  }
}