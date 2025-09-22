// Firebase Cloud Messaging Service Worker for Moshimoshi
// This handles push notifications when the app is in background

// Import Firebase libraries (v9 compat for service worker)
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration
// These values should match your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyDqGAw33T_OgeAPZvb7uz4Y_QzIBSdPJzE",
  authDomain: "moshimoshi-a7611.firebaseapp.com",
  projectId: "moshimoshi-a7611",
  storageBucket: "moshimoshi-a7611.firebasestorage.app",
  messagingSenderId: "940135043128",
  appId: "1:940135043128:web:6f1e1bec913fb332c6c5e8",
  measurementId: "G-82Y5GLZZZN"
};

// Initialize Firebase app
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging instance
const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Received background message:', payload);

  // Extract notification data
  const notificationData = payload.data || {};
  const notification = payload.notification || {};

  // Determine notification type and customize accordingly
  const notificationType = notificationData.type || 'review_reminder';

  let title = notification.title || 'Moshimoshi - Review Reminder';
  let body = notification.body || 'You have reviews waiting!';
  let icon = notification.icon || '/icons/icon-192x192.png';
  let badge = '/icons/icon-72x72.png';
  let tag = notificationData.tag || 'fcm-notification';

  // Customize based on notification type
  switch (notificationType) {
    case 'review_due':
      title = notification.title || '⏰ Time to Review!';
      body = notification.body || formatReviewBody(notificationData);
      tag = 'review-due';
      break;

    case 'achievement':
      title = notification.title || '🏆 Achievement Unlocked!';
      body = notification.body || `You've earned a new achievement!`;
      tag = 'achievement';
      break;

    case 'streak_reminder':
      title = notification.title || '🔥 Keep Your Streak!';
      body = notification.body || 'Complete today\'s reviews to maintain your streak';
      tag = 'streak';
      break;

    case 'summary':
      title = notification.title || '📊 Daily Summary';
      body = notification.body || 'Check your daily learning progress';
      tag = 'summary';
      break;
  }

  // Notification options
  const notificationOptions = {
    body,
    icon,
    badge,
    data: {
      ...notificationData,
      FCM_MSG: payload,
      timestamp: Date.now(),
      clickAction: notificationData.clickAction || '/review'
    },
    vibrate: [200, 100, 200],
    actions: getNotificationActions(notificationType),
    tag,
    renotify: true,
    requireInteraction: notificationType === 'review_due',
    silent: notificationData.silent === 'true'
  };

  // Show the notification
  return self.registration.showNotification(title, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data;

  // Close the notification
  notification.close();

  let targetUrl = data.clickAction || '/';

  // Handle different actions
  switch (action) {
    case 'start_review':
      targetUrl = '/review';
      trackEvent('notification_action', { action: 'start_review' });
      break;

    case 'view_progress':
      targetUrl = '/progress';
      trackEvent('notification_action', { action: 'view_progress' });
      break;

    case 'snooze':
      // Schedule a reminder for 30 minutes later
      scheduleLocalNotification(30 * 60 * 1000, {
        title: notification.title,
        body: 'Snoozed reminder',
        data: notification.data
      });
      trackEvent('notification_action', { action: 'snooze' });
      return; // Don't open the app

    case 'dismiss':
      trackEvent('notification_action', { action: 'dismiss' });
      return; // Just close, don't open app

    default:
      // Default click action
      if (data.itemId) {
        targetUrl = `/review?item=${data.itemId}`;
      }
      trackEvent('notification_click', { type: data.type });
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to target URL and focus
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      // No window open, create a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Helper function to format review body text
function formatReviewBody(data) {
  const count = data.reviewCount || 1;
  const itemType = data.itemType || 'items';
  const nextInterval = data.nextInterval || '';

  if (count === 1) {
    return `Your ${itemType} review is ready. ${nextInterval ? `Next review: ${nextInterval}` : ''}`;
  } else {
    return `You have ${count} ${itemType} reviews waiting`;
  }
}

// Helper function to get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'review_due':
      return [
        {
          action: 'start_review',
          title: '▶️ Start Review',
          icon: '/icons/play.png'
        },
        {
          action: 'snooze',
          title: '⏰ Snooze 30min',
          icon: '/icons/clock.png'
        }
      ];

    case 'achievement':
      return [
        {
          action: 'view_progress',
          title: '📊 View Progress',
          icon: '/icons/chart.png'
        }
      ];

    case 'streak_reminder':
      return [
        {
          action: 'start_review',
          title: '🔥 Keep Streak',
          icon: '/icons/fire.png'
        }
      ];

    default:
      return [
        {
          action: 'open',
          title: 'Open App',
          icon: '/icons/open.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/close.png'
        }
      ];
  }
}

// Schedule a local notification (works with main service worker)
function scheduleLocalNotification(delay, notificationData) {
  // Communicate with main service worker
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        data: {
          delay,
          notification: notificationData
        }
      });
    });
  });
}

// Track analytics events
function trackEvent(eventName, eventData) {
  // Send to analytics endpoint
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: eventName,
      data: eventData,
      timestamp: Date.now()
    })
  }).catch(error => {
    console.error('[FCM SW] Failed to track event:', error);
  });
}

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[FCM SW] Installing Firebase Messaging Service Worker');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[FCM SW] Activating Firebase Messaging Service Worker');
  event.waitUntil(clients.claim());
});

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  console.log('[FCM SW] Message received from app:', event.data);

  if (event.data && event.data.type === 'CHECK_FCM_STATUS') {
    event.ports[0].postMessage({
      status: 'active',
      version: '1.0.0'
    });
  }
});

console.log('[FCM SW] Firebase Messaging Service Worker loaded');