'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { TrendingUp, Star, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

interface LevelDisplayProps {
  currentLevel: number;
  currentXP: number;
  requiredXP: number;
  title: string;
}

function getLevelTitle(level: number, t: any): string {
  if (level <= 10) return t('review.dashboard.gamification.level.titles.beginner');
  if (level <= 25) return t('review.dashboard.gamification.level.titles.student');
  if (level <= 50) return t('review.dashboard.gamification.level.titles.practitioner');
  if (level <= 75) return t('review.dashboard.gamification.level.titles.expert');
  if (level <= 99) return t('review.dashboard.gamification.level.titles.master');
  return t('review.dashboard.gamification.level.titles.sensei');
}

function getLevelColor(level: number): string {
  if (level <= 10) return 'from-gray-400 to-gray-600';
  if (level <= 25) return 'from-green-400 to-green-600';
  if (level <= 50) return 'from-blue-400 to-blue-600';
  if (level <= 75) return 'from-purple-400 to-purple-600';
  if (level <= 99) return 'from-orange-400 to-orange-600';
  return 'from-yellow-400 to-yellow-600';
}

function getBadgeIcon(level: number) {
  if (level <= 10) return '🌱';
  if (level <= 25) return '📚';
  if (level <= 50) return '⚔️';
  if (level <= 75) return '🎯';
  if (level <= 99) return '👑';
  return '🏆';
}

export function LevelDisplay({ currentLevel, currentXP, requiredXP, title }: LevelDisplayProps) {
  const { t } = useTranslation();
  const [animatedXP, setAnimatedXP] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  
  const percentage = (currentXP / requiredXP) * 100;
  const nextLevelTitle = getLevelTitle(currentLevel + 1, t);
  const currentLevelColor = getLevelColor(currentLevel);
  const badgeIcon = getBadgeIcon(currentLevel);
  
  // Animate XP bar fill
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedXP(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);
  
  // Check for level up
  useEffect(() => {
    if (currentXP >= requiredXP) {
      setShowLevelUp(true);
      const timer = setTimeout(() => setShowLevelUp(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentXP, requiredXP]);

  return (
    <div className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 border border-gray-200 dark:border-dark-700">
      {/* Level Up Animation */}
      {showLevelUp && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-2xl animate-bounce">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-bold">LEVEL UP!</span>
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={cn(
            'h-12 w-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-2xl shadow-lg',
            currentLevelColor
          )}>
            {badgeIcon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
              {t('review.dashboard.gamification.level.current', { level: currentLevel })}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {title || getLevelTitle(currentLevel, t)}
            </p>
          </div>
        </div>
        <TrendingUp className="h-5 w-5 text-gray-400" />
      </div>
      
      {/* XP Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">XP Progress</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {t('review.dashboard.gamification.level.xp', { current: currentXP, required: requiredXP })}
          </span>
        </div>
        
        <div className="relative h-3 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full bg-stripes" />
          </div>
          
          {/* Progress fill */}
          <div 
            className={cn(
              'absolute inset-y-0 left-0 bg-gradient-to-r rounded-full transition-all duration-1000 ease-out',
              currentLevelColor
            )}
            style={{ width: `${animatedXP}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
          
          {/* Milestone markers */}
          <div className="absolute inset-0 flex">
            {[25, 50, 75].map((milestone) => (
              <div
                key={milestone}
                className="absolute h-full w-0.5 bg-gray-300 dark:bg-dark-600"
                style={{ left: `${milestone}%` }}
              />
            ))}
          </div>
        </div>
        
        {/* XP gained animation */}
        {animatedXP > 0 && animatedXP < 100 && (
          <div className="flex justify-end mt-1">
            <span className="text-xs text-green-600 dark:text-green-400 animate-fade-in">
              +10 XP
            </span>
          </div>
        )}
      </div>
      
      {/* Next Level Info */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
          <span>Next:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {nextLevelTitle}
          </span>
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          {requiredXP - currentXP} XP to go
        </div>
      </div>
      
      {/* Level Benefits (optional) */}
      {currentLevel % 5 === 0 && (
        <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <span className="text-xs text-primary-700 dark:text-primary-300">
              Milestone reward unlocked!
            </span>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        @keyframes fade-in {
          0% { 
            opacity: 0;
            transform: translateY(10px);
          }
          100% { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        
        .bg-stripes {
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(0, 0, 0, 0.1) 10px,
            rgba(0, 0, 0, 0.1) 20px
          );
        }
      `}</style>
    </div>
  );
}