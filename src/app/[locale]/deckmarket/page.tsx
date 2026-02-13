'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { JLPT_LEVELS } from '@/types/deckmarket'
import type { DeckListItem, NoteListItem } from '@/types/deckmarket'
import { Search, Download, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

const DECK_GRADIENTS = [
  'bg-gradient-to-br from-violet-400 to-purple-700',
  'bg-gradient-to-br from-sky-400 to-cyan-600',
  'bg-gradient-to-br from-rose-400 to-pink-600',
  'bg-gradient-to-br from-teal-400 to-emerald-600',
  'bg-gradient-to-br from-amber-400 to-orange-600',
  'bg-gradient-to-br from-fuchsia-400 to-pink-700',
  'bg-gradient-to-br from-indigo-400 to-blue-700',
  'bg-gradient-to-br from-lime-400 to-green-600',
  'bg-gradient-to-br from-cyan-400 to-teal-600',
  'bg-gradient-to-br from-orange-400 to-rose-600',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function deckGradient(jlpt: string | null, deckId: string): string {
  switch (jlpt) {
    case 'N5':
      return 'bg-gradient-to-br from-green-400 to-emerald-600'
    case 'N4':
      return 'bg-gradient-to-br from-blue-400 to-indigo-600'
    case 'N3':
      return 'bg-gradient-to-br from-yellow-400 to-amber-600'
    case 'N2':
      return 'bg-gradient-to-br from-orange-400 to-red-600'
    case 'N1':
      return 'bg-gradient-to-br from-red-400 to-rose-700'
    default:
      return DECK_GRADIENTS[hashString(deckId) % DECK_GRADIENTS.length]
  }
}

function DeckCard({ deck }: { deck: DeckListItem }) {
  const { strings } = useI18n()

  return (
    <Link
      href={`/deckmarket/${deck.id}`}
      className="group block rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
    >
      {/* Gradient header area */}
      <div className={cn('h-20 relative overflow-hidden', deckGradient(deck.jlpt, deck.id))}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
        {/* JLPT badge top-right */}
        {deck.jlpt && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm text-white border border-white/30">
            {deck.jlpt}
          </span>
        )}
        {/* Language badge bottom-left */}
        <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-xs font-medium bg-black/20 backdrop-blur-sm text-white">
          {deck.language.toUpperCase()}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {deck.title}
        </h3>
        {deck.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
            {deck.description}
          </p>
        )}

        {/* Tags */}
        {deck.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {deck.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: download count */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Download className="w-3.5 h-3.5" />
          <span>{deck.downloadCount} {strings.deckmarket.deck.downloads.toLowerCase()}</span>
        </div>
      </div>
    </Link>
  )
}

function NoteCard({
  note,
  downloading,
  onDownload,
}: {
  note: NoteListItem
  downloading: boolean
  onDownload: (noteId: string) => void
}) {
  const { strings } = useI18n()

  return (
    <div className="group rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
      <div className="h-20 relative overflow-hidden bg-gradient-to-br from-slate-500 to-slate-700">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm text-white border border-white/30">
          PDF
        </span>
        <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-xs font-medium bg-black/20 backdrop-blur-sm text-white">
          {note.language.toUpperCase()}
        </span>
      </div>

      <div className="p-4">
        <Link
          href={`/deckmarket/notes/${note.id}`}
          className="block"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {note.title}
          </h3>
          {note.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
              {note.description}
            </p>
          )}
        </Link>

        {note.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Download className="w-3.5 h-3.5" />
            <span>{note.downloadCount} {strings.deckmarket.deck.downloads.toLowerCase()}</span>
          </div>
          <button
            onClick={() => onDownload(note.id)}
            disabled={downloading}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              downloading
                ? 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            {downloading ? strings.deckmarket.deck.downloading : strings.deckmarket.notes.downloadPdf}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DeckMarketCataloguePage() {
  const { strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const [decks, setDecks] = useState<DeckListItem[]>([])
  const [notes, setNotes] = useState<NoteListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [jlptFilter, setJlptFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [downloadingNoteId, setDownloadingNoteId] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadDecks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (jlptFilter) params.set('jlpt', jlptFilter)

      const res = await fetch(`/api/deckmarket/decks?${params.toString()}`)
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        console.error('Failed to fetch decks:', errorBody?.error || res.statusText)
        setDecks([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setDecks(data.data.items || [])
      setTotal(data.data.total || 0)
    } catch (error) {
      console.error('Failed to fetch decks:', error)
      setDecks([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, jlptFilter])

  const loadNotes = useCallback(async () => {
    setNotesLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('pageSize', '50')
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/deckmarket/notes?${params.toString()}`)
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        console.error('Failed to fetch notes:', errorBody?.error || res.statusText)
        setNotes([])
        return
      }
      const data = await res.json()
      setNotes(data.data.items || [])
    } catch (error) {
      console.error('Failed to fetch notes:', error)
      setNotes([])
    } finally {
      setNotesLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setDecks([])
      setTotal(0)
      setNotes([])
      return
    }
    void loadDecks()
    void loadNotes()
  }, [authLoading, user, loadDecks, loadNotes])

  const handleDownloadNote = async (noteId: string) => {
    setDownloadingNoteId(noteId)
    try {
      const res = await fetch(`/api/deckmarket/notes/${noteId}/download`)
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        throw new Error(errorBody?.error || 'Download failed')
      }
      const data = await res.json()
      const anchor = document.createElement('a')
      anchor.href = data.downloadUrl
      anchor.download = data.filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    } catch (error) {
      console.error('Failed to download note:', error)
    } finally {
      setDownloadingNoteId(null)
    }
  }

  const jlptOptions = useMemo(() => ['', ...JLPT_LEVELS], [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={strings.deckmarket.title}
        description={strings.deckmarket.subtitle}
        backHref="/flashcards"
        showFeatureReminderToggle={false}
      />

      <div className="container mx-auto px-4 py-8 pb-24">
        {!authLoading && !user && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {strings.deckmarket.deck.loginRequired}
            </p>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
            >
              {strings.common.signIn}
            </Link>
          </div>
        )}

        {!authLoading && user && (
          <>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder={strings.deckmarket.search}
                aria-label="Search decks by title or description"
                role="searchbox"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by JLPT level">
              {jlptOptions.map((level) => (
                <button
                  key={level || 'all'}
                  onClick={() => {
                    setJlptFilter(level)
                    setPage(1)
                  }}
                  aria-pressed={jlptFilter === level}
                  aria-label={level ? `Filter by JLPT ${level}` : 'Show all JLPT levels'}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    jlptFilter === level
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm'
                      : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
                  )}
                >
                  {level || strings.deckmarket.filters.all}
                </button>
              ))}
            </div>

            <div role="region" aria-label="Deck search results" aria-live="polite">
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                </div>
              )}

              {!loading && decks.length === 0 && (
                <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
                  {strings.deckmarket.deck.noDecks}
                </div>
              )}

              {!loading && decks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {decks.map((deck) => (
                    <DeckCard key={deck.id} deck={deck} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {strings.deckmarket.notes.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {strings.deckmarket.notes.subtitle}
                  </p>
                </div>
              </div>

              {notesLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                </div>
              )}

              {!notesLoading && notes.length === 0 && (
                <div className="flex items-center justify-center py-8 text-gray-600 dark:text-gray-400">
                  {strings.deckmarket.notes.noNotes}
                </div>
              )}

              {!notesLoading && notes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      downloading={downloadingNoteId === note.id}
                      onDownload={handleDownloadNote}
                    />
                  ))}
                </div>
              )}
            </div>

            <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl border font-medium transition-all',
                  page <= 1
                    ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-dark-700 text-gray-400 dark:text-gray-500'
                    : 'border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800 hover:border-primary-400 dark:hover:border-primary-500'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                {strings.deckmarket.pagination.prev}
              </button>
              <span className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium" aria-current="page" aria-label={`Page ${page} of ${totalPages}`}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl border font-medium transition-all',
                  page >= totalPages
                    ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-dark-700 text-gray-400 dark:text-gray-500'
                    : 'border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800 hover:border-primary-400 dark:hover:border-primary-500'
                )}
              >
                {strings.deckmarket.pagination.next}
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          </>
        )}
      </div>

      <MobileNavSpacer />
    </div>
  )
}
