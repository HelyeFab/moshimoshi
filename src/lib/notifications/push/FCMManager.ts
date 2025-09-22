import { getMessaging, getToken, onMessage, Messaging, deleteToken } from 'firebase/messaging';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { app } from '@/lib/firebase/config';

interface FCMConfig {
  vapidKey: string;
  userId?: string;
  onMessage?: (payload: any) => void;
  onTokenRefresh?: (token: string) => void;
}

interface DeviceInfo {
  platform: string;
  browser: string;
  version: string;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isPWA: boolean;
}

export class FCMManager {
  private static instance: FCMManager;
  private messaging: Messaging | null = null;
  private currentToken: string | null = null;
  private userId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private config: FCMConfig | null = null;

  private constructor() {}

  static getInstance(): FCMManager {
    if (!this.instance) {
      this.instance = new FCMManager();
    }
    return this.instance;
  }

  /**
   * Initialize FCM with configuration
   */
  async initialize(config: FCMConfig): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('[FCM] Push notifications not supported in this environment');
      return false;
    }

    try {
      this.config = config;
      this.userId = config.userId || null;

      // Initialize Firebase Messaging
      this.messaging = getMessaging(app);

      // Register service workers
      await this.registerServiceWorkers();

      // Get or refresh FCM token
      const token = await this.getToken();

      if (token) {
        // Listen for foreground messages
        this.listenForMessages();

        // Set up token refresh monitoring
        this.monitorTokenRefresh();

        console.log('[FCM] Initialized successfully');
        return true;
      } else {
        console.warn('[FCM] No token available');
        return false;
      }
    } catch (error) {
      console.error('[FCM] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Register service workers
   */
  private async registerServiceWorkers(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    try {
      // Register main service worker
      const mainSW = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[FCM] Main Service Worker registered:', mainSW);

      // Register Firebase messaging service worker
      const fcmSW = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope'
      });
      console.log('[FCM] Firebase Messaging SW registered:', fcmSW);

      // Wait for service workers to be ready
      await navigator.serviceWorker.ready;
    } catch (error) {
      console.error('[FCM] Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Get or refresh FCM token
   */
  async getToken(): Promise<string | null> {
    if (!this.messaging || !this.config?.vapidKey) {
      throw new Error('FCM not initialized properly');
    }

    try {
      // Request notification permission if needed
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.warn('[FCM] Notification permission denied');
        return null;
      }

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: this.config.vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.ready
      });

      if (token) {
        // Check if token has changed
        if (token !== this.currentToken) {
          this.currentToken = token;
          await this.saveToken(token);

          // Notify token refresh callback
          if (this.config.onTokenRefresh) {
            this.config.onTokenRefresh(token);
          }
        }

        return token;
      } else {
        console.warn('[FCM] No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('[FCM] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Request notification permission
   */
  private async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[FCM] Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Save FCM token to Firestore
   */
  private async saveToken(token: string): Promise<void> {
    if (!this.userId) {
      console.warn('[FCM] No user ID, skipping token save');
      return;
    }

    try {
      const deviceInfo = this.getDeviceInfo();
      const tokenDoc = doc(db, 'notifications_tokens', this.userId);

      // Check if document exists
      const docSnap = await getDoc(tokenDoc);

      const tokenData = {
        fcm_token: token,
        fcm_token_updated: new Date(),
        device_info: deviceInfo,
        last_active: new Date(),
        notification_permission: Notification.permission
      };

      if (docSnap.exists()) {
        // Update existing document
        await updateDoc(tokenDoc, tokenData);
      } else {
        // Create new document
        await setDoc(tokenDoc, {
          userId: this.userId,
          ...tokenData,
          created_at: new Date()
        });
      }

      console.log('[FCM] Token saved to Firestore');
    } catch (error) {
      console.error('[FCM] Failed to save token:', error);
    }
  }

  /**
   * Listen for foreground messages
   */
  private listenForMessages(): void {
    if (!this.messaging) return;

    // Clean up existing listener
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.unsubscribe = onMessage(this.messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

      // Call custom message handler if provided
      if (this.config?.onMessage) {
        this.config.onMessage(payload);
      }

      // Emit custom event for app-wide handling
      const event = new CustomEvent('fcm:message', {
        detail: payload
      });
      window.dispatchEvent(event);

      // Show notification if page is not visible
      if (document.hidden) {
        this.showForegroundNotification(payload);
      }
    });
  }

  /**
   * Show notification for foreground messages when page is hidden
   */
  private async showForegroundNotification(payload: any): Promise<void> {
    const { title, body, icon, image } = payload.notification || {};
    const { clickAction, ...data } = payload.data || {};

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title || 'Moshimoshi', {
        body: body || 'You have a new notification',
        icon: icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        image,
        data,
        tag: 'fcm-foreground',
        renotify: true,
        vibrate: [200, 100, 200]
      });

      notification.onclick = () => {
        window.focus();
        if (clickAction) {
          window.location.href = clickAction;
        }
        notification.close();
      };
    }
  }

  /**
   * Monitor token refresh
   */
  private monitorTokenRefresh(): void {
    // Check token every 30 minutes
    this.tokenRefreshInterval = setInterval(async () => {
      try {
        const newToken = await this.getToken();
        if (newToken && newToken !== this.currentToken) {
          console.log('[FCM] Token refreshed');
        }
      } catch (error) {
        console.error('[FCM] Token refresh check failed:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  /**
   * Delete FCM token (for logout/unsubscribe)
   */
  async deleteToken(): Promise<void> {
    if (!this.messaging) return;

    try {
      await deleteToken(this.messaging);
      this.currentToken = null;

      // Remove token from Firestore
      if (this.userId) {
        const tokenDoc = doc(db, 'notifications_tokens', this.userId);
        await updateDoc(tokenDoc, {
          fcm_token: null,
          fcm_token_updated: new Date()
        });
      }

      console.log('[FCM] Token deleted');
    } catch (error) {
      console.error('[FCM] Failed to delete token:', error);
    }
  }

  /**
   * Send push notification to a specific device
   */
  async sendToDevice(params: {
    token: string;
    title: string;
    body: string;
    data?: any;
    icon?: string;
    badge?: string;
    image?: string;
  }): Promise<void> {
    const response = await fetch('/api/notifications/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Failed to send push notification');
    }
  }

  /**
   * Send push notification to current user
   */
  async sendToCurrentUser(params: {
    title: string;
    body: string;
    data?: any;
    icon?: string;
    badge?: string;
    image?: string;
  }): Promise<void> {
    if (!this.currentToken) {
      throw new Error('No FCM token available');
    }

    await this.sendToDevice({
      token: this.currentToken,
      ...params
    });
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' &&
           'Notification' in window &&
           'serviceWorker' in navigator &&
           'PushManager' in window;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform || '';

    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.matchMedia('(display-mode: fullscreen)').matches ||
                  (window.navigator as any).standalone === true;

    // Detect platform
    const isIOS = /iphone|ipad|ipod/.test(userAgent) ||
                  (platform.toLowerCase().includes('mac') && 'ontouchend' in document);
    const isAndroid = /android/.test(userAgent);
    const isMobile = isIOS || isAndroid || /mobile/.test(userAgent);

    // Detect browser
    let browser = 'unknown';
    if (userAgent.includes('firefox')) browser = 'firefox';
    else if (userAgent.includes('safari') && !userAgent.includes('chrome')) browser = 'safari';
    else if (userAgent.includes('opr') || userAgent.includes('opera')) browser = 'opera';
    else if (userAgent.includes('edge')) browser = 'edge';
    else if (userAgent.includes('chrome')) browser = 'chrome';

    return {
      platform,
      browser,
      version: navigator.appVersion,
      isMobile,
      isIOS,
      isAndroid,
      isPWA
    };
  }

  /**
   * Update user ID (after login)
   */
  async updateUserId(userId: string): Promise<void> {
    this.userId = userId;

    // Re-save token with new user ID
    if (this.currentToken) {
      await this.saveToken(this.currentToken);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Stop token refresh monitoring
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }

    // Unsubscribe from messages
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Clear references
    this.messaging = null;
    this.currentToken = null;
    this.config = null;

    console.log('[FCM] Cleaned up');
  }

  /**
   * Get current FCM token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Check if FCM is initialized
   */
  isInitialized(): boolean {
    return this.messaging !== null && this.currentToken !== null;
  }
}