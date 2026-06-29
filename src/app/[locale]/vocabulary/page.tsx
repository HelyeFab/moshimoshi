'use client'

import { useState, useEffect, Suspense } from 'react'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import { useI18n } from '@/i18n/I18nContext'
import { Loader2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import VocabularySearch from './components/VocabularySearch'
import SearchHistory from './components/SearchHistory'
import WordDetailPane from './components/WordDetailPane'
import { searchDictionary } from '@/utils/dictionaryClient'
import type { JapaneseWord } from '@/types/vocabulary'
import { useSubscription } from '@/hooks/useSubscription'
import { vocabularyHistoryManager } from '@/utils/vocabularyHistoryManager'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

function VocabularyContent() {
  const { strings } = useI18n()
  const { showToast } = useToast()
  const { isPremium } = useSubscription()

  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<JapaneseWord[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<Array<{ term: string; timestamp: Date; resultCount: number }>>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ term: string; timestamp: Date } | null>(null)

  // Session
  useEffect(() => {
    const checkSession = async () => {
      try {
        if (sessionStorage.getItem('isGuestUser') === 'true') {
          setUser({ uid: 'guest', email: 'guest@user', displayName: 'Guest User', isGuest: true, tier: 'guest' })
          return
        }
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (data.authenticated) setUser(data.user)
      } catch (e) {
        console.error('Failed to check session:', e)
      }
    }
    checkSession()
  }, [])

  // History
  useEffect(() => {
    if (user && user.uid) {
      vocabularyHistoryManager.loadHistory(user, isPremium ?? false).then(setSearchHistory)
    }
  }, [user, isPremium])

  const handleSearch = async (term: string) => {
    if (!term.trim()) { setSearchResults([]); return }
    setSearching(true)
    setSelectedId(null)
    try {
      const results = await searchDictionary(term, 30)
      setSearchResults(results)
      await vocabularyHistoryManager.saveSearch(term, results.length, 'jmdict', user, isPremium ?? false)
      const updated = await vocabularyHistoryManager.loadHistory(user, isPremium ?? false)
      setSearchHistory(updated)
      if (results.length === 0) showToast('No results found. Try a different search term.', 'info')
    } catch (e) {
      console.error('Search error:', e)
      showToast('Failed to search. Please try again.', 'error')
    } finally {
      setSearching(false)
    }
  }

  const selectWord = async (word: JapaneseWord) => {
    setSelectedId(word.id)
    if (searchTerm && user && isPremium) {
      try {
        await vocabularyHistoryManager.trackResultClick(searchTerm, word.kanji || word.kana, user, isPremium ?? false)
      } catch (e) { console.error('Failed to track result click:', e) }
    }
  }

  const handleSearchHistoryClick = (term: string) => { setSearchTerm(term); handleSearch(term) }
  const clearSearchHistory = async () => {
    await vocabularyHistoryManager.clearHistory(user, isPremium ?? false)
    setSearchHistory([]); showToast('Search history cleared', 'success')
  }
  const handleDeleteHistoryItem = (term: string, timestamp: Date) => { setItemToDelete({ term, timestamp }); setDeleteConfirmOpen(true) }
  const confirmDeleteHistoryItem = async () => {
    if (!itemToDelete) return
    try {
      await vocabularyHistoryManager.deleteHistoryEntry(itemToDelete.term, itemToDelete.timestamp, user, isPremium ?? false)
      setSearchHistory(await vocabularyHistoryManager.loadHistory(user, isPremium ?? false))
      showToast('Search entry deleted', 'success')
    } catch (e) {
      console.error('Failed to delete search entry:', e); showToast('Failed to delete entry', 'error')
    } finally { setDeleteConfirmOpen(false); setItemToDelete(null) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block"><Navbar user={user} showUserMenu={true} /></div>

      <PageHeader
        title={strings.vocabulary?.title || 'Dictionary'}
        description={strings.vocabulary?.description || 'Search and explore Japanese vocabulary'}
        backHref="/dashboard"
      />

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        <VocabularySearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} onSearch={handleSearch} searching={searching} />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT — results (or recent searches when idle). Hidden on mobile while a word is selected. */}
          <div className={`lg:col-span-5 space-y-4 ${selectedId ? 'hidden lg:block' : ''}`}>
            {searching ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary-500" /></div>
            ) : searchResults.length > 0 ? (
              <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-3 sm:p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1 mb-2">{`Results (${searchResults.length})`}</h2>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-hide">
                  {searchResults.map((word, index) => {
                    const active = selectedId === word.id
                    return (
                      <button
                        key={`${word.id}-${index}`}
                        onClick={() => selectWord(word)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${active ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'}`}
                      >
                        <div className="flex items-center flex-wrap gap-2">
                          {word.kanji && (
                            <span className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: '"Noto Sans JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif' }}>{word.kanji}</span>
                          )}
                          <span className="text-base text-gray-700 dark:text-gray-300">{word.kana}</span>
                          {word.jlpt && <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">{word.jlpt}</span>}
                        </div>
                        {word.senses?.length ? (
                          <ol className="mt-1 space-y-0.5">
                            {word.senses.slice(0, 4).map((s, i) => (
                              <li key={i} className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="text-gray-400 dark:text-gray-500 mr-1">{i + 1}.</span>{s.glosses.slice(0, 5).join(', ')}
                              </li>
                            ))}
                            {word.senses.length > 4 && <li className="text-xs text-gray-400 dark:text-gray-500">+{word.senses.length - 4} more meanings</li>}
                          </ol>
                        ) : (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{word.meaning}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <SearchHistory history={searchHistory} onHistoryClick={handleSearchHistoryClick} onClear={clearSearchHistory} onDeleteItem={handleDeleteHistoryItem} />
            )}
          </div>

          {/* RIGHT — detail pane. Hidden on mobile until a word is selected. */}
          <div className={`lg:col-span-7 ${selectedId ? '' : 'hidden lg:block'}`}>
            <WordDetailPane wordId={selectedId} onBack={() => setSelectedId(null)} />
          </div>
        </div>
      </div>

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Search Entry" size="sm">
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete this search entry?</p>
          {itemToDelete && <div className="p-3 bg-gray-100 dark:bg-dark-700 rounded-lg"><p className="font-medium text-gray-900 dark:text-gray-100">{itemToDelete.term}</p></div>}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteConfirmOpen(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">{strings.common?.cancel || 'Cancel'}</button>
            <button onClick={confirmDeleteHistoryItem} className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors">{strings.common?.delete || 'Delete'}</button>
          </div>
        </div>
      </Modal>

      <MobileNavSpacer />
    </div>
  )
}

export default function VocabularyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingOverlay isLoading message="Loading dictionary…" showDoshi /></div>}>
      <VocabularyContent />
    </Suspense>
  )
}
