'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n/I18nContext';
import { useToast } from '@/components/ui/Toast';
import { studyListManager } from '@/lib/study-lists/StudyListManager';
import featuresConfig from '@/../config/features.v1.json';
import type {
  StudyList,
  StudyListType,
  CreateStudyListInput,
  StudyListColor,
} from '@/types/studyList';
import { STUDY_LIST_COLORS } from '@/types/studyList';

interface ListSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateList: (input: CreateStudyListInput) => Promise<void>;
  currentLists: StudyList[];
  userPlan: 'guest' | 'free' | 'premium';
}

type CreateMode = 'select' | 'create';

const LIST_TYPE_INFO = {
  flashcard: {
    icon: '📚',
    colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
  drillable: {
    icon: '✏️',
    colorClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  },
  sentence: {
    icon: '💬',
    colorClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  },
} as const;

export default function ListSelectionModal({
  isOpen,
  onClose,
  onCreateList,
  currentLists,
  userPlan,
}: ListSelectionModalProps) {
  const { t, strings } = useI18n();
  const { showToast } = useToast();

  const [mode, setMode] = useState<CreateMode>('select');
  const [selectedType, setSelectedType] = useState<StudyListType | null>(null);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState<StudyListColor>(STUDY_LIST_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState('📝');
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMode('select');
      setSelectedType(null);
      setListName('');
      setListDescription('');
      setSelectedColor(STUDY_LIST_COLORS[0]);
      setSelectedIcon('📝');
    }
  }, [isOpen]);

  // Get list limits from features config
  const getListLimits = () => {
    const feature = featuresConfig.features.find(f => f.id === 'custom_lists');
    const metadata = feature?.metadata as any;
    const maxLists = metadata?.maxListsPerUser?.[userPlan] ??
                     (userPlan === 'premium' ? -1 : userPlan === 'free' ? 10 : 0);
    return maxLists;
  };

  // Check if user can create more lists
  const canCreateList = () => {
    if (userPlan === 'guest') return false;
    const maxLists = getListLimits();
    if (maxLists === -1) return true; // Unlimited for premium
    return currentLists.length < maxLists;
  };

  const getRemainingLists = () => {
    const maxLists = getListLimits();
    if (maxLists === -1) return -1; // Unlimited
    return Math.max(0, maxLists - currentLists.length);
  };

  const handleTypeSelect = (type: StudyListType) => {
    if (!canCreateList()) {
      showToast(
        t('lists.errors.limitReached'),
        'warning',
        5000,
        {
          label: t('common.upgrade'),
          onClick: () => window.location.href = '/pricing',
        }
      );
      return;
    }

    setSelectedType(type);
    setMode('create');

    // Set default icon based on type
    const defaultIcons = {
      flashcard: '📚',
      drillable: '✏️',
      sentence: '💬',
    };
    setSelectedIcon(defaultIcons[type]);
  };

  const handleCreate = async () => {
    if (!listName.trim()) {
      showToast(t('lists.errors.nameRequired'), 'error');
      return;
    }

    if (!selectedType) {
      showToast(t('lists.errors.typeRequired'), 'error');
      return;
    }

    setIsCreating(true);

    try {
      await onCreateList({
        name: listName.trim(),
        description: listDescription.trim(),
        type: selectedType,
        color: selectedColor,
        icon: selectedIcon,
      });

      showToast(t('lists.success.created'), 'success');
      onClose();
    } catch (error) {
      console.error('Failed to create list:', error);
      showToast(t('lists.errors.createFailed'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const renderTypeSelection = () => (
    <div className="space-y-4">
      <p className="text-gray-600 dark:text-gray-400 text-sm">
        {t('lists.modal.selectType')}
      </p>

      <div className="grid gap-3">
        {/* Flashcard List */}
        <button
          onClick={() => handleTypeSelect('flashcard')}
          className="group relative p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-all hover:shadow-md"
          disabled={!canCreateList()}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${LIST_TYPE_INFO.flashcard.colorClass}`}>
              <span className="text-2xl">{LIST_TYPE_INFO.flashcard.icon}</span>
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('lists.types.flashcard.name')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('lists.types.flashcard.description')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {t('lists.types.flashcard.accepts')}
              </p>
            </div>
          </div>
        </button>

        {/* Drillable List */}
        <button
          onClick={() => handleTypeSelect('drillable')}
          className="group relative p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-all hover:shadow-md"
          disabled={!canCreateList()}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${LIST_TYPE_INFO.drillable.colorClass}`}>
              <span className="text-2xl">{LIST_TYPE_INFO.drillable.icon}</span>
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('lists.types.drillable.name')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('lists.types.drillable.description')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {t('lists.types.drillable.accepts')}
              </p>
            </div>
          </div>
        </button>

        {/* Sentence List */}
        <button
          onClick={() => handleTypeSelect('sentence')}
          className="group relative p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-all hover:shadow-md"
          disabled={!canCreateList()}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${LIST_TYPE_INFO.sentence.colorClass}`}>
              <span className="text-2xl">{LIST_TYPE_INFO.sentence.icon}</span>
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('lists.types.sentence.name')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('lists.types.sentence.description')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {t('lists.types.sentence.accepts')}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Quota Info */}
      {userPlan === 'free' && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t('lists.quota.remaining', { count: getRemainingLists() })}
          </p>
        </div>
      )}

      {userPlan === 'guest' && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            {t('lists.quota.guestLimit')}
          </p>
        </div>
      )}
    </div>
  );

  const renderCreateForm = () => (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => setMode('select')}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('common.back')}
      </button>

      {/* Selected type indicator */}
      {selectedType && (
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${LIST_TYPE_INFO[selectedType].colorClass}`}>
          <span>{LIST_TYPE_INFO[selectedType].icon}</span>
          <span className="text-sm font-medium">
            {t(`lists.types.${selectedType}.name`)}
          </span>
        </div>
      )}

      {/* List name */}
      <div>
        <label htmlFor="list-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('lists.fields.name')} *
        </label>
        <input
          id="list-name"
          type="text"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder={t('lists.placeholders.name')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          maxLength={50}
          autoFocus
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {listName.length}/50
        </p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="list-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('lists.fields.description')}
        </label>
        <textarea
          id="list-description"
          value={listDescription}
          onChange={(e) => setListDescription(e.target.value)}
          placeholder={t('lists.placeholders.description')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          rows={3}
          maxLength={200}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {listDescription.length}/200
        </p>
      </div>

      {/* Color selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('lists.fields.color')}
        </label>
        <div className="flex flex-wrap gap-2">
          {STUDY_LIST_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`
                w-8 h-8 rounded-full transition-all
                ${color === 'primary-500' ? 'bg-primary-500' : ''}
                ${color === 'accent-500' ? 'bg-accent-500' : ''}
                ${color === 'success-500' ? 'bg-success-500' : ''}
                ${color === 'warning-500' ? 'bg-warning-500' : ''}
                ${color === 'danger-500' ? 'bg-danger-500' : ''}
                ${color === 'purple-500' ? 'bg-purple-500' : ''}
                ${color === 'indigo-500' ? 'bg-indigo-500' : ''}
                ${color === 'teal-500' ? 'bg-teal-500' : ''}
                ${color === 'orange-500' ? 'bg-orange-500' : ''}
                ${color === 'pink-500' ? 'bg-pink-500' : ''}
                ${selectedColor === color ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-105'}
              `}
              aria-label={`Select ${color} color`}
            />
          ))}
        </div>
      </div>

      {/* Icon selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('lists.fields.icon')}
        </label>
        <div className="flex flex-wrap gap-2">
          {['📝', '📚', '✏️', '💬', '🎯', '⭐', '🔥', '💡', '🎓', '🌸'].map((icon) => (
            <button
              key={icon}
              onClick={() => setSelectedIcon(icon)}
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center text-xl
                border-2 transition-all
                ${selectedIcon === icon
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
              aria-label={`Select ${icon} icon`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleCreate}
          disabled={isCreating || !listName.trim()}
          className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? t('common.creating') : t('lists.actions.create')}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'select' ? t('lists.modal.title') : t('lists.modal.createTitle')}
      size="md"
    >
      {mode === 'select' ? renderTypeSelection() : renderCreateForm()}
    </Modal>
  );
}