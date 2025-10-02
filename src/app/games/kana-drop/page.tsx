'use client';

import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import KanaDropGame from './components/KanaDropGame';

export default function KanaDropPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();

  const handleClose = () => {
    router.push('/games');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} backLink={{ href: '/games', label: t('common.back') }} />

      <LearningPageHeader
        title={t('games.kanaDrop.title')}
        description={t('games.kanaDrop.description')}
      />

      <div className="container mx-auto px-4 py-8">
        <KanaDropGame onClose={handleClose} />
      </div>
    </div>
  );
}