'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import Link from 'next/link';
import { Plus, Search, FileText } from 'lucide-react';
import type { NoteListItem } from '@/types/deckmarket';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

type AdminNoteListItem = NoteListItem & { isPublished: boolean };

export default function AdminDeckMarketNotesPage() {
  const { strings } = useI18n();
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [notes, setNotes] = useState<AdminNoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishFilter, setPublishFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, adminLoading, router]);

  useEffect(() => {
    if (isAdmin) {
      loadNotes();
    }
  }, [isAdmin, publishFilter]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (publishFilter !== 'all') {
        params.set('published', publishFilter === 'published' ? 'true' : 'false');
      }
      const res = await fetch(`/api/admin/deckmarket/notes?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setNotes(data.data || []);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (noteId: string, isPublished: boolean) => {
    try {
      await fetch(`/api/admin/deckmarket/notes/${noteId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      loadNotes();
    } catch (error) {
      console.error('Failed to update publish status:', error);
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;
    setDeletingNote(true);
    try {
      const res = await fetch(`/api/admin/deckmarket/notes/${deleteNoteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || strings.deckmarket.admin.deleteFailed);
      setDeleteNoteId(null);
      loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setDeletingNote(false);
    }
  };

  const filteredNotes = notes.filter((note) => {
    if (!searchQuery.trim()) return true;
    const haystack = `${note.title} ${note.description}`.toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{strings.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {strings.deckmarket.admin.notesTitle}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {strings.deckmarket.notes.subtitle}
          </p>
        </div>
        <Link
          href="/admin/deckmarket/notes/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm text-center font-medium"
        >
          <Plus className="w-4 h-4" />
          {strings.deckmarket.admin.createNote}
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={strings.deckmarket.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'published', 'draft'].map((filter) => (
            <button
              key={filter}
              onClick={() => setPublishFilter(filter as 'all' | 'published' | 'draft')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                publishFilter === filter
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-700'
              )}
            >
              {filter === 'all'
                ? strings.deckmarket.filters.all
                : filter === 'published'
                ? strings.deckmarket.admin.published
                : strings.deckmarket.admin.draft}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{strings.common.loading}</div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {strings.deckmarket.notes.noNotes}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {filteredNotes.map((note) => (
              <div key={note.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{note.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{note.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {note.downloadCount.toLocaleString()} {strings.deckmarket.admin.downloads.toLowerCase()}
                  </span>
                  <button
                    onClick={() => handleTogglePublish(note.id, note.isPublished)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      note.isPublished
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    )}
                  >
                    {note.isPublished ? strings.deckmarket.admin.published : strings.deckmarket.admin.draft}
                  </button>
                  <button
                    onClick={() => router.push(`/admin/deckmarket/notes/${note.id}`)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300"
                  >
                    {strings.deckmarket.admin.editNote}
                  </button>
                  <button
                    onClick={() => setDeleteNoteId(note.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                  >
                    {strings.common.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(deleteNoteId)}
        onClose={() => setDeleteNoteId(null)}
        title={strings.common.delete}
      >
        <p className="text-gray-700 dark:text-gray-300">{strings.deckmarket.admin.confirmDelete}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setDeleteNoteId(null)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300"
          >
            {strings.common.cancel}
          </button>
          <button
            onClick={handleDeleteNote}
            disabled={deletingNote}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {deletingNote ? strings.common.processing : strings.common.delete}
          </button>
        </div>
      </Modal>
    </div>
  );
}
