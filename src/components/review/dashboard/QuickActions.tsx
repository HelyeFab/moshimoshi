'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { 
  Play, 
  Timer, 
  Sliders, 
  FolderOpen, 
  Plus, 
  Settings,
  Sparkles,
  Zap
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  badge?: string | number;
  showSparkle?: boolean;
}

function ActionButton({ 
  icon, 
  label, 
  description, 
  onClick, 
  variant = 'secondary',
  disabled = false,
  badge,
  showSparkle
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative group p-4 rounded-xl border transition-all duration-200',
        'hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed',
        'disabled:hover:scale-100 disabled:hover:shadow-none',
        variant === 'primary' 
          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white border-primary-600' 
          : 'bg-soft-white dark:bg-dark-800 border-gray-200 dark:border-dark-700',
        variant === 'secondary' && 'hover:bg-gray-50 dark:hover:bg-dark-700'
      )}
    >
      {showSparkle && (
        <div className="absolute -top-1 -right-1">
          <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
        </div>
      )}
      
      {badge !== undefined && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
          {badge}
        </div>
      )}
      
      <div className="flex items-start space-x-3">
        <div className={cn(
          'p-2 rounded-lg',
          variant === 'primary' 
            ? 'bg-soft-white/20' 
            : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
        )}>
          {icon}
        </div>
        <div className="flex-1 text-left">
          <p className={cn(
            'font-semibold',
            variant === 'secondary' && 'text-gray-900 dark:text-gray-100'
          )}>
            {label}
          </p>
          <p className={cn(
            'text-sm mt-0.5',
            variant === 'primary' 
              ? 'text-white/80' 
              : 'text-gray-600 dark:text-gray-400'
          )}>
            {description}
          </p>
        </div>
      </div>
      
      {/* Keyboard shortcut hint */}
      {variant === 'primary' && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <kbd className="px-2 py-1 text-xs bg-soft-white/20 rounded">Space</kbd>
        </div>
      )}
    </button>
  );
}

interface QuickActionsProps {
  dueCount: number;
  onStartDaily: () => void;
  onQuickSession: () => void;
  onCustomReview: () => void;
  onBrowseSets: () => void;
  onAddItems: () => void;
  onSettings: () => void;
}

export function QuickActions({
  dueCount,
  onStartDaily,
  onQuickSession,
  onCustomReview,
  onBrowseSets,
  onAddItems,
  onSettings,
}: QuickActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 border border-gray-200 dark:border-dark-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {t('review.dashboard.quickActions.title')}
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionButton
          icon={<Play className="h-5 w-5" />}
          label={t('review.dashboard.quickActions.startDaily')}
          description={t('review.dashboard.quickActions.startDailyDescription', { count: dueCount })}
          onClick={onStartDaily}
          variant="primary"
          badge={dueCount > 0 ? dueCount : undefined}
          showSparkle={dueCount > 20}
        />
        
        <ActionButton
          icon={<Timer className="h-5 w-5" />}
          label={t('review.dashboard.quickActions.quickSession')}
          description={t('review.dashboard.quickActions.quickSessionDescription')}
          onClick={onQuickSession}
        />
        
        <ActionButton
          icon={<Sliders className="h-5 w-5" />}
          label={t('review.dashboard.quickActions.customReview')}
          description={t('review.dashboard.quickActions.customReviewDescription')}
          onClick={onCustomReview}
        />
        
        <ActionButton
          icon={<FolderOpen className="h-5 w-5" />}
          label={t('review.dashboard.quickActions.browseSets')}
          description={t('review.dashboard.quickActions.browseSetsDescription')}
          onClick={onBrowseSets}
        />
        
        <ActionButton
          icon={<Plus className="h-5 w-5" />}
          label={t('review.dashboard.quickActions.addItems')}
          description={t('review.dashboard.quickActions.addItemsDescription')}
          onClick={onAddItems}
        />
        
        <ActionButton
          icon={<Settings className="h-5 w-5" />}
          label={t('review.dashboard.quickActions.settings')}
          description={t('review.dashboard.quickActions.settingsDescription')}
          onClick={onSettings}
        />
      </div>
      
      {/* Keyboard shortcuts hint */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded">Space</kbd> Start Review
          <span className="mx-2">•</span>
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded">Q</kbd> Quick Session
          <span className="mx-2">•</span>
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded">N</kbd> Add New
        </p>
      </div>
    </div>
  );
}