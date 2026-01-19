/**
 * Service Worker Registration Module
 * Handles PWA installation and lifecycle management
 *
 * In development: Uses service-worker.dev.js (pass-through, no caching)
 * In production: Uses service-worker.js (full caching)
 *
 * @see /docs/pwa/06-dev-vs-prod-service-worker.md for switching guide
 */

export interface ServiceWorkerRegistration {
  registration: ServiceWorkerRegistration | null;
  isSupported: boolean;
  isRegistered: boolean;
  error: Error | null;
}

/**
 * Determine which service worker to use based on environment
 */
function getServiceWorkerPath(): { path: string; mode: 'development' | 'production' } {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const forceProduction = process.env.NEXT_PUBLIC_FORCE_PROD_SW === 'true';
  const swVersion = process.env.NEXT_PUBLIC_SW_VERSION?.trim();

  if (isDevelopment && !forceProduction) {
    return { path: '/service-worker.dev.js', mode: 'development' };
  }

  const suffix = swVersion ? `?v=${encodeURIComponent(swVersion)}` : '';
  return { path: `/service-worker.js${suffix}`, mode: 'production' };
}

/**
 * Log which service worker is being used with visual distinction
 */
function logServiceWorkerMode(mode: 'development' | 'production', path: string): void {
  if (mode === 'development') {
    console.log(
      '%c[SW] Using DEVELOPMENT Service Worker',
      'background: #fbbf24; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
    );
    console.log('[SW] Path:', path);
    console.log('[SW] Mode: Pass-through (no caching)');
    console.log('[SW] To use production SW, set NEXT_PUBLIC_FORCE_PROD_SW=true');
  } else {
    console.log(
      '%c[SW] Using PRODUCTION Service Worker',
      'background: #22c55e; color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
    );
    console.log('[SW] Path:', path);
    console.log('[SW] Mode: Full caching enabled');
  }
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

  if (process.env.NEXT_PUBLIC_DISABLE_SW === 'true') {
    console.log('[SW] Service Worker registration disabled via NEXT_PUBLIC_DISABLE_SW');
    return {
      registration: null,
      isSupported: true,
      isRegistered: false,
      error: null
    };
  }

  // Only register in production or when explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_ENABLE_SW_DEV) {
    console.log('[SW] Service Worker registration disabled in development');
    console.log('[SW] To enable, set NEXT_PUBLIC_ENABLE_SW_DEV=true in .env.local');
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

    // Determine which service worker to use
    const { path: swPath, mode } = getServiceWorkerPath();

    // Log which SW we're using
    logServiceWorkerMode(mode, swPath);

    // Register service worker with updateViaCache: 'none' for dev to ensure fresh SW
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
      updateViaCache: 'none'
    });

    console.log('[SW] Service Worker registered successfully');
    console.log('[SW] Scope:', registration.scope);
    console.log('[SW] Active:', registration.active?.state || 'none');
    console.log('[SW] Waiting:', registration.waiting?.state || 'none');
    console.log('[SW] Installing:', registration.installing?.state || 'none');

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
 * @param providedRegistration - Optional registration from the update event
 */
export async function skipWaiting(providedRegistration?: globalThis.ServiceWorkerRegistration): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return false;
  }

  try {
    // Use provided registration or get the current one
    const registration = providedRegistration || await navigator.serviceWorker.getRegistration();

    if (!registration) {
      console.log('[SW] No service worker registration found');
      return false;
    }

    if (registration.waiting) {
      console.log('[SW] Found waiting service worker, sending SKIP_WAITING message');

      // Tell service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Reload page when new service worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] Controller changed, reloading page');
        window.location.reload();
      }, { once: true });

      return true;
    } else {
      console.log('[SW] No waiting service worker found, reloading to get latest version');
      // If no waiting SW, just reload to ensure we get the latest
      window.location.reload();
      return true;
    }
  } catch (error) {
    console.error('[SW] Error in skipWaiting:', error);
    // Fallback: just reload the page
    window.location.reload();
    return false;
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
