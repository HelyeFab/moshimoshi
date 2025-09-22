'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useReviewData } from '@/hooks/useReviewData';
import { useReviewStats } from '@/hooks/useReviewStats';
import { StatsOverview } from '@/components/review/dashboard/StatsOverview';
import { QuickActions } from '@/components/review/dashboard/QuickActions';
import { ReviewQueue } from '@/components/review/dashboard/ReviewQueue';
import { RecentActivity } from '@/components/review/dashboard/RecentActivity';
import { ProgressHeatmap } from '@/components/review/charts/ProgressHeatmap';
import { StreakDisplay } from '@/components/review/gamification/StreakDisplay';
import { LevelDisplay } from '@/components/review/gamification/LevelDisplay';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReviewDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  // Use real data hooks instead of mock data
  const {
    queueItems,
    sessions,
    currentSession,
    loading: dataLoading,
    error: dataError
  } = useReviewData();

  const {
    stats,
    loading: statsLoading,
    error: statsError
  } = useReviewStats();

  // Generate activity data from sessions
  const activities = sessions.slice(0, 4).map((session, index) => ({
    id: session.id,
    type: index === 0 ? 'review' as const : index === 1 ? 'pin' as const : index === 2 ? 'streak' as const : 'achievement' as const,
    timestamp: session.date,
    data: {
      count: session.itemsReviewed,
      achievement: index === 3 ? 'Week Warrior' : undefined
    }
  }));

  // Generate heatmap data from sessions
  const heatmapData = generateHeatmapData(sessions);

  // Combined loading state
  const loading = dataLoading || statsLoading;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {t('review.dashboard.loading')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-850">
      {/* Header */}
      <header className="bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('review.dashboard.title')}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('review.dashboard.subtitle')}
                </p>
              </div>
            </div>
            
            {/* Streak Display */}
            <div className="hidden sm:block">
              <StreakDisplay
                currentStreak={stats.currentStreak}
                bestStreak={stats.bestStreak}
                lastReviewDate={new Date()}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Streak Display */}
        <div className="sm:hidden mb-6">
          <StreakDisplay
            currentStreak={stats.currentStreak}
            bestStreak={stats.bestStreak}
            lastReviewDate={new Date()}
          />
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <StatsOverview stats={stats} />
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Queue and Activity */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <QuickActions
              dueCount={stats.dueNow}
              onStartDaily={() => router.push('/review/session?mode=daily')}
              onQuickSession={() => router.push('/review/session?mode=quick')}
              onCustomReview={() => router.push('/review/custom')}
              onBrowseSets={() => router.push('/learn')}
              onAddItems={() => router.push('/review/add')}
              onSettings={() => router.push('/settings/review')}
            />

            {/* Review Queue */}
            <ReviewQueue
              items={queueItems}
              onStartReview={(items) => {
                // Store selected items in session storage and navigate to review
                sessionStorage.setItem('reviewItems', JSON.stringify(items));
                router.push('/review/session');
              }}
              onItemClick={(item) => {
                // Navigate to item details
                router.push(`/review/item/${item.id}`);
              }}
            />

            {/* Progress Heatmap - Desktop */}
            <div className="hidden lg:block">
              <ProgressHeatmap data={heatmapData} />
            </div>
          </div>

          {/* Right Column - Activity and Gamification */}
          <div className="space-y-8">
            {/* Level Display */}
            <LevelDisplay
              currentLevel={5}
              currentXP={450}
              requiredXP={600}
              title="Student"
            />

            {/* Recent Activity */}
            <RecentActivity activities={activities} />

            {/* Progress Heatmap - Mobile/Tablet */}
            <div className="lg:hidden">
              <ProgressHeatmap data={heatmapData} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper function to generate heatmap data from sessions
function generateHeatmapData(sessions: any[]) {
  const heatmap: { [key: string]: number } = {};
  const today = new Date();

  // Initialize last 365 days with 0
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    heatmap[dateStr] = 0;
  }

  // Add session data
  sessions.forEach(session => {
    const dateStr = new Date(session.date).toISOString().split('T')[0];
    if (heatmap.hasOwnProperty(dateStr)) {
      heatmap[dateStr] += session.itemsReviewed || 0;
    }
  });

  // Convert to array format
  return Object.entries(heatmap).map(([date, count]) => ({ date, count }));
}