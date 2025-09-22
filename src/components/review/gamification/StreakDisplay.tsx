'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Flame, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StreakDisplayProps {
  currentStreak: number;
  bestStreak: number;
  lastReviewDate: Date;
  showCalendar?: boolean;
  animated?: boolean;
}

export function StreakDisplay({ 
  currentStreak, 
  bestStreak, 
  lastReviewDate,
  showCalendar = false,
  animated = true 
}: StreakDisplayProps) {
  const { t } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Check if streak is about to be lost
  const now = new Date();
  const hoursSinceLastReview = (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60);
  const isInDanger = hoursSinceLastReview > 20 && hoursSinceLastReview < 24;
  const isLost = hoursSinceLastReview >= 24;
  
  useEffect(() => {
    if (animated && currentStreak > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentStreak, animated]);
  
  const getFlameColor = () => {
    if (isLost) return 'text-gray-400';
    if (currentStreak === 0) return 'text-gray-400';
    if (currentStreak < 3) return 'text-orange-400';
    if (currentStreak < 7) return 'text-orange-500';
    if (currentStreak < 30) return 'text-orange-600';
    return 'text-red-600';
  };
  
  const getFlameSize = () => {
    if (currentStreak < 3) return 'h-8 w-8';
    if (currentStreak < 7) return 'h-10 w-10';
    if (currentStreak < 30) return 'h-12 w-12';
    return 'h-14 w-14';
  };

  // Generate calendar data for the last 30 days
  const calendarData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const isReviewDay = i < 30 - currentStreak ? false : !isLost;
    return {
      date,
      hasReview: isReviewDay,
      isToday: i === 29,
    };
  });

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={cn(
          'flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200',
          'hover:bg-gray-100 dark:hover:bg-dark-700',
          isInDanger && 'bg-yellow-50 dark:bg-yellow-900/20 animate-pulse'
        )}
      >
        {/* Flame Icon with Animation */}
        <div className="relative">
          <Flame 
            className={cn(
              getFlameSize(),
              getFlameColor(),
              isAnimating && 'animate-bounce',
              currentStreak > 0 && !isLost && 'drop-shadow-glow'
            )}
            fill={currentStreak > 0 && !isLost ? 'currentColor' : 'none'}
          />
          {currentStreak >= 7 && !isLost && (
            <>
              {/* Flame particles animation */}
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                <div className="flame-particle" />
                <div className="flame-particle flame-particle-2" />
                <div className="flame-particle flame-particle-3" />
              </div>
            </>
          )}
        </div>
        
        {/* Streak Info */}
        <div className="text-left">
          <div className="flex items-center space-x-2">
            <span className={cn(
              'text-2xl font-bold',
              isLost ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'
            )}>
              {currentStreak}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('review.dashboard.gamification.streak.current', { count: currentStreak }).replace(`${currentStreak} `, '')}
            </span>
          </div>
          
          {/* Status Message */}
          <div className="text-xs">
            {isLost ? (
              <span className="text-red-600 dark:text-red-400">
                {t('review.dashboard.gamification.streak.lost')}
              </span>
            ) : isInDanger ? (
              <span className="text-yellow-600 dark:text-yellow-400 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t('review.dashboard.gamification.streak.frozenWarning')}
              </span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">
                {t('review.dashboard.gamification.streak.best', { count: bestStreak })}
              </span>
            )}
          </div>
        </div>
        
        {/* Achievement Badge for Milestones */}
        {currentStreak >= 7 && currentStreak % 7 === 0 && !isLost && (
          <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full px-2 py-1 animate-pulse">
            {currentStreak === 7 && 'Week!'}
            {currentStreak === 30 && 'Month!'}
            {currentStreak === 100 && 'Century!'}
            {currentStreak === 365 && 'Year!'}
          </div>
        )}
      </button>
      
      {/* Expandable Details */}
      {showDetails && (
        <div className="absolute top-full mt-2 right-0 bg-soft-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 p-4 z-10 min-w-[300px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Streak Calendar</h3>
            <Calendar className="h-4 w-4 text-gray-400" />
          </div>
          
          {/* Mini Calendar */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-xs text-center text-gray-500 dark:text-gray-400 font-medium">
                {day}
              </div>
            ))}
            {calendarData.slice(-28).map((day, i) => (
              <div
                key={i}
                className={cn(
                  'aspect-square rounded flex items-center justify-center text-xs',
                  day.hasReview 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-400',
                  day.isToday && 'ring-2 ring-primary-500'
                )}
                title={day.date.toLocaleDateString()}
              >
                {day.date.getDate()}
              </div>
            ))}
          </div>
          
          {/* Stats */}
          <div className="border-t border-gray-200 dark:border-dark-700 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Current Streak</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{currentStreak} days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Best Streak</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{bestStreak} days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Last Review</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {lastReviewDate.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-20px) scale(0);
            opacity: 0;
          }
        }
        
        .flame-particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #f97316;
          border-radius: 50%;
          animation: float-up 1s ease-out infinite;
        }
        
        .flame-particle-2 {
          left: -4px;
          animation-delay: 0.3s;
        }
        
        .flame-particle-3 {
          left: 4px;
          animation-delay: 0.6s;
        }
        
        .drop-shadow-glow {
          filter: drop-shadow(0 0 8px currentColor);
        }
      `}</style>
    </div>
  );
}