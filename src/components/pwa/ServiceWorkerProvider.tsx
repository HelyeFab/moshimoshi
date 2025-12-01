'use client';

import { useEffect, useState, useRef } from 'react';
import { registerServiceWorker, skipWaiting } from '@/lib/pwa/registerServiceWorker';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useI18n } from '@/i18n/I18nContext';

const SESSION_KEY = 'sw-update-toast-shown';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { showToast, removeToast } = useToast();
  const { t } = useI18n();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Register service worker on mount
    registerServiceWorker();

    // Listen for update events
    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ registration: ServiceWorkerRegistration }>;

      // Store the registration for later use
      if (customEvent.detail?.registration) {
        registrationRef.current = customEvent.detail.registration;
      }

      setUpdateAvailable(true);

      // Check if we've already shown the toast this session
      if (sessionStorage.getItem(SESSION_KEY)) {
        console.log('[SW] Update toast already shown this session, skipping');
        return;
      }

      // Mark as shown for this session
      sessionStorage.setItem(SESSION_KEY, 'true');

      // Use fallbacks in case i18n isn't ready yet (t() returns the key if not found)
      const titleKey = 'pwa.updateAvailable';
      const descKey = 'pwa.updateDescription';
      const btnKey = 'pwa.updateNow';

      const titleResult = t(titleKey);
      const descResult = t(descKey);
      const btnResult = t(btnKey);

      const title = titleResult !== titleKey ? titleResult : 'Update available';
      const description = descResult !== descKey ? descResult : 'A new version is available.';
      const buttonLabel = btnResult !== btnKey ? btnResult : 'Update Now';

      showToast(
        `${title}: ${description}`,
        'info',
        10000, // Auto-dismiss after 10 seconds instead of staying forever
        {
          label: buttonLabel,
          onClick: () => {
            console.log('[SW] Update Now clicked');
            // Pass the stored registration to skipWaiting
            skipWaiting(registrationRef.current || undefined);
          }
        }
      );
    };

    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, [showToast, removeToast, t]);

  return <>{children}</>;
}