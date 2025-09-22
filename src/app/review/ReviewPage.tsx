'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { StatsOverview } from '@/components/review/dashboard/StatsOverview';
import { QuickActions } from '@/components/review/dashboard/QuickActions';
import { ReviewQueue } from '@/components/review/dashboard/ReviewQueue';
import { RecentActivity } from '@/components/review/dashboard/RecentActivity';
import { ProgressHeatmap } from '@/components/review/charts/ProgressHeatmap';
import { StreakDisplay } from '@/components/review/gamification/StreakDisplay';
import { LevelDisplay } from '@/components/review/gamification/LevelDisplay';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

// Mock data for development
const mockStats = {
  dueNow: 15,
  newItems: 32,
  learningItems: 48,
  masteredItems: 156,
  todaysGoal: 30,
  todaysProgress: 12,
  currentStreak: 7,
  bestStreak: 14,
};

const mockQueueItems = [
  { id: '1', type: 'hiragana' as const, content: 'あ', meaning: 'a', dueIn: 0 },
  { id: '2', type: 'hiragana' as const, content: 'か', meaning: 'ka', dueIn: 0 },
  { id: '3', type: 'katakana' as const, content: 'ア', meaning: 'a', dueIn: 0 },
  { id: '4', type: 'kanji' as const, content: '日', meaning: 'sun/day', dueIn: 1 },
  { id: '5', type: 'vocabulary' as const, content: '本', meaning: 'book', dueIn: 2 },
];

const mockActivities = [
  { id: '1', type: 'review' as const, timestamp: new Date(Date.now() - 1000 * 60 * 30), data: { count: 15 } },
  { id: '2', type: 'pin' as const, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), data: { count: 5 } },
  { id: '3', type: 'streak' as const, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), data: {} },
  { id: '4', type: 'achievement' as const, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), data: { achievement: 'Week Warrior' } },
];

const mockHeatmapData = Array.from({ length: 365 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (364 - i));
  return {
    date: date.toISOString().split('T')[0],
    count: Math.floor(Math.random() * 50),
  };
});

export default function ReviewDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(mockStats);
  const [queueItems, setQueueItems] = useState(mockQueueItems);
  const [activities, setActivities] = useState(mockActivities);
  const [heatmapData, setHeatmapData] = useState(mockHeatmapData);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
              onStartDaily={() => console.log('Start daily review')}
              onQuickSession={() => console.log('Start quick session')}
              onCustomReview={() => console.log('Custom review')}
              onBrowseSets={() => console.log('Browse sets')}
              onAddItems={() => console.log('Add items')}
              onSettings={() => console.log('Settings')}
            />

            {/* Review Queue */}
            <ReviewQueue
              items={queueItems}
              onStartReview={(items) => console.log('Start review with', items)}
              onItemClick={(item) => console.log('Clicked item', item)}
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