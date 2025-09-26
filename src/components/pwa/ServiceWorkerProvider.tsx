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

      showToast(
        `${t('pwa.updateAvailable')}: ${t('pwa.updateDescription')}`,
        'info',
        0, // Duration 0 keeps it visible
        {
          label: t('pwa.updateNow'),
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