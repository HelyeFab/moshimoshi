'use client';

import { useRouter } from 'next/navigation';
// Navigation is now global via NavigationWrapper in root layout;
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import KanaDropGame from './components/KanaDropGame';
import MobileNavSpacer from '@/components/layout/MobileNavSpacer';

export default function KanaDropPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();

  const handleClose = () => {
    router.push('/games');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Navigation is now global - rendered in root layout */}

      <div className="container mx-auto px-4 py-8">
        <KanaDropGame onClose={handleClose} />
      </div>
      <MobileNavSpacer />
    </div>
  );
}