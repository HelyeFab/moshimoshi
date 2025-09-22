'use client';

import { useState, useEffect } from 'react';
import { ServiceWorkerManager } from '@/lib/notifications/push/ServiceWorkerManager';
import { FCMManager } from '@/lib/notifications/push/FCMManager';
import { PushNotificationService } from '@/lib/notifications/push/PushNotificationService';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import Navbar from '@/components/layout/Navbar';

export default function TestNotificationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [swStatus, setSwStatus] = useState<any>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    // Check initial SW status and notification permission
    if (typeof window !== 'undefined') {
      checkServiceWorkerStatus();
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  const checkServiceWorkerStatus = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        setSwStatus({
          supported: true,
          registrations: registrations.length,
          controller: navigator.serviceWorker.controller ? 'Active' : 'None'
        });
        addLog(`Service Worker supported. ${registrations.length} registrations found.`);
      } else {
        setSwStatus({ supported: false });
        addLog('Service Workers not supported in this browser.');
      }
    } catch (error) {
      addLog(`Error checking SW status: ${error}`);
    }
  };

  const initializeServiceWorker = async () => {
    setIsLoading(true);
    addLog('Initializing Service Worker Manager...');

    try {
      const swManager = ServiceWorkerManager.getInstance();
      const initialized = await swManager.initialize();

      if (initialized) {
        addLog('✅ Service Worker Manager initialized successfully');
        const status = swManager.getStatus();
        setSwStatus(status);
        addLog(`SW Status: ${JSON.stringify(status)}`);
      } else {
        addLog('❌ Failed to initialize Service Worker Manager');
      }
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeFCM = async () => {
    if (!user) {
      addLog('❌ Please login first to initialize FCM');
      return;
    }

    setIsLoading(true);
    addLog('Initializing FCM...');

    try {
      const fcmManager = FCMManager.getInstance();

      // Use a test VAPID key for now (you'll need to add your actual key)
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BH8-hBARBqmSJqSQGmFx_zu7gKJcDHfz3TzG9d5TQwYq2cETfs8Qy2rZpPHLHZMKJJpz5FdogUW3WHJ_9Cp5bWE';

      const initialized = await fcmManager.initialize({
        vapidKey,
        userId: user.uid,
        onMessage: (payload) => {
          addLog(`📨 FCM Message received: ${JSON.stringify(payload)}`);
        },
        onTokenRefresh: (token) => {
          addLog(`🔄 FCM Token refreshed: ${token.substring(0, 20)}...`);
          setFcmToken(token);
        }
      });

      if (initialized) {
        addLog('✅ FCM initialized successfully');
        const token = fcmManager.getCurrentToken();
        if (token) {
          setFcmToken(token);
          addLog(`FCM Token: ${token.substring(0, 20)}...`);
        }
      } else {
        addLog('❌ Failed to initialize FCM');
      }
    } catch (error) {
      addLog(`❌ FCM Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    addLog('Requesting notification permission...');

    if (!('Notification' in window)) {
      addLog('❌ Notifications not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    addLog(`Permission result: ${permission}`);

    if (permission === 'granted') {
      addLog('✅ Notification permission granted');
    } else if (permission === 'denied') {
      addLog('❌ Notification permission denied');
    } else {
      addLog('⚠️ Notification permission dismissed');
    }
  };

  const testBrowserNotification = () => {
    addLog('Testing browser notification...');

    if (!('Notification' in window)) {
      addLog('❌ Notifications not supported');
      return;
    }

    if (notificationPermission !== 'granted') {
      addLog('❌ Permission not granted. Please grant permission first.');
      return;
    }

    const notification = new Notification('Test Notification', {
      body: 'This is a test browser notification from Moshimoshi!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: 'test-notification',
      requireInteraction: true
    });

    notification.onclick = () => {
      addLog('Notification clicked!');
      notification.close();
    };

    addLog('✅ Browser notification sent');
  };

  const testServiceWorkerNotification = async () => {
    addLog('Testing SW notification...');

    try {
      const swManager = ServiceWorkerManager.getInstance();

      if (!swManager.isReady()) {
        addLog('❌ Service Worker not ready. Initialize first.');
        return;
      }

      const id = await swManager.scheduleNotification(5000, {
        title: 'SW Test Notification',
        options: {
          body: 'This notification was scheduled via Service Worker!',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'sw-test',
          requireInteraction: true
        }
      });

      addLog(`✅ SW notification scheduled (ID: ${id}). Will appear in 5 seconds...`);
    } catch (error) {
      addLog(`❌ SW notification error: ${error}`);
    }
  };

  const testPushNotification = async () => {
    if (!user) {
      addLog('❌ Please login first');
      return;
    }

    if (!fcmToken) {
      addLog('❌ No FCM token available. Initialize FCM first.');
      return;
    }

    addLog('Testing push notification...');

    try {
      const pushService = PushNotificationService.getInstance();
      await pushService.sendNotification(user.uid, {
        title: '🎯 Review Time!',
        body: 'You have 5 reviews due. Keep your streak going!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'review-reminder',
        data: {
          type: 'review_due',
          count: 5,
          actionUrl: '/review'
        },
        requireInteraction: true
      });

      addLog('✅ Push notification sent successfully');
    } catch (error) {
      addLog(`❌ Push notification error: ${error}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background-soft to-background">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-soft-white dark:bg-dark-900 rounded-xl shadow-soft p-8">
          <h1 className="text-3xl font-bold text-text-primary dark:text-dark-100 mb-6">
            Notification System Test Page
          </h1>

          {/* Status Section */}
          <div className="mb-8 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Status</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Service Worker:</span>{' '}
                {swStatus ? (
                  swStatus.supported ? (
                    <span className="text-green-600">Supported ✓</span>
                  ) : (
                    <span className="text-red-600">Not Supported ✗</span>
                  )
                ) : (
                  <span className="text-gray-500">Checking...</span>
                )}
              </div>
              <div>
                <span className="font-medium">Notification Permission:</span>{' '}
                <span className={
                  notificationPermission === 'granted' ? 'text-green-600' :
                  notificationPermission === 'denied' ? 'text-red-600' :
                  'text-yellow-600'
                }>
                  {notificationPermission}
                </span>
              </div>
              <div>
                <span className="font-medium">FCM Token:</span>{' '}
                {fcmToken ? (
                  <span className="text-green-600">Available ✓</span>
                ) : (
                  <span className="text-gray-500">Not initialized</span>
                )}
              </div>
              {user && (
                <div>
                  <span className="font-medium">User ID:</span>{' '}
                  <span className="text-xs font-mono">{user.uid}</span>
                </div>
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3">Controls</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={initializeServiceWorker}
                disabled={isLoading}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                Initialize SW
              </button>

              <button
                onClick={requestNotificationPermission}
                disabled={isLoading}
                className="px-4 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 disabled:opacity-50 transition-colors"
              >
                Request Permission
              </button>

              <button
                onClick={initializeFCM}
                disabled={isLoading || !user}
                className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 transition-colors"
              >
                Initialize FCM
              </button>

              <button
                onClick={testBrowserNotification}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                Test Browser
              </button>

              <button
                onClick={testServiceWorkerNotification}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
              >
                Test SW (5s delay)
              </button>

              <button
                onClick={testPushNotification}
                disabled={isLoading || !user || !fcmToken}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                Test Push
              </button>
            </div>
          </div>

          {/* Logs Section */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">Logs</h2>
              <button
                onClick={clearLogs}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-dark-700 rounded hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet. Click a button to start testing.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <h3 className="font-semibold mb-2">Testing Steps:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Initialize Service Worker Manager</li>
              <li>Request notification permission if not granted</li>
              <li>Login if you want to test FCM (push notifications)</li>
              <li>Initialize FCM (requires login)</li>
              <li>Test different notification types using the buttons</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}