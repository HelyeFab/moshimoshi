'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { useStory } from '@/hooks/useStories';
import Navbar from '@/components/layout/Navbar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import StoryReader from '@/components/story/StoryReader';

export default function StoryDetailPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const storyId = params.storyId as string;

  const { story, progress, loading, error } = useStory(storyId);

  // Redirect to stories list if story not found
  useEffect(() => {
    if (!loading && error) {
      router.push('/stories');
    }
  }, [loading, error, router]);

  if (loading) {
    return <LoadingOverlay />;
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
        <Navbar user={user} showUserMenu={true} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-semibold mb-2">{t('stories.storyNotFound')}</h2>
            <p className="text-muted-foreground dark:text-dark-400 mb-6">
              {t('stories.storyNotFoundDescription')}
            </p>
            <button
              onClick={() => router.push('/stories')}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              {t('stories.backToStories')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} backLink="/stories" />

      <StoryReader
        story={story}
        progress={progress}
        onProgressUpdate={(updates) => {
          // Progress updates are handled by the hook
          console.log('Progress update:', updates);
        }}
      />
    </div>
  );
}