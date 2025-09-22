'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n/I18nContext';
import { useToast } from '@/components/ui/Toast';
import { studyListManager } from '@/lib/study-lists/StudyListManager';
import ListSelectionModal from './ListSelectionModal';
import type {
  StudyList,
  StudyItemType,
  AddToListInput,
  CreateStudyListInput,
} from '@/types/studyList';
import type { VocabularyWord } from '@/types/vocabulary';
import type { KanjiData } from '@/types/kanji';

interface SaveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: VocabularyWord | KanjiData | { text: string; meaning: string } | null;
  itemType: StudyItemType;
  itemId: string;
  userPlan: 'guest' | 'free' | 'premium';
}

const ITEM_TYPE_ICONS = {
  word: '📖',
  kanji: '漢',
  sentence: '💬',
  phrase: '🗣️',
} as const;

export default function SaveItemModal({
  isOpen,
  onClose,
  item,
  itemType,
  itemId,
  userPlan,
}: SaveItemModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [lists, setLists] = useState<StudyList[]>([]);
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [existingLists, setExistingLists] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  // Load user's lists and check existing associations
  useEffect(() => {
    if (!isOpen || !item) return;

    const loadLists = async () => {
      setIsLoading(true);
      try {
        // Get all user's lists
        const userLists = await studyListManager.getLists();
        setLists(userLists);

        // Find existing saved item to check current lists
        const savedItems = await studyListManager.getItems({
          itemType: itemType,
        });

        const existingItem = savedItems.find(si => {
          const itemKey = `${itemType}Id`;
          return si[itemKey as keyof typeof si] === itemId;
        });

        if (existingItem) {
          setExistingLists(new Set(existingItem.listIds));
          setSelectedLists(new Set(existingItem.listIds));
          setNotes(existingItem.notes || '');
          setTags(existingItem.tags?.join(', ') || '');
        }
      } catch (error) {
        console.error('Failed to load lists:', error);
        showToast(t('lists.errors.loadFailed'), 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadLists();
  }, [isOpen, item, itemType, itemId, t, showToast]);

  // Filter lists based on compatibility and search
  const compatibleLists = useMemo(() => {
    if (!lists.length) return [];

    return lists.filter(list => {
      // Check type compatibility
      const canAdd = studyListManager.canAddToList(list.type, itemType, item);
      if (!canAdd) return false;

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          list.name.toLowerCase().includes(query) ||
          list.description?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [lists, itemType, item, searchQuery]);

  // Get incompatible lists for display
  const incompatibleLists = useMemo(() => {
    return lists.filter(list =>
      !studyListManager.canAddToList(list.type, itemType, item)
    );
  }, [lists, itemType, item]);

  const handleListToggle = (listId: string) => {
    setSelectedLists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (selectedLists.size === 0) {
      showToast(t('lists.errors.noListSelected'), 'warning');
      return;
    }

    setIsSaving(true);

    try {
      const input: AddToListInput = {
        itemType,
        itemId,
        listIds: Array.from(selectedLists),
        notes: notes.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
      };

      await studyListManager.addToLists(input);

      // Determine what changed
      const added = Array.from(selectedLists).filter(id => !existingLists.has(id));
      const removed = Array.from(existingLists).filter(id => !selectedLists.has(id));

      // Remove from lists that were deselected
      for (const listId of removed) {
        const savedItems = await studyListManager.getItems({ itemType });
        const savedItem = savedItems.find(si => {
          const itemKey = `${itemType}Id`;
          return si[itemKey as keyof typeof si] === itemId;
        });

        if (savedItem) {
          await studyListManager.removeFromList(savedItem.id, listId);
        }
      }

      // Show appropriate message
      if (added.length > 0) {
        showToast(
          t('lists.success.itemAdded', { count: added.length }),
          'success'
        );
      } else if (removed.length > 0) {
        showToast(
          t('lists.success.itemRemoved', { count: removed.length }),
          'success'
        );
      } else {
        showToast(t('lists.success.itemUpdated'), 'success');
      }

      onClose();
    } catch (error) {
      console.error('Failed to save item:', error);
      showToast(t('lists.errors.saveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateList = async (input: CreateStudyListInput) => {
    try {
      const newList = await studyListManager.createList(input);
      setLists(prev => [...prev, newList]);

      // Auto-select the new list if compatible
      if (studyListManager.canAddToList(newList.type, itemType, item)) {
        setSelectedLists(prev => new Set([...prev, newList.id]));
      }

      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create list:', error);
      throw error;
    }
  };

  const getItemDisplay = () => {
    if (!item) return { primary: '', secondary: '', icon: ITEM_TYPE_ICONS.word };

    if ('kanji' in item && 'meanings' in item) {
      // KanjiData
      const kanjiItem = item as KanjiData;
      return {
        primary: kanjiItem.kanji,
        secondary: kanjiItem.meanings[0] || '',
        icon: ITEM_TYPE_ICONS.kanji,
      };
    } else if ('word' in item && 'reading' in item) {
      // VocabularyWord
      const wordItem = item as VocabularyWord;
      return {
        primary: wordItem.word,
        secondary: wordItem.meaning,
        reading: wordItem.reading,
        icon: ITEM_TYPE_ICONS.word,
      };
    } else {
      // Sentence or phrase
      const sentenceItem = item as { text: string; meaning: string };
      return {
        primary: sentenceItem.text,
        secondary: sentenceItem.meaning,
        icon: itemType === 'sentence' ? ITEM_TYPE_ICONS.sentence : ITEM_TYPE_ICONS.phrase,
      };
    }
  };

  const itemDisplay = getItemDisplay();

  const renderListItem = (list: StudyList, isCompatible: boolean) => {
    const isSelected = selectedLists.has(list.id);
    const isExisting = existingLists.has(list.id);
    const colorClass = list.color.replace('500', isCompatible ? '100' : '50');
    const darkColorClass = list.color.replace('500', isCompatible ? '900/30' : '900/10');

    return (
      <label
        key={list.id}
        className={`
          flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer
          ${isCompatible ? 'hover:shadow-md' : 'opacity-50 cursor-not-allowed'}
          ${isSelected
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
          ${!isCompatible ? 'pointer-events-none' : ''}
        `}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleListToggle(list.id)}
          disabled={!isCompatible}
          className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
        />

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
              bg-${colorClass} dark:bg-${darkColorClass}
            `}>
              <span>{list.icon || '📝'}</span>
              {list.name}
            </span>
            {isExisting && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('lists.labels.alreadySaved')}
              </span>
            )}
          </div>
          {list.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {list.description}
            </p>
          )}
          {!isCompatible && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {t('lists.errors.incompatibleType')}
            </p>
          )}
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {t('lists.labels.itemCount', { count: list.itemIds.length })}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {t(`lists.types.${list.type}.short`)}
            </span>
          </div>
        </div>
      </label>
    );
  };

  if (!item) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('lists.modal.saveTitle')}
        size="lg"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Item preview */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{itemDisplay.icon}</span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {itemDisplay.primary}
                    </span>
                    {itemDisplay.reading && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {itemDisplay.reading}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {itemDisplay.secondary}
                  </p>
                </div>
              </div>
            </div>

            {/* Search bar */}
            {lists.length > 5 && (
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('lists.placeholders.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}

            {/* Lists */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {compatibleLists.length === 0 && incompatibleLists.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {t('lists.empty.noLists')}
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('lists.actions.createFirst')}
                  </button>
                </div>
              ) : (
                <>
                  {compatibleLists.map(list => renderListItem(list, true))}

                  {incompatibleLists.length > 0 && searchQuery === '' && (
                    <>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 mb-2">
                        {t('lists.labels.incompatibleLists')}
                      </div>
                      {incompatibleLists.map(list => renderListItem(list, false))}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Notes and tags */}
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('lists.fields.notes')}
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('lists.placeholders.notes')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('lists.fields.tags')}
                </label>
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t('lists.placeholders.tags')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('lists.actions.createNew')}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedLists.size === 0}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create List Modal */}
      <ListSelectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateList={handleCreateList}
        currentLists={lists}
        userPlan={userPlan}
      />
    </>
  );
}