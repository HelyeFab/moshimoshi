'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
// Navigation is now global via NavigationWrapper in root layout;
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import KanjiSimonBoardSelection from './components/KanjiSimonBoardSelection';
import MobileNavSpacer from '@/components/layout/MobileNavSpacer';

export default function KanjiSimonPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, strings } = useI18n();
  const [showInstructions, setShowInstructions] = useState(true);

  const handleBoardSelect = (boardId: string) => {
    router.push(`/games/kanji-simon/${boardId}`);
  };

  const handleBack = () => {
    router.push('/games');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background-light/90 to-primary-100/20 dark:from-dark-850 dark:via-dark-900 dark:to-primary-900/10">
      {/* Navigation is now global - rendered in root layout */}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <main className="max-w-7xl mx-auto mb-32 md:mb-8 pb-safe">

          {/* Instructions Card */}
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 max-w-4xl mx-auto"
            >
              <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-border/50">
                <h2 className="text-2xl font-bold text-center text-foreground mb-6">
                  {strings.games?.kanjiSimon?.howToPlay || 'How to Play'}
                </h2>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                        1
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">
                          {strings.games?.kanjiSimon?.step1Title || 'Watch Pattern'}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {strings.games?.kanjiSimon?.step1Desc || 'Kanji segments light up in sequence'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                        2
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">
                          {strings.games?.kanjiSimon?.step2Title || 'Memorize'}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {strings.games?.kanjiSimon?.step2Desc || 'Remember the order of readings'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                        3
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">
                          {strings.games?.kanjiSimon?.step3Title || 'Repeat'}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {strings.games?.kanjiSimon?.step3Desc || 'Click segments in the same order'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                        4
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">
                          {strings.games?.kanjiSimon?.step4Title || 'Level Up'}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {strings.games?.kanjiSimon?.step4Desc || 'Sequences get longer as you progress'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium text-lg transition-colors"
                  >
                    {strings.games?.kanjiSimon?.startButton || 'Choose Board & Start'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Board Selection */}
          {!showInstructions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <KanjiSimonBoardSelection onSelect={handleBoardSelect} />
            </motion.div>
          )}
        </main>
      </div>
      <MobileNavSpacer />
    </div>
  );
}