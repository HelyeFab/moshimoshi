'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import type { UserList } from '@/types/userLists';
import { LIST_COLORS, SUGGESTED_EMOJIS } from '@/types/userLists';
import { motion } from 'framer-motion';

interface EditListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (list: UserList) => void;
  list: UserList | null;
}

export default function EditListModal({
  isOpen,
  onClose,
  onUpdated,
  list
}: EditListModalProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [listName, setListName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📚');
  const [selectedColor, setSelectedColor] = useState<typeof LIST_COLORS[number]>('primary');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Update form when list changes
  useEffect(() => {
    if (list) {
      setListName(list.name);
      setSelectedEmoji(list.emoji);
      setSelectedColor(list.color as typeof LIST_COLORS[number]);
    }
  }, [list]);

  const handleUpdate = async () => {
    if (!listName.trim()) {
      showToast(t('lists.errors.nameRequired'), 'error');
      return;
    }

    if (!user || !list) {
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: listName.trim(),
          emoji: selectedEmoji,
          color: selectedColor
        })
      });

      if (response.ok) {
        const { list: updatedList } = await response.json();
        showToast(t('lists.updated'), 'success');
        onUpdated?.(updatedList);
        onClose();
      } else {
        throw new Error('Failed to update list');
      }
    } catch (error) {
      console.error('Error updating list:', error);
      showToast(t('lists.errors.updateFailed'), 'error');
    } finally {
      setIsUpdating(false);
    }
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

  if (!list) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      showCloseButton={!isUpdating}
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
            {t('lists.edit')}
          </h2>
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
            disabled={isUpdating}
          />
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
            disabled={isUpdating}
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
                    disabled={isUpdating}
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
                disabled={isUpdating}
                aria-label={color}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-gray-200 dark:border-dark-600
              text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700
              transition-all font-medium"
            disabled={isUpdating}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating || !listName.trim()}
            className="px-6 py-3 rounded-xl bg-primary-500 text-white hover:bg-primary-600
              disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium
              flex items-center gap-2"
          >
            {isUpdating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('lists.updating')}
              </>
            ) : (
              <>
                <span>💾</span>
                {t('lists.update')}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}