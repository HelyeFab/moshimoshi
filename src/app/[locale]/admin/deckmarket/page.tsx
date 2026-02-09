'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import Link from 'next/link';
import { Plus, Search, Package, Globe, Download } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { DeckListItem } from '@/types/deckmarket';

type AdminDeckListItem = DeckListItem & { isPublished: boolean };

export default function AdminDeckMarketPage() {
  const { strings } = useI18n();
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [decks, setDecks] = useState<AdminDeckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishFilter, setPublishFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deleteDeckId, setDeleteDeckId] = useState<string | null>(null);
  const [deletingDeck, setDeletingDeck] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, adminLoading, router]);

  useEffect(() => {
    if (isAdmin) {
      loadDecks();
    }
  }, [isAdmin, publishFilter]);

  const loadDecks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (publishFilter !== 'all') {
        params.set('published', publishFilter === 'published' ? 'true' : 'false');
      }
      const res = await fetch(`/api/admin/deckmarket/decks?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setDecks(data.data || []);
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (deckId: string, isPublished: boolean) => {
    try {
      await fetch(`/api/admin/deckmarket/decks/${deckId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      loadDecks();
    } catch (error) {
      console.error('Failed to update publish status:', error);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deleteDeckId) return;
    setDeletingDeck(true);
    try {
      const res = await fetch(`/api/admin/deckmarket/decks/${deleteDeckId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete deck');
      setDeleteDeckId(null);
      loadDecks();
    } catch (error) {
      console.error('Failed to delete deck:', error);
    } finally {
      setDeletingDeck(false);
    }
  };

  const filteredDecks = decks.filter((deck) => {
    if (!searchQuery.trim()) return true;
    const haystack = `${deck.title} ${deck.description}`.toLowerCase();
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
            {strings.deckmarket.admin.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {strings.deckmarket.subtitle}
          </p>
        </div>
        <Link
          href="/admin/deckmarket/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm text-center font-medium"
        >
          <Plus className="w-4 h-4" />
          {strings.deckmarket.admin.createDeck}
        </Link>
      </div>

      {/* Stats cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{decks.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Decks</div>
              </div>
            </div>
          </div>
          <Link href="/deckmarket" className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{decks.filter(d => d.isPublished).length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{strings.deckmarket.admin.published}</div>
              </div>
            </div>
          </Link>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{decks.reduce((s, d) => s + d.downloadCount, 0)}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{strings.deckmarket.admin.downloads}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-gray-200 dark:border-dark-700 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder={strings.deckmarket.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex gap-2">
            {([
              { value: 'all', label: strings.deckmarket.filters.all },
              { value: 'published', label: strings.deckmarket.admin.published },
              { value: 'draft', label: strings.deckmarket.admin.draft },
            ] as const).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setPublishFilter(tab.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                  publishFilter === tab.value
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white border-primary-500 shadow-sm'
                    : 'bg-white dark:bg-dark-850 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            {strings.common.loading}
          </div>
        ) : filteredDecks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{strings.deckmarket.deck.noDecks}</p>
            <Link
              href="/admin/deckmarket/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {strings.deckmarket.admin.createDeck}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-dark-700">
            {filteredDecks.map((deck) => (
              <div
                key={deck.id}
                className="p-4 hover:bg-gray-50/50 dark:hover:bg-dark-700/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Name + ID */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{deck.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{deck.id}</div>
                  </div>

                  {/* Meta badges */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {deck.jlpt && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                        {deck.jlpt}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{deck.language}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{deck.downloadCount.toLocaleString()} {strings.deckmarket.admin.downloads.toLowerCase()}</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        deck.isPublished
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-dark-700 dark:text-gray-300'
                      }`}
                    >
                      {deck.isPublished ? strings.deckmarket.admin.published : strings.deckmarket.admin.draft}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTogglePublish(deck.id, deck.isPublished)}
                      className="px-2.5 py-1 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      {deck.isPublished ? strings.deckmarket.admin.unpublish : strings.deckmarket.admin.publish}
                    </button>
                    <button
                      onClick={() => router.push(`/admin/deckmarket/${deck.id}`)}
                      className="px-2.5 py-1 text-xs font-medium bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
                    >
                      {strings.common.edit}
                    </button>
                    <button
                      onClick={() => setDeleteDeckId(deck.id)}
                      className="px-2.5 py-1 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      {strings.common.delete}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(deleteDeckId)}
        onClose={() => setDeleteDeckId(null)}
        title={strings.common.delete}
      >
        <p className="text-gray-700 dark:text-gray-300">{strings.deckmarket.admin.confirmDelete}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setDeleteDeckId(null)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
          >
            {strings.common.cancel}
          </button>
          <button
            onClick={handleDeleteDeck}
            disabled={deletingDeck}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {deletingDeck ? strings.common.processing : strings.common.delete}
          </button>
        </div>
      </Modal>
    </div>
  );
}
