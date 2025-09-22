'use client';

import { useState, useEffect } from 'react';
import { useMoodBoards } from '@/hooks/useMoodBoards';
import { useI18n } from '@/i18n/I18nContext';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { MoodBoard } from '@/types/moodboard';
import MoodBoardEditor from './MoodBoardEditor';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

interface FilterState {
  jlptLevel: 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  searchTerm: string;
  sortBy: 'newest' | 'oldest' | 'title' | 'kanjiCount';
}

export default function MoodBoardManager() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { moodBoards, loading, error, createMoodBoard, updateMoodBoard, deleteMoodBoard } = useMoodBoards();

  const [filters, setFilters] = useState<FilterState>({
    jlptLevel: 'all',
    searchTerm: '',
    sortBy: 'newest'
  });

  const [selectedBoard, setSelectedBoard] = useState<MoodBoard | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter and sort moodboards
  const filteredBoards = moodBoards
    .filter(board => {
      // JLPT filter
      if (filters.jlptLevel !== 'all' && board.jlpt !== filters.jlptLevel) {
        return false;
      }

      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return (
          board.title.toLowerCase().includes(searchLower) ||
          board.description.toLowerCase().includes(searchLower) ||
          board.emoji.includes(filters.searchTerm) ||
          board.kanji.some(k =>
            k.char.includes(filters.searchTerm) ||
            k.meaning.toLowerCase().includes(searchLower)
          )
        );
      }

      return true;
    })
    .sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'kanjiCount':
          return b.kanji.length - a.kanji.length;
        default:
          return 0;
      }
    });

  const handleEdit = (board: MoodBoard) => {
    setSelectedBoard(board);
    setIsEditing(true);
  };

  const handleCreate = () => {
    setSelectedBoard(null);
    setIsCreating(true);
  };

  const handleSave = async (boardData: Partial<MoodBoard>) => {
    try {
      if (selectedBoard) {
        // Update existing
        await updateMoodBoard(selectedBoard.id, boardData);
        showToast(t('admin.moodboards.updateSuccess'), 'success');
      } else {
        // Create new
        await createMoodBoard(boardData as Omit<MoodBoard, 'id' | 'createdAt' | 'updatedAt'>);
        showToast(t('admin.moodboards.createSuccess'), 'success');
      }
      setIsEditing(false);
      setIsCreating(false);
      setSelectedBoard(null);
    } catch (error) {
      console.error('Error saving moodboard:', error);
      showToast(t('admin.moodboards.saveFailed'), 'error');
    }
  };

  const handleDelete = async (boardId: string) => {
    if (deleteConfirmId !== boardId) {
      setDeleteConfirmId(boardId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }

    try {
      await deleteMoodBoard(boardId);
      showToast(t('admin.moodboards.deleteSuccess'), 'success');
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting moodboard:', error);
      showToast(t('admin.moodboards.deleteFailed'), 'error');
    }
  };

  const handleDuplicate = async (board: MoodBoard) => {
    try {
      const duplicatedBoard = {
        ...board,
        title: `${board.title} (${t('common.copy')})`,
        id: undefined as any,
        createdAt: undefined as any,
        updatedAt: undefined as any
      };

      delete duplicatedBoard.id;
      delete duplicatedBoard.createdAt;
      delete duplicatedBoard.updatedAt;

      await createMoodBoard(duplicatedBoard);
      showToast(t('admin.moodboards.duplicateSuccess'), 'success');
    } catch (error) {
      console.error('Error duplicating moodboard:', error);
      showToast(t('admin.moodboards.duplicateFailed'), 'error');
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white dark:bg-dark-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-dark-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              placeholder={t('common.search')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
            />
          </div>

          {/* JLPT Level */}
          <select
            value={filters.jlptLevel}
            onChange={(e) => setFilters(prev => ({ ...prev, jlptLevel: e.target.value as any }))}
            className="px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
          >
            <option value="all">{t('common.allLevels')}</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
            <option value="N3">N3</option>
            <option value="N2">N2</option>
            <option value="N1">N1</option>
          </select>

          {/* Sort */}
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
            className="px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
          >
            <option value="newest">{t('common.newest')}</option>
            <option value="oldest">{t('common.oldest')}</option>
            <option value="title">{t('common.title')}</option>
            <option value="kanjiCount">{t('admin.moodboards.kanjiCount')}</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700">
          <div className="text-2xl font-bold text-foreground dark:text-dark-100">
            {moodBoards.length}
          </div>
          <div className="text-sm text-muted-foreground dark:text-dark-400">
            {t('admin.moodboards.totalBoards')}
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700">
          <div className="text-2xl font-bold text-foreground dark:text-dark-100">
            {moodBoards.reduce((sum, board) => sum + board.kanji.length, 0)}
          </div>
          <div className="text-sm text-muted-foreground dark:text-dark-400">
            {t('admin.moodboards.totalKanji')}
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700">
          <div className="text-2xl font-bold text-foreground dark:text-dark-100">
            {filteredBoards.length}
          </div>
          <div className="text-sm text-muted-foreground dark:text-dark-400">
            {t('admin.moodboards.filteredResults')}
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700">
          <button
            onClick={handleCreate}
            className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('admin.moodboards.createNew')}
          </button>
        </div>
      </div>

      {/* Moodboard List */}
      <div className="space-y-4">
        {filteredBoards.map((board) => (
          <div
            key={board.id}
            className="bg-white dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{board.emoji}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground dark:text-dark-100">
                      {board.title}
                    </h3>
                    <p className="text-sm text-muted-foreground dark:text-dark-400">
                      {board.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded text-xs">
                    {board.jlpt}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded text-xs">
                    {board.kanji.length} {t('common.kanji')}
                  </span>
                  <span
                    className="px-2 py-1 rounded text-xs"
                    style={{ backgroundColor: `${board.background}20` }}
                  >
                    {board.background}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded text-xs">
                    {t('common.created')}: {new Date(board.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Kanji Preview */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {board.kanji.slice(0, 10).map((kanji) => (
                    <div
                      key={kanji.char}
                      className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-dark-700 rounded text-lg font-bold font-japanese"
                      title={`${kanji.char} - ${kanji.meaning}`}
                    >
                      {kanji.char}
                    </div>
                  ))}
                  {board.kanji.length > 10 && (
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-dark-700 rounded text-sm">
                      +{board.kanji.length - 10}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 ml-4">
                <button
                  onClick={() => handleEdit(board)}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => handleDuplicate(board)}
                  className="px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-sm"
                >
                  {t('common.duplicate')}
                </button>
                <button
                  onClick={() => handleDelete(board.id)}
                  className={`px-3 py-1.5 rounded transition-colors text-sm ${
                    deleteConfirmId === board.id
                      ? 'bg-red-600 text-white'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {deleteConfirmId === board.id ? t('common.confirmDelete') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredBoards.length === 0 && (
          <div className="bg-white dark:bg-dark-800 rounded-lg p-8 text-center border border-gray-200 dark:border-dark-700">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-semibold mb-2">{t('admin.moodboards.noResults')}</h3>
            <p className="text-muted-foreground dark:text-dark-400">
              {filters.searchTerm || filters.jlptLevel !== 'all'
                ? t('admin.moodboards.tryDifferentFilters')
                : t('admin.moodboards.createFirstBoard')}
            </p>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {(isEditing || isCreating) && (
        <MoodBoardEditor
          board={selectedBoard}
          isOpen={isEditing || isCreating}
          onClose={() => {
            setIsEditing(false);
            setIsCreating(false);
            setSelectedBoard(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}