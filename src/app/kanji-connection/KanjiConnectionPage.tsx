'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';

export default function KanjiConnectionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleNavigate = (path: string) => {
    setLoading(true);
    router.push(path);
  };

  const features = [
    {
      id: 'families',
      title: t('kanjiConnection.families.title'),
      subtitle: t('kanjiConnection.families.subtitle'),
      description: t('kanjiConnection.families.description'),
      icon: '👨‍👩‍👧‍👦',
      color: 'from-purple-400 to-pink-500',
      href: '/kanji-connection/families',
      stats: '60+ families'
    },
    {
      id: 'radicals',
      title: t('kanjiConnection.radicals.title'),
      subtitle: t('kanjiConnection.radicals.subtitle'),
      description: t('kanjiConnection.radicals.description'),
      icon: '🌊',
      color: 'from-blue-400 to-cyan-500',
      href: '/kanji-connection/radicals',
      stats: '20+ radicals'
    },
    {
      id: 'visual',
      title: t('kanjiConnection.visualLayout.title'),
      subtitle: t('kanjiConnection.visualLayout.subtitle'),
      description: t('kanjiConnection.visualLayout.description'),
      icon: '🎨',
      color: 'from-green-400 to-emerald-500',
      href: '/kanji-connection/visual-layout',
      stats: '4 patterns'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* Learning Page Header with all components hidden */}
      <LearningPageHeader
        title={t('kanjiConnection.title')}
        description={t('kanjiConnection.subtitle')}
        subtitle={`${t('kanjiConnection.howItWorks.description')} • ${t('kanjiConnection.howItWorks.step1')} • ${t('kanjiConnection.howItWorks.step2')} • ${t('kanjiConnection.howItWorks.step3')}`}
        showProgress={false}
        showModeSelector={false}
        showModeInfo={false}
        mascot="doshi"
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 pt-8 pb-8">

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigate(feature.href)}
              className="cursor-pointer"
            >
              <div className="bg-card dark:bg-dark-800 rounded-xl shadow-lg overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all">
                {/* Gradient Header */}
                <div className={`h-2 bg-gradient-to-r ${feature.color}`} />

                <div className="p-6">
                  {/* Icon and Stats */}
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl">{feature.icon}</span>
                    <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-sm rounded-full font-medium">
                      {feature.stats}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold mb-2 text-foreground dark:text-dark-50">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-dark-400 mb-1">
                    {feature.subtitle}
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-dark-300">
                    {feature.description}
                  </p>

                  {/* Hover Indicator */}
                  <div className="mt-4 flex items-center text-primary-600 dark:text-primary-400">
                    <span className="text-sm font-medium">{t('common.explore')}</span>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}