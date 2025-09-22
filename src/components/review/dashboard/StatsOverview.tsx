'use client';

import { ReactNode } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Clock, 
  Sparkles, 
  BookOpen, 
  Trophy, 
  Target, 
  Flame,
  TrendingUp,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface StatsCardProps {
  label: string;
  value: number | string;
  description?: string;
  change?: number;
  icon: ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'orange';
  onClick?: () => void;
  isUrgent?: boolean;
}

function StatsCard({ 
  label, 
  value, 
  description,
  change, 
  icon, 
  color, 
  onClick,
  isUrgent 
}: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/40',
    green: 'bg-green-100 dark:bg-green-900/40',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/40',
    purple: 'bg-purple-100 dark:bg-purple-900/40',
    red: 'bg-red-100 dark:bg-red-900/40',
    orange: 'bg-orange-100 dark:bg-orange-900/40',
  };

  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border transition-all duration-200',
        colorClasses[color],
        onClick && 'cursor-pointer hover:scale-105 hover:shadow-lg',
        isUrgent && 'animate-pulse'
      )}
      onClick={onClick}
    >
      {isUrgent && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
      )}
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {description && (
            <p className="text-xs opacity-60 mt-1">{description}</p>
          )}
          {change !== undefined && (
            <div className="flex items-center mt-2 text-xs">
              {change > 0 ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  <span className="text-green-600 dark:text-green-400">+{change}%</span>
                </>
              ) : change < 0 ? (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  <span className="text-red-600 dark:text-red-400">{change}%</span>
                </>
              ) : (
                <span className="opacity-60">No change</span>
              )}
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-lg', iconBgClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface StatsOverviewProps {
  stats: {
    dueNow: number;
    newItems: number;
    learningItems: number;
    masteredItems: number;
    todaysGoal: number;
    todaysProgress: number;
    currentStreak: number;
  };
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const { t } = useTranslation();
  
  const goalPercentage = Math.round((stats.todaysProgress / stats.todaysGoal) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatsCard
        label={t('review.dashboard.stats.dueNow')}
        value={stats.dueNow}
        description={t('review.dashboard.stats.dueNowDescription')}
        icon={<Clock className="h-5 w-5" />}
        color="red"
        isUrgent={stats.dueNow > 0}
        onClick={() => console.log('Start review')}
      />
      
      <StatsCard
        label={t('review.dashboard.stats.newItems')}
        value={stats.newItems}
        description={t('review.dashboard.stats.newItemsDescription')}
        icon={<Sparkles className="h-5 w-5" />}
        color="blue"
      />
      
      <StatsCard
        label={t('review.dashboard.stats.learningItems')}
        value={stats.learningItems}
        description={t('review.dashboard.stats.learningItemsDescription')}
        icon={<BookOpen className="h-5 w-5" />}
        color="yellow"
        change={5}
      />
      
      <StatsCard
        label={t('review.dashboard.stats.masteredItems')}
        value={stats.masteredItems}
        description={t('review.dashboard.stats.masteredItemsDescription')}
        icon={<Trophy className="h-5 w-5" />}
        color="green"
        change={12}
      />
      
      <StatsCard
        label={t('review.dashboard.stats.todaysGoal')}
        value={`${stats.todaysProgress}/${stats.todaysGoal}`}
        description={`${goalPercentage}% complete`}
        icon={<Target className="h-5 w-5" />}
        color="purple"
      />
      
      <StatsCard
        label={t('review.dashboard.stats.currentStreak')}
        value={`${stats.currentStreak} days`}
        description={t('review.dashboard.stats.currentStreakDescription')}
        icon={<Flame className="h-5 w-5" />}
        color="orange"
      />
    </div>
  );
}