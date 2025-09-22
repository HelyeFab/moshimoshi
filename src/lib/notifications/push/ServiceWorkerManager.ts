/**
 * ServiceWorkerManager - Manages service worker lifecycle and communication
 * Handles registration, updates, and messaging between app and service workers
 */

interface ServiceWorkerMessage {
  type: string;
  data?: any;
}

interface ServiceWorkerStatus {
  registered: boolean;
  ready: boolean;
  updateAvailable: boolean;
  permission: NotificationPermission;
  version?: string;
}

type MessageHandler = (data: any) => void;

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private mainSW: ServiceWorkerRegistration | null = null;
  private fcmSW: ServiceWorkerRegistration | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private updateAvailable: boolean = false;
  private ready: boolean = false;

  private constructor() {}

  static getInstance(): ServiceWorkerManager {
    if (!this.instance) {
      this.instance = new ServiceWorkerManager();
    }
    return this.instance;
  }

  /**
   * Initialize and register service workers
   */
  async initialize(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('[SWManager] Service Workers not supported');
      return false;
    }

    try {
      // Register main service worker
      await this.registerMainServiceWorker();

      // Register FCM service worker
      await this.registerFCMServiceWorker();

      // Set up message listeners
      this.setupMessageListeners();

      // Check for updates periodically
      this.startUpdateCheck();

      this.ready = true;
      console.log('[SWManager] Service Workers initialized');
      return true;
    } catch (error) {
      console.error('[SWManager] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Register main service worker
   */
  private async registerMainServiceWorker(): Promise<void> {
    try {
      console.log('[SWManager] Registering main service worker');

      this.mainSW = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      // Check for updates
      this.mainSW.addEventListener('updatefound', () => {
        this.handleUpdateFound(this.mainSW!);
      });

      // Handle state changes
      if (this.mainSW.installing) {
        this.trackInstalling(this.mainSW.installing);
      }

      console.log('[SWManager] Main SW registered successfully');
    } catch (error) {
      console.error('[SWManager] Main SW registration failed:', error);
      throw error;
    }
  }

  /**
   * Register Firebase Cloud Messaging service worker
   */
  private async registerFCMServiceWorker(): Promise<void> {
    try {
      console.log('[SWManager] Registering FCM service worker');

      this.fcmSW = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope',
        updateViaCache: 'none'
      });

      console.log('[SWManager] FCM SW registered successfully');
    } catch (error) {
      console.error('[SWManager] FCM SW registration failed:', error);
      // FCM SW is optional, don't throw
    }
  }

  /**
   * Set up message listeners for service worker communication
   */
  private setupMessageListeners(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[SWManager] Message received from SW:', event.data);

      const { type, data } = event.data;

      // Handle specific message types
      switch (type) {
        case 'UPDATE_AVAILABLE':
          this.handleUpdateAvailable();
          break;

        case 'CACHE_STATUS':
          this.handleCacheStatus(data);
          break;

        case 'NOTIFICATION_CLICKED':
          this.handleNotificationClicked(data);
          break;

        case 'SYNC_COMPLETE':
          this.handleSyncComplete(data);
          break;
      }

      // Call registered handlers
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.forEach(handler => handler(data));
      }
    });

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SWManager] Controller changed, new SW active');
      // Reload page to use new service worker
      if (this.updateAvailable) {
        window.location.reload();
      }
    });
  }

  /**
   * Handle update found event
   */
  private handleUpdateFound(registration: ServiceWorkerRegistration): void {
    console.log('[SWManager] Update found');

    const newWorker = registration.installing;
    if (!newWorker) return;

    this.trackInstalling(newWorker);
  }

  /**
   * Track installing worker state
   */
  private trackInstalling(worker: ServiceWorker): void {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker installed, but not yet active
        this.updateAvailable = true;
        this.notifyUpdateAvailable();
      }
    });
  }

  /**
   * Notify app that an update is available
   */
  private notifyUpdateAvailable(): void {
    console.log('[SWManager] Update available');

    // Emit custom event
    const event = new CustomEvent('sw:update-available');
    window.dispatchEvent(event);

    // Call handlers
    const handlers = this.messageHandlers.get('UPDATE_AVAILABLE');
    if (handlers) {
      handlers.forEach(handler => handler({}));
    }
  }

  /**
   * Handle update available message
   */
  private handleUpdateAvailable(): void {
    this.updateAvailable = true;
    this.notifyUpdateAvailable();
  }

  /**
   * Handle cache status message
   */
  private handleCacheStatus(data: any): void {
    console.log('[SWManager] Cache status:', data);
  }

  /**
   * Handle notification clicked message
   */
  private handleNotificationClicked(data: any): void {
    console.log('[SWManager] Notification clicked:', data);

    // Navigate to target URL if provided
    if (data.actionUrl) {
      window.location.href = data.actionUrl;
    }
  }

  /**
   * Handle sync complete message
   */
  private handleSyncComplete(data: any): void {
    console.log('[SWManager] Sync complete:', data);

    // Emit custom event
    const event = new CustomEvent('sw:sync-complete', { detail: data });
    window.dispatchEvent(event);
  }

  /**
   * Send message to service worker
   */
  async sendMessage(message: ServiceWorkerMessage): Promise<any> {
    if (!navigator.serviceWorker.controller) {
      throw new Error('No active service worker');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);
    });
  }

  /**
   * Register a message handler
   */
  onMessage(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }

    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * Schedule a notification via service worker
   */
  async scheduleNotification(delay: number, notification: any): Promise<string> {
    const response = await this.sendMessage({
      type: 'SCHEDULE_NOTIFICATION',
      data: {
        delay,
        notification
      }
    });

    return response.id;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await this.sendMessage({
      type: 'CANCEL_NOTIFICATION',
      data: { id: notificationId }
    });
  }

  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications(): Promise<any[]> {
    const response = await this.sendMessage({
      type: 'GET_SCHEDULED'
    });

    return response.scheduled || [];
  }

  /**
   * Cache specific content
   */
  async cacheContent(urls: string[]): Promise<void> {
    await this.sendMessage({
      type: 'CACHE_CONTENT',
      data: { urls }
    });
  }

  /**
   * Clear cache
   */
  async clearCache(cacheName?: string): Promise<void> {
    await this.sendMessage({
      type: 'CLEAR_CACHE',
      data: { cacheName }
    });
  }

  /**
   * Check notification permission
   */
  async checkPermission(): Promise<NotificationPermission> {
    const response = await this.sendMessage({
      type: 'CHECK_PERMISSION'
    });

    return response.permission;
  }

  /**
   * Apply waiting service worker update
   */
  async applyUpdate(): Promise<void> {
    if (!this.updateAvailable) {
      throw new Error('No update available');
    }

    // Tell waiting SW to skip waiting
    await this.sendMessage({
      type: 'SKIP_WAITING'
    });

    // The controllerchange event will trigger a reload
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.mainSW) {
      return false;
    }

    try {
      await this.mainSW.update();
      return this.updateAvailable;
    } catch (error) {
      console.error('[SWManager] Update check failed:', error);
      return false;
    }
  }

  /**
   * Start periodic update checks
   */
  private startUpdateCheck(): void {
    // Check for updates every hour
    setInterval(() => {
      this.checkForUpdate();
    }, 60 * 60 * 1000);

    // Also check on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdate();
      }
    });
  }

  /**
   * Get service worker status
   */
  getStatus(): ServiceWorkerStatus {
    return {
      registered: this.mainSW !== null,
      ready: this.ready,
      updateAvailable: this.updateAvailable,
      permission: this.getNotificationPermission(),
      version: this.getVersion()
    };
  }

  /**
   * Get current notification permission
   */
  private getNotificationPermission(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Get service worker version
   */
  private getVersion(): string | undefined {
    // This would be set by the SW during registration
    return '2.0.0';
  }

  /**
   * Unregister all service workers
   */
  async unregister(): Promise<void> {
    try {
      if (this.mainSW) {
        await this.mainSW.unregister();
        this.mainSW = null;
      }

      if (this.fcmSW) {
        await this.fcmSW.unregister();
        this.fcmSW = null;
      }

      this.ready = false;
      console.log('[SWManager] Service workers unregistered');
    } catch (error) {
      console.error('[SWManager] Unregister failed:', error);
      throw error;
    }
  }

  /**
   * Check if service workers are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Check if update is available
   */
  hasUpdate(): boolean {
    return this.updateAvailable;
  }
}