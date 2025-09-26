/**
 * Service Worker Registration Module
 * Handles PWA installation and lifecycle management
 */

export interface ServiceWorkerRegistration {
  registration: ServiceWorkerRegistration | null;
  isSupported: boolean;
  isRegistered: boolean;
  error: Error | null;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service Workers are not supported in this browser');
    return {
      registration: null,
      isSupported: false,
      isRegistered: false,
      error: null
    };
  }

  // Only register in production or when explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_ENABLE_SW_DEV) {
    console.log('[SW] Service Worker registration disabled in development');
    return {
      registration: null,
      isSupported: true,
      isRegistered: false,
      error: null
    };
  }

  try {
    // Wait for window load to not impact page performance
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(undefined);
      } else {
        window.addEventListener('load', () => resolve(undefined), { once: true });
      }
    });

    // Register service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    console.log('[SW] Service Worker registered successfully:', registration);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available
            console.log('[SW] New content is available; please refresh.');

            // Dispatch custom event for UI handling
            window.dispatchEvent(new CustomEvent('sw-update-available', {
              detail: { registration }
            }));
          }
        });
      }
    });

    // Check for updates periodically (every hour)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    return {
      registration: registration as any,
      isSupported: true,
      isRegistered: true,
      error: null
    };
  } catch (error) {
    console.error('[SW] Service Worker registration failed:', error);
    return {
      registration: null,
      isSupported: true,
      isRegistered: false,
      error: error as Error
    };
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map(registration => registration.unregister())
    );

    console.log('[SW] All Service Workers unregistered');
    return true;
  } catch (error) {
    console.error('[SW] Failed to unregister Service Workers:', error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker
 */
export async function skipWaiting(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  if (registration.waiting) {
    // Tell service worker to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload page when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });
  }
}

/**
 * Check if app is running in standalone mode (installed PWA)
 */
export function isStandalone(): boolean {
  // Check multiple conditions for standalone mode
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://') ||
    window.location.search.includes('mode=standalone')
  );
}

/**
 * Get service worker registration status
 */
export async function getRegistrationStatus(): Promise<{
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isInstalling: boolean;
}> {
  if (!('serviceWorker' in navigator)) {
    return {
      isRegistered: false,
      isUpdateAvailable: false,
      isInstalling: false
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (!registration) {
      return {
        isRegistered: false,
        isUpdateAvailable: false,
        isInstalling: false
      };
    }

    return {
      isRegistered: true,
      isUpdateAvailable: !!registration.waiting,
      isInstalling: !!registration.installing
    };
  } catch {
    return {
      isRegistered: false,
      isUpdateAvailable: false,
      isInstalling: false
    };
  }
}