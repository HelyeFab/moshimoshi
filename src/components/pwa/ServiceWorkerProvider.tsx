'use client';

import { useEffect, useState, useContext } from 'react';
import { registerServiceWorker, skipWaiting } from '@/lib/pwa/registerServiceWorker';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useI18n } from '@/i18n/I18nContext';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { showToast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    // Register service worker on mount
    registerServiceWorker();

    // Listen for update events
    const handleUpdate = () => {
      setUpdateAvailable(true);

      // Use fallbacks in case i18n isn't ready yet (t() returns the key if not found)
      const titleKey = 'pwa.updateAvailable';
      const descKey = 'pwa.updateDescription';
      const btnKey = 'pwa.updateNow';

      const titleResult = t(titleKey);
      const descResult = t(descKey);
      const btnResult = t(btnKey);

      const title = titleResult !== titleKey ? titleResult : 'Update available';
      const description = descResult !== descKey ? descResult : 'A new version is available. Update now for the latest features.';
      const buttonLabel = btnResult !== btnKey ? btnResult : 'Update Now';

      showToast(
        `${title}: ${description}`,
        'info',
        0, // Duration 0 keeps it visible
        {
          label: buttonLabel,
          onClick: () => {
            skipWaiting();
          }
        }
      );
    };

    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, [showToast, t]);

  return <>{children}</>;
}