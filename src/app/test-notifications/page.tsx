'use client';

import { useState, useEffect } from 'react';
import { ServiceWorkerManager } from '@/lib/notifications/push/ServiceWorkerManager';
import { FCMManager } from '@/lib/notifications/push/FCMManager';
import { PushNotificationService } from '@/lib/notifications/push/PushNotificationService';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
// Navigation is now global via NavigationWrapper in root layout;

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
