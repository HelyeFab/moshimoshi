'use client'

import React, { useState, useEffect } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useRouter, useParams } from 'next/navigation'
// Navigation is now global via NavigationWrapper in root layout;
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { listManager } from '@/lib/lists/ListManager'
import type { UserList, ListItem, ListItemSRSData } from '@/types/userLists'
import { createInitialSRSData } from '@/types/userLists'
import type { Kanji } from '@/types/kanji'
import type { JapaneseWord, JLPTLevel } from '@/types/vocabulary'
import { motion, AnimatePresence } from 'framer-motion'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useToast } from '@/components/ui/Toast/ToastContext'
import Dialog from '@/components/ui/Dialog'
import SpeakerIcon from '@/components/ui/SpeakerIcon'
import { Trash2 } from 'lucide-react'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { kanjiService } from '@/services/kanjiService'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import WordDetailsModal from '@/app/[locale]/vocabulary/components/WordDetailsModal'
import { searchJMdictWords, loadJMdictData } from '@/utils/jmdictLocalSearch'
import { UserListAdapter } from '@/lib/review-engine/adapters/UserListAdapter'
import dynamic from 'next/dynamic'
import { LoadingOverlay } from '@/components/ui/Loading'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { getEventHub, initializeEventHub } from '@/lib/review-engine/core/event-hub'

// All gamification uses Event Hub (global singleton)
// ReviewSessionUI handles initialization automatically

// Dynamic import for ReviewSessionUI to avoid SSR issues
const ReviewSessionUI = dynamic(() => import('@/components/review-engine/ReviewSessionUI'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false,
})

export default function ListDetailPage() {
  const { t } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const { isPremium } = useSubscription()
  const router = useRouter()
  const params = useParams()
  const { showToast } = useToast()
  // TTS is handled by SpeakerIcon component

  const listId = params.listId as string

  const [list, setList] = useState<UserList | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newItemContent, setNewItemContent] = useState('')
  const [newItemMetadata, setNewItemMetadata] = useState({
    reading: '',
    meaning: '',
    notes: '',
  })
  const [deletingItem, setDeletingItem] = useState<string | null>(null)

  // View mode state
  type ViewMode = 'browse' | 'study' | 'review'
  const [viewMode, setViewMode] = useState<ViewMode>('browse')

  // Selection state for study/review modes
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Review session state
  const [reviewContent, setReviewContent] = useState<any[]>([])
  const [reviewContentPool, setReviewContentPool] = useState<any[]>([])
  const [studySessionStartTime, setStudySessionStartTime] = useState<number>(0)
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0)
  const [selectedItemsData, setSelectedItemsData] = useState<ListItem[]>([])

  // Kanji details modal state
  const [modalKanji, setModalKanji] = useState<Kanji | null>(null)
  const [loadingKanjiDetails, setLoadingKanjiDetails] = useState(false)

  // Word details modal state
  const [modalWord, setModalWord] = useState<JapaneseWord | null>(null)
  const [loadingWordDetails, setLoadingWordDetails] = useState(false)

  // Initialize Event Hub for gamification (required for study mode XP)
  // Review mode uses ReviewSessionUI which also initializes the hub
  useEffect(() => {
    if (user?.uid) {
      initializeEventHub(user.uid)
      console.log('[User Lists] Event Hub initialized for user:', user.uid)
    }
  }, [user?.uid])

  // Pre-load JMdict data for word lookups
  useEffect(() => {
    loadJMdictData()
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      loadList()
    } else if (!authLoading && !user) {
      router.push('/lists')
    }
  }, [user, authLoading, listId])

  const loadList = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const lists = await listManager.getLists(user.uid, isPremium ?? false)
      const foundList = lists.find(l => l.id === listId)

      if (foundList) {
        setList(foundList)
      } else {
        showToast(t('lists.errors.loadFailed'), 'error')
        router.push('/lists')
      }
    } catch (error) {
      console.error('Error loading list:', error)
      showToast(t('lists.errors.loadFailed'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddItem = async () => {
    if (!user || !list || !newItemContent.trim()) return

    try {
      await listManager.addItemToList(
        list.id,
        newItemContent.trim(),
        newItemMetadata,
        user.uid,
        isPremium ?? false
      )

      await loadList()
      setShowAddModal(false)
      setNewItemContent('')
      setNewItemMetadata({ reading: '', meaning: '', notes: '' })
      showToast(t('lists.success.itemAdded'), 'success')
    } catch (error) {
      console.error('Error adding item:', error)
      showToast(t('lists.errors.addFailed'), 'error')
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!user || !list) return

    try {
      await listManager.removeItemFromList(list.id, itemId, user.uid, isPremium ?? false)
      await loadList()
      showToast(t('lists.success.itemRemoved', { count: 1 }), 'success')
      setDeletingItem(null)
    } catch (error) {
      console.error('Error removing item:', error)
      showToast(t('common.error'), 'error')
    }
  }

  // Selection handlers
  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (!list) return
    const allIds = list.items.map(item => item.id)
    setSelectedItems(new Set(allIds))
  }

  const handleClearSelection = () => {
    setSelectedItems(new Set())
  }

  // Helper to check if a string is a single kanji character
  const isSingleKanji = (text: string): boolean => {
    if (text.length !== 1) return false
    const code = text.charCodeAt(0)
    // CJK Unified Ideographs range (most common kanji)
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||
      // CJK Unified Ideographs Extension A
      (code >= 0x3400 && code <= 0x4dbf) ||
      // CJK Compatibility Ideographs
      (code >= 0xf900 && code <= 0xfaff)
    )
  }

  // Helper to check if text contains any kanji
  const containsKanji = (text: string): boolean => {
    for (const char of text) {
      const code = char.charCodeAt(0)
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0xf900 && code <= 0xfaff)
      ) {
        return true
      }
    }
    return false
  }

  // Helper to check if text is a sentence (contains spaces, punctuation, or is very long)
  const isSentence = (text: string): boolean => {
    // Consider it a sentence if it's long or contains sentence-ending punctuation
    return text.length > 15 || /[。！？、]/.test(text)
  }

  // Handle click on a list item
  const handleItemClick = async (item: ListItem) => {
    // Only handle in browse mode
    if (viewMode !== 'browse') return

    const content = item.content

    // Check if it's a single kanji
    if (isSingleKanji(content)) {
      setLoadingKanjiDetails(true)
      try {
        const kanjiDetails = await kanjiService.getKanjiDetails(content)
        if (kanjiDetails) {
          setModalKanji(kanjiDetails)
        } else {
          // Kanji not in our database - show toast
          showToast('Kanji details not available', 'info')
        }
      } catch (error) {
        console.error('Error fetching kanji details:', error)
        showToast('Failed to load kanji details', 'error')
      } finally {
        setLoadingKanjiDetails(false)
      }
    }
    // Skip sentences - they're too complex for dictionary lookup
    else if (isSentence(content)) {
      // Do nothing for sentences - they have inline display already
      return
    }
    // Words and verbs - look up in dictionary
    else if (content.length > 0) {
      setLoadingWordDetails(true)
      try {
        // Search JMdict for the word
        const results = await searchJMdictWords(content, 10)

        // Find exact match first (kanji or kana matches content)
        let match = results.find(w => w.kanji === content || w.kana === content)

        // If no exact match, try to find a close match
        if (!match && results.length > 0) {
          match = results[0]
        }

        if (match) {
          setModalWord(match)
        } else {
          // No dictionary match - create minimal JapaneseWord from ListItem metadata
          const fallbackWord: JapaneseWord = {
            id: item.id,
            kanji: containsKanji(content) ? content : undefined,
            kana: item.metadata?.reading || content,
            meaning: item.metadata?.meaning || 'No definition available',
            jlpt: item.metadata?.jlptLevel
              ? (`N${item.metadata.jlptLevel}` as JLPTLevel)
              : undefined,
          }
          setModalWord(fallbackWord)
        }
      } catch (error) {
        console.error('Error fetching word details:', error)
        // Still try to show something from the list item
        const fallbackWord: JapaneseWord = {
          id: item.id,
          kanji: containsKanji(content) ? content : undefined,
          kana: item.metadata?.reading || content,
          meaning: item.metadata?.meaning || 'No definition available',
        }
        setModalWord(fallbackWord)
      } finally {
        setLoadingWordDetails(false)
      }
    }
  }

  // Study mode handler
  const handleStartStudy = () => {
    if (!list || selectedItems.size === 0) {
      showToast('Please select items to study', 'warning')
      return
    }

    const itemsArray = list.items.filter(item => selectedItems.has(item.id))

    if (itemsArray.length === 0) {
      showToast('Could not find selected items', 'error')
      return
    }

    // Track study session start time for gamification
    setStudySessionStartTime(Date.now())
    setSelectedItemsData(itemsArray)
    setCurrentStudyIndex(0)
    setViewMode('study')
  }

  // Review mode handler
  const handleStartReview = () => {
    if (!list || selectedItems.size === 0) {
      showToast('Please select items to review', 'warning')
      return
    }

    // Initialize adapter with current list
    const adapter = new UserListAdapter(list)

    // Get selected items
    const itemsArray = list.items.filter(item => selectedItems.has(item.id))

    // Transform to reviewable content
    const content = itemsArray.map(item => adapter.transform(item))

    // Use all list items as pool for distractors
    const poolContent = list.items.map(item => adapter.transform(item))

    setReviewContent(content)
    setReviewContentPool(poolContent)
  }

  // Review session completion handler
  const handleReviewComplete = async (stats: any) => {
    // SessionManager emits SESSION_COMPLETED automatically via Event Hub
    // No manual event emission needed - gamification happens automatically!
    console.log('[User Lists] Session completed:', {
      correctItems: stats.correctItems,
      accuracy: stats.accuracy,
      averageResponseTime: stats.averageResponseTime,
      bestStreak: stats.bestStreak,
      duration: stats.duration,
    })

    // Update SRS data for each reviewed item
    if (list && stats.itemResults && stats.itemResults.length > 0) {
      console.log('[User Lists] Updating SRS data for', stats.itemResults.length, 'items')

      const updatedItems = list.items.map(item => {
        // Find the result for this item
        const result = stats.itemResults.find((r: any) => r.itemId === item.id)

        if (result) {
          // Get current SRS data or create initial
          const currentSRS = item.srsData || createInitialSRSData()

          // Calculate updated SRS using the adapter's static method
          const updatedSRS = UserListAdapter.calculateUpdatedSRS(currentSRS, result.correct)

          console.log(`[User Lists] Item ${item.id} SRS update:`, {
            correct: result.correct,
            oldInterval: currentSRS.interval,
            newInterval: updatedSRS.interval,
            oldStatus: currentSRS.status,
            newStatus: updatedSRS.status,
          })

          return {
            ...item,
            srsData: updatedSRS,
          }
        }

        return item
      })

      // Update the list with new SRS data
      const updatedList: UserList = {
        ...list,
        items: updatedItems,
        updatedAt: Date.now(),
      }

      // Save to storage (IndexedDB + Firebase for premium)
      try {
        if (user?.uid) {
          await listManager.updateList(
            listId,
            { items: updatedItems },
            user.uid,
            isPremium ?? false
          )
          setList(updatedList)
          console.log('[User Lists] SRS data persisted successfully')
        }
      } catch (error) {
        console.error('[User Lists] Failed to persist SRS data:', error)
        showToast('Review saved locally, but failed to sync', 'warning')
      }
    }

    setReviewContent([])
    setReviewContentPool([])
    setViewMode('browse')
    setSelectedItems(new Set())
    showToast(`Review complete! Accuracy: ${stats.accuracy.toFixed(1)}%`, 'success')
  }

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      primary: 'bg-primary-500 dark:bg-primary-600',
      ocean: 'bg-blue-500 dark:bg-blue-600',
      matcha: 'bg-green-500 dark:bg-green-600',
      sunset: 'bg-orange-500 dark:bg-orange-600',
      lavender: 'bg-purple-500 dark:bg-purple-600',
      monochrome: 'bg-gray-500 dark:bg-gray-600',
    }
    return colorMap[color] || colorMap.primary
  }

  if (authLoading || isLoading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800"
      >
        {/* Navigation is now global - rendered in root layout */}
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center">
            <DoshiMascot size="large" mood="thinking" />
            <p className="text-gray-500 dark:text-gray-400 mt-4">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!list) {
    return null
  }

  // Active study session
  if (selectedItemsData.length > 0 && selectedItemsData[currentStudyIndex]) {
    const currentItem = selectedItemsData[currentStudyIndex]

    return (
      <div
        className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800"
      >
        {/* Navigation is now global - rendered in root layout */}
        <LearningPageHeader
          title={list.name}
          description={t(`lists.types.${list.type}.description`)}
          subtitle={`Studying ${selectedItems.size} items`}
          stats={{
            total: list.items.length,
            learned: 0,
          }}
          backHref="/lists"
        />
        <main className="container mx-auto px-4 py-8">
          {/* Simple study card */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-lg">
              <div className="text-center mb-6">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentStudyIndex + 1} / {selectedItemsData.length}
                </span>
              </div>

              <div className="text-center mb-8">
                <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {currentItem.content}
                </div>
                {currentItem.metadata?.reading && (
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                    {currentItem.metadata.reading}
                  </div>
                )}
                {currentItem.metadata?.meaning && (
                  <div className="text-xl text-primary-600 dark:text-primary-400 mb-4">
                    {currentItem.metadata.meaning}
                  </div>
                )}
                {currentItem.metadata?.notes && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 italic mt-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                    📝 {currentItem.metadata.notes}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    if (currentStudyIndex > 0) {
                      setCurrentStudyIndex(currentStudyIndex - 1)
                    }
                  }}
                  disabled={currentStudyIndex === 0}
                  className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (currentStudyIndex < selectedItemsData.length - 1) {
                      setCurrentStudyIndex(currentStudyIndex + 1)
                    } else {
                      // Study mode awards XP - PRODUCT REQUIREMENT
                      // While architecturally study mode is "passive learning",
                      // users expect XP for completing study sessions.
                      // This is intentional user-facing behavior, not a bug.
                      const sessionDuration = Date.now() - studySessionStartTime
                      const totalItems = selectedItemsData.length

                      const sessionId = `study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

                      getEventHub().emit(ReviewEventType.SESSION_COMPLETED, {
                        data: {
                          sessionId,
                          statistics: {
                            correctItems: totalItems,
                            accuracy: 100, // Study mode assumes completion = success
                            averageResponseTime: totalItems > 0 ? sessionDuration / totalItems : 0,
                            bestStreak: totalItems,
                          },
                          duration: sessionDuration,
                        },
                      })

                      console.log('[User Lists Study] SESSION_COMPLETED emitted (Product Requirement):', {
                        sessionId,
                        items: totalItems,
                        duration: sessionDuration,
                      })

                      showToast('Study session complete!', 'success')
                      setViewMode('browse')
                      setCurrentStudyIndex(0)
                      setSelectedItemsData([])
                      setSelectedItems(new Set())
                      setStudySessionStartTime(0)
                    }
                  }}
                  className="px-6 py-3 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all"
                >
                  {currentStudyIndex < selectedItemsData.length - 1 ? 'Next' : 'Complete'}
                </button>
              </div>

              <button
                onClick={() => {
                  setViewMode('browse')
                  setCurrentStudyIndex(0)
                  setSelectedItemsData([])
                }}
                className="mt-4 w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-all"
              >
                Back to Browse
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Active review session
  if (reviewContent.length > 0) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800"
      >
        {/* Navigation is now global - rendered in root layout */}
        <LearningPageHeader
          title={list.name}
          description={t(`lists.types.${list.type}.description`)}
          subtitle="Review Mode"
          backHref="/lists"
        />
        <main className="container mx-auto px-4 py-8">
          <ReviewSessionUI
            content={reviewContent}
            contentPool={reviewContentPool}
            mode="recall"
            onComplete={handleReviewComplete}
            onCancel={() => {
              setReviewContent([])
              setReviewContentPool([])
              setViewMode('browse')
              setSelectedItems(new Set())
            }}
            userId={user?.uid || 'guest'}
            shuffle={false}
          />
        </main>
      </div>
    )
  }

  // Main browse/selection view
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
      dark:from-dark-900 dark:via-dark-850 dark:to-dark-800"
    >
      {/* Navigation is now global - rendered in root layout */}

      <LearningPageHeader
        title={list.name}
        description={t(`lists.types.${list.type}.description`)}
        subtitle={`${list.items.length} items`}
        stats={
          viewMode !== 'browse'
            ? {
                total: list.items.length,
                learned: selectedItems.size,
              }
            : undefined
        }
        mode={viewMode}
        onModeChange={setViewMode}
        selectionMode={viewMode !== 'browse'}
        selectedCount={selectedItems.size}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onStartStudy={viewMode === 'study' ? handleStartStudy : undefined}
        onStartReview={viewMode === 'review' ? handleStartReview : undefined}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Actions bar - only show add button in browse mode */}
        {viewMode === 'browse' && (
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
                transition-all font-medium flex items-center gap-2"
            >
              <span>➕</span>
              {t('lists.actions.addItems')}
            </button>
          </div>
        )}

        {/* Items list */}
        {list.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <DoshiMascot size="large" mood="thinking" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-4">
              {t('lists.empty.noItems')}
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl
                hover:bg-primary-600 transition-all font-medium"
            >
              {t('lists.actions.addItems')}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm">
            <AnimatePresence>
              {list.items.map((item, index) => {
                const isSelected = selectedItems.has(item.id)

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleItemClick(item)}
                    className={`p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-dark-700
                      transition-all ${index > 0 ? 'border-t border-gray-100 dark:border-dark-700' : ''}
                      ${viewMode === 'browse' && !isSentence(item.content) ? 'cursor-pointer' : ''}`}
                  >
                    {/* Pin for selection in study/review modes */}
                    {(viewMode === 'study' || viewMode === 'review') && (
                      <button
                        className="text-xl transition-all hover:scale-110"
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleSelection(item.id)
                        }}
                        aria-label={isSelected ? 'Unpin' : 'Pin'}
                      >
                        <span className={isSelected ? '' : 'opacity-30 grayscale'}>📌</span>
                      </button>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Japanese content */}
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-lg break-words">
                        {item.content}
                      </div>
                      {item.metadata?.reading && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.metadata.reading}
                        </div>
                      )}
                      {/* Translation - below on mobile */}
                      {item.metadata?.meaning && (
                        <div className="mt-2 text-sm text-primary-600 dark:text-primary-400">
                          → {item.metadata.meaning}
                        </div>
                      )}
                      {item.metadata?.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-2 flex items-start gap-1">
                          <span>📝</span>
                          <span>{item.metadata.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions - only show in browse mode */}
                    {viewMode === 'browse' && (
                      <div className="flex gap-2 items-center">
                        <SpeakerIcon
                          text={item.content}
                          size="sm"
                          variant="ghost"
                          options={{ voice: 'ja-JP', speed: 0.9 }}
                        />
                        <button
                          onClick={() => setDeletingItem(item.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20
                            transition-all text-red-500"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {t('lists.actions.addItems')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content *
                  </label>
                  <input
                    type="text"
                    value={newItemContent}
                    onChange={e => setNewItemContent(e.target.value)}
                    placeholder={
                      list.type === 'sentence' ? 'Enter a sentence' : 'Enter a word or phrase'
                    }
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reading {t('common.optional')}
                  </label>
                  <input
                    type="text"
                    value={newItemMetadata.reading}
                    onChange={e =>
                      setNewItemMetadata({ ...newItemMetadata, reading: e.target.value })
                    }
                    placeholder="Hiragana reading"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Meaning {t('common.optional')}
                  </label>
                  <input
                    type="text"
                    value={newItemMetadata.meaning}
                    onChange={e =>
                      setNewItemMetadata({ ...newItemMetadata, meaning: e.target.value })
                    }
                    placeholder="English meaning"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes {t('common.optional')}
                  </label>
                  <textarea
                    value={newItemMetadata.notes}
                    onChange={e =>
                      setNewItemMetadata({ ...newItemMetadata, notes: e.target.value })
                    }
                    placeholder="Personal notes or mnemonics"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                      bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100
                      dark:hover:bg-dark-700 rounded-lg transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={!newItemContent.trim()}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
                      disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {t('common.add')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete single item confirmation dialog */}
      <Dialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        title={t('lists.confirmDelete')}
        message={t('lists.confirmDeleteMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          if (deletingItem) {
            handleRemoveItem(deletingItem)
          }
        }}
        type="danger"
      />

      {/* Kanji Details Modal */}
      {modalKanji && (
        <KanjiDetailsModal
          kanji={modalKanji}
          isOpen={!!modalKanji}
          onClose={() => setModalKanji(null)}
        />
      )}

      {/* Word Details Modal */}
      {modalWord && (
        <WordDetailsModal
          word={modalWord}
          isOpen={!!modalWord}
          onClose={() => setModalWord(null)}
          user={user}
        />
      )}
      <MobileNavSpacer />
    </div>
  )
}
