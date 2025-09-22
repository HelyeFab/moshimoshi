'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Clock, 
  CheckCircle, 
  Pin, 
  Trophy, 
  Flame,
  TrendingUp,
  ChevronDown,
  Calendar
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface ActivityItem {
  id: string;
  type: 'review' | 'pin' | 'achievement' | 'streak' | 'levelUp';
  timestamp: Date;
  data: any;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  const icons = {
    review: <CheckCircle className="h-5 w-5" />,
    pin: <Pin className="h-5 w-5" />,
    achievement: <Trophy className="h-5 w-5" />,
    streak: <Flame className="h-5 w-5" />,
    levelUp: <TrendingUp className="h-5 w-5" />,
  };

  const colors = {
    review: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    pin: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    achievement: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    streak: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    levelUp: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className={cn('p-2 rounded-lg', colors[type])}>
      {icons[type]}
    </div>
  );
}

function ActivityDescription({ activity, t }: { activity: ActivityItem; t: any }) {
  switch (activity.type) {
    case 'review':
      return <span>{t('review.dashboard.activity.types.review', { count: activity.data.count })}</span>;
    case 'pin':
      return <span>{t('review.dashboard.activity.types.pin', { count: activity.data.count })}</span>;
    case 'achievement':
      return (
        <span>
          {t('review.dashboard.activity.types.achievement')}
          <span className="font-medium text-yellow-600 dark:text-yellow-400 ml-1">
            {activity.data.achievement}
          </span>
        </span>
      );
    case 'streak':
      return <span>{t('review.dashboard.activity.types.streak')}</span>;
    case 'levelUp':
      return (
        <span>
          {t('review.dashboard.activity.types.levelUp', { level: activity.data.level })}
        </span>
      );
    default:
      return null;
  }
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  
  const displayedActivities = showAll ? activities : activities.slice(0, 5);
  
  // Group activities by time period
  const groupedActivities = displayedActivities.reduce((groups, activity) => {
    const now = new Date();
    const activityDate = new Date(activity.timestamp);
    const daysDiff = Math.floor((now.getTime() - activityDate.getTime()) / 86400000);
    
    let period: string;
    if (daysDiff === 0) {
      period = t('review.dashboard.activity.today');
    } else if (daysDiff === 1) {
      period = t('review.dashboard.activity.yesterday');
    } else if (daysDiff < 7) {
      period = t('review.dashboard.activity.thisWeek');
    } else {
      period = activityDate.toLocaleDateString();
    }
    
    if (!groups[period]) {
      groups[period] = [];
    }
    groups[period].push(activity);
    return groups;
  }, {} as Record<string, ActivityItem[]>);

  return (
    <div className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 border border-gray-200 dark:border-dark-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('review.dashboard.activity.title')}
        </h2>
        <Clock className="h-5 w-5 text-gray-400" />
      </div>
      
      {activities.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No recent activity
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {Object.entries(groupedActivities).map(([period, periodActivities]) => (
              <div key={period}>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {period}
                </h3>
                <div className="space-y-3">
                  {periodActivities.map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-start space-x-3 group"
                    >
                      {/* Timeline indicator */}
                      <div className="relative">
                        <ActivityIcon type={activity.type} />
                        {/* Connect line for timeline effect */}
                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-gray-200 dark:bg-dark-700 -z-10" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <ActivityDescription activity={activity} t={t} />
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {getRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Load more button */}
          {activities.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 w-full py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg transition-colors flex items-center justify-center space-x-1"
            >
              <span>{showAll ? 'Show Less' : t('review.dashboard.activity.loadMore')}</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showAll && 'rotate-180')} />
            </button>
          )}
        </>
      )}
    </div>
  );
}