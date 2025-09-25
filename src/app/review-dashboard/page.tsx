'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { useReviewData } from '@/hooks/useReviewData';
import { useReviewStats } from '@/hooks/useReviewStats';
import { useXP } from '@/hooks/useXP';
import { StatsOverview } from '@/components/review/dashboard/StatsOverview';
import { RecentActivity } from '@/components/review/dashboard/RecentActivity';
import { ProgressHeatmap } from '@/components/review/charts/ProgressHeatmap';
import { StreakDisplay } from '@/components/review/gamification/StreakDisplay';
import { LevelDisplay } from '@/components/review/gamification/LevelDisplay';
import { UpcomingReviews } from '@/components/review/dashboard/UpcomingReviews';
import { LoadingOverlay } from '@/components/ui/Loading';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import Navbar from '@/components/layout/Navbar';

export default function ReviewDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  // Force refresh of UpcomingReviews when returning from review session
  const [refreshKey, setRefreshKey] = useState(0);

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

  // Use real XP data
  const {
    totalXP,
    currentLevel,
    levelInfo,
    progressPercentage,
    loading: xpLoading
  } = useXP();

  // Combined loading state
  const loading = dataLoading || statsLoading || xpLoading;

  // Fetch real activity data from API
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [realActivities, setRealActivities] = useState<any[]>([]);

  // Generate activity data from sessions - memoized to prevent infinite loops
  const activities = useMemo(() =>
    sessions.slice(0, 10).map((session) => ({
      id: session.id,
      type: 'review' as const,
      timestamp: session.date,
      data: {
        count: session.itemsReviewed
      }
    })), [sessions]);

  // Listen for review completion events
  useEffect(() => {
    const handleReviewComplete = () => {
      console.log('[ReviewDashboard] Review completed, refreshing...');
      setRefreshKey(prev => prev + 1);
    };

    // Check if we're returning from a review session
    const returningFromReview = sessionStorage.getItem('reviewCompleted');
    if (returningFromReview === 'true') {
      sessionStorage.removeItem('reviewCompleted');
      handleReviewComplete();
    }

    // Listen for custom event
    window.addEventListener('reviewCompleted', handleReviewComplete);

    return () => {
      window.removeEventListener('reviewCompleted', handleReviewComplete);
    };
  }, []);

  useEffect(() => {
    const fetchActivityData = async () => {
      if (user && !loading) {
        try {
          const response = await fetch('/api/review/activity');
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Set heatmap data
              if (data.data.heatmapData && data.data.heatmapData.length > 0) {
                setHeatmapData(data.data.heatmapData);
              } else {
                setHeatmapData(generateHeatmapData(sessions));
              }

              // Set recent activity
              if (data.data.recentActivity && data.data.recentActivity.length > 0) {
                const formattedActivities = data.data.recentActivity.map((activity: any) => ({
                  id: activity.id,
                  type: 'review' as const,
                  timestamp: new Date(activity.timestamp),
                  data: {
                    count: activity.itemsReviewed
                  }
                }));
                setRealActivities(formattedActivities);
              } else {
                setRealActivities(activities);
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch activity data:', error);
          // Fallback to generated data
          setHeatmapData(generateHeatmapData(sessions));
          setRealActivities(activities);
        }
      } else {
        // For non-authenticated users, use generated data
        setHeatmapData(generateHeatmapData(sessions));
        setRealActivities(activities);
      }
    };

    fetchActivityData();
  }, [user, sessions, loading, activities]);

  if (authLoading || loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={t('reviewDashboard.loading')}
        showDoshi={true}
        fullScreen={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background-lighter to-background-accent dark:from-dark-900 dark:via-dark-800 dark:to-dark-850">
      {/* Standard Navbar */}
      <Navbar
        user={user}
        showUserMenu={true}
        backLink="/dashboard"
      />

      {/* Learning Page Header - WITHOUT the 3 optional props for simplified usage */}
      <LearningPageHeader
        title={t('reviewDashboard.title')}
        description={t('reviewDashboard.subtitle')}
        mascot="doshi"
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Streak Display - Now at the top of main content for all screen sizes */}
        <div className="mb-6">
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
          {/* Left Column - Activity */}
          <div className="lg:col-span-2 space-y-8">
            {/* Upcoming Reviews Timeline - with refresh key */}
            <UpcomingReviews key={refreshKey} />

            {/* Progress Heatmap - Desktop */}
            <div className="hidden lg:block">
              <ProgressHeatmap data={heatmapData} />
            </div>
          </div>

          {/* Right Column - Activity and Gamification */}
          <div className="space-y-8">
            {/* Level Display - Using real XP data */}
            <LevelDisplay
              currentLevel={currentLevel}
              currentXP={totalXP}
              requiredXP={levelInfo?.xpToNextLevel || 150}
              title={levelInfo?.title || 'Beginner'}
            />

            {/* Recent Activity */}
            <RecentActivity activities={realActivities.length > 0 ? realActivities : activities} />

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

