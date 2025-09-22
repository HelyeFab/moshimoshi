'use client';

import React, { useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import Dialog from '@/components/ui/Dialog';
import type { StudyList } from '@/types/studyList';

interface StudyListCardProps {
  list: StudyList;
  onEdit: () => void;
  onDelete: () => void;
  onReview: () => void;
}

const LIST_TYPE_COLORS = {
  flashcard: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  drillable: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  sentence: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
} as const;

export default function StudyListCard({
  list,
  onEdit,
  onDelete,
  onReview,
}: StudyListCardProps) {
  const { t } = useI18n();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getColorClasses = () => {
    const baseColor = list.color.replace('500', '');
    return {
      border: `border-${baseColor}200 dark:border-${baseColor}800`,
      background: `bg-${baseColor}50 dark:bg-${baseColor}900/20`,
      accent: `bg-${baseColor}500`,
    };
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t('common.today');
    } else if (diffDays === 1) {
      return t('common.yesterday');
    } else if (diffDays < 7) {
      return t('common.daysAgo', { days: diffDays });
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-all hover:shadow-md">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{list.icon || '📝'}</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {list.name}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${LIST_TYPE_COLORS[list.type]}`}>
                {t(`lists.types.${list.type}.short`)}
              </span>
            </div>
          </div>

          {/* Dropdown menu */}
          <div className="relative group/menu">
            <button
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="List options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10">
              <button
                onClick={onEdit}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('lists.actions.edit')}
              </button>
              <button
                onClick={onDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('lists.actions.delete')}
              </button>
            </div>
          </div>
        </div>

        {list.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            {list.description}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {t('lists.stats.items')}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {list.itemIds.length}
          </span>
        </div>

        {list.stats && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('lists.stats.mastered')}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {list.stats.masteredCount}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('lists.stats.learning')}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {list.stats.learningCount}
              </span>
            </div>

            {list.stats.averageAccuracy > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('lists.stats.accuracy')}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.round(list.stats.averageAccuracy)}%
                </span>
              </div>
            )}
          </>
        )}

        <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
          {t('lists.labels.updated')} {formatDate(list.updatedAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="flex-1 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          {t('lists.actions.delete')}
        </button>
        <button
          onClick={onReview}
          disabled={list.itemIds.length === 0}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {t('lists.actions.review')}
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={onDelete}
        title={t('lists.deleteDialog.title')}
        message={t('lists.deleteDialog.message', { name: list.name })}
        confirmText={t('lists.deleteDialog.confirm')}
        cancelText={t('lists.deleteDialog.cancel')}
        type="danger"
      />
    </div>
  );
}