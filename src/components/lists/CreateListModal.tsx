'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useSessionRefresh } from '@/hooks/useSessionRefresh';
import { listManager } from '@/lib/lists/ListManager';
import { useToast } from '@/components/ui/Toast/ToastContext';
import type { ListType, CreateListRequest } from '@/types/userLists';
import { LIST_COLORS, DEFAULT_LIST_EMOJIS, SUGGESTED_EMOJIS } from '@/types/userLists';
import { motion } from 'framer-motion';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (listId: string) => void;
  initialType?: ListType;
  initialContent?: string;
  initialMetadata?: any;
}

export default function CreateListModal({
  isOpen,
  onClose,
  onCreated,
  initialType = 'word',
  initialContent,
  initialMetadata
}: CreateListModalProps) {
  const { t, strings } = useI18n();
  const { user } = useAuth();
  const { isPremium, isLoading: subscriptionLoading, subscription } = useSubscription();
  const { refreshSession } = useSessionRefresh();
  const { showToast } = useToast();

  // Remove debug logging to avoid console spam
  // isPremium will be undefined while loading, then true/false once loaded

  const [listName, setListName] = useState('');
  const [listType, setListType] = useState<ListType>(initialType);
  const [selectedEmoji, setSelectedEmoji] = useState(DEFAULT_LIST_EMOJIS[initialType]);
  const [selectedColor, setSelectedColor] = useState<typeof LIST_COLORS[number]>('primary');
  const [isCreating, setIsCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleCreate = async () => {
    console.log('[CreateListModal.handleCreate] Starting...');
    console.log('[CreateListModal] listName:', listName);
    console.log('[CreateListModal] user:', user?.uid);
    console.log('[CreateListModal] subscriptionLoading:', subscriptionLoading);
    console.log('[CreateListModal] isPremium:', isPremium);

    if (!listName.trim()) {
      console.log('[CreateListModal] No list name provided');
      showToast(t('lists.errors.nameRequired'), 'error');
      return;
    }

    if (!user) {
      console.log('[CreateListModal] No user');
      showToast(t('lists.errors.signInRequired'), 'error');
      return;
    }

    // Wait for subscription to load before creating
    if (subscriptionLoading || isPremium === undefined) {
      console.log('[CreateListModal] Subscription still loading');
      showToast(t('common.loading'), 'info');
      return;
    }

    setIsCreating(true);

    try {
      // Check for session mismatch and refresh if needed
      console.log('[CreateListModal] Checking session...');
      const sessionResponse = await fetch('/api/auth/session-check');

      if (!sessionResponse.ok) {
        console.error('[CreateListModal] Session check failed:', sessionResponse.status);
        throw new Error('Session check failed');
      }

      const sessionData = await sessionResponse.json();
      console.log('[CreateListModal] Session data:', sessionData);

      if (sessionData.needsRefresh) {
        console.log('[CreateListModal] Session needs refresh, refreshing...');
        await refreshSession();
        // Retry after session refresh
        setIsCreating(false);
        return handleCreate();
      }

      console.log('[CreateListModal] Creating list with request...');
      const request: CreateListRequest = {
        name: listName.trim(),
        type: listType,
        emoji: selectedEmoji,
        color: selectedColor,
        // Include the initial item in the create request
        firstItem: initialContent ? {
          content: initialContent,
          metadata: initialMetadata
        } : undefined
      };

      // Use the current isPremium value (now guaranteed to be boolean, not undefined)
      console.log('[CreateListModal] Calling listManager.createList with isPremium:', isPremium);
      const list = await listManager.createList(request, user.uid, isPremium || false);

      if (list) {
        console.log('[CreateListModal] List created successfully:', list.id);
        showToast(t('lists.created'), 'success');
        onCreated?.(list.id);
        onClose();
        resetForm();
      } else {
        console.error('[CreateListModal] listManager.createList returned null');
        throw new Error('Failed to create list');
      }
    } catch (error) {
      console.error('[CreateListModal] Error creating list:', error);
      showToast(t('lists.errors.createFailed'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setListName('');
    setListType('word');
    setSelectedEmoji(DEFAULT_LIST_EMOJIS.word);
    setSelectedColor('primary');
    setShowEmojiPicker(false);
  };

  const getColorClasses = (color: typeof LIST_COLORS[number]) => {
    const colorMap = {
      primary: 'bg-primary-500 dark:bg-primary-600',
      ocean: 'bg-blue-500 dark:bg-blue-600',
      matcha: 'bg-green-500 dark:bg-green-600',
      sunset: 'bg-orange-500 dark:bg-orange-600',
      lavender: 'bg-purple-500 dark:bg-purple-600',
      monochrome: 'bg-gray-500 dark:bg-gray-600'
    };
    return colorMap[color];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      showCloseButton={!isCreating}
    >
      <div className="space-y-6">
        {/* Header with emoji */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="inline-block mb-4"
          >
            <div className={`w-20 h-20 rounded-2xl ${getColorClasses(selectedColor)} flex items-center justify-center text-4xl shadow-lg`}>
              {selectedEmoji}
            </div>
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('lists.createNew')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {t('lists.createDescription')}
          </p>
        </div>

        {/* List name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('lists.listName')}
          </label>
          <input
            type="text"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder={t('lists.namePlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-600
              bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            disabled={isCreating}
          />
        </div>

        {/* List type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('lists.listType')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['word', 'sentence', 'verbAdj'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setListType(type);
                  setSelectedEmoji(DEFAULT_LIST_EMOJIS[type]);
                }}
                className={`px-4 py-3 rounded-xl border-2 transition-all ${
                  listType === type
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
                }`}
                disabled={isCreating}
              >
                <div className="text-2xl mb-1">{DEFAULT_LIST_EMOJIS[type]}</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t(`lists.types.${type}`)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Emoji picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('lists.emoji')}
          </label>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-600
              bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 transition-all"
            disabled={isCreating}
          >
            <span className="text-2xl mr-2">{selectedEmoji}</span>
            <span className="text-gray-500">{t('lists.changeEmoji')}</span>
          </button>

          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl"
            >
              <div className="grid grid-cols-10 gap-2">
                {SUGGESTED_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setSelectedEmoji(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-10 h-10 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600
                      flex items-center justify-center text-xl transition-all"
                    disabled={isCreating}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('lists.color')}
          </label>
          <div className="flex gap-3">
            {LIST_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`w-12 h-12 rounded-xl ${getColorClasses(color)}
                  ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}
                  hover:scale-110 transition-all`}
                disabled={isCreating}
                aria-label={color}
              />
            ))}
          </div>
        </div>

        {/* Preview card */}
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('lists.preview')}
          </div>
          <motion.div
            key={`${selectedEmoji}-${selectedColor}-${listName}`}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className={`${getColorClasses(selectedColor)} rounded-xl p-4 text-white`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedEmoji}</span>
              <div className="flex-1">
                <div className="font-bold text-lg">
                  {listName || t('lists.namePlaceholder')}
                </div>
                <div className="text-sm opacity-90">
                  {t(`lists.types.${listType}`)} • 0 {t('lists.items')}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-gray-200 dark:border-dark-600
              text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700
              transition-all font-medium"
            disabled={isCreating}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !listName.trim()}
            className="px-6 py-3 rounded-xl bg-primary-500 text-white hover:bg-primary-600
              disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium
              flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('lists.creating')}
              </>
            ) : (
              <>
                <span>✨</span>
                {t('lists.create')}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}