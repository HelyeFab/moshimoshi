'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { AnkiImportModal } from '@/components/anki/AnkiImportModal'
import { useAnkiImport } from '@/hooks/useAnkiImport'
import { useI18n, getLocaleFromPath } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { ankiDeckManager, StoredAnkiDeck } from '@/lib/anki/AnkiDeckManager'
import { ImportResult, DEFAULT_ANKI_DECK_SETTINGS } from '@/lib/anki/importer'
import Modal from '@/components/ui/Modal'
import {
  Upload,
  Package,
  FileText,
  Trash2,
  Cloud,
  HardDrive,
  Loader2,
  Calendar,
  MoreVertical,
  Settings,
  Download,
  X,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

// Helper to calculate remaining cards for a deck
// In a real implementation, this would check against study progress stored in IndexedDB/Firebase
function getDeckStudyStatus(deck: StoredAnkiDeck): {
  remainingNew: number
  remainingReviews: number
  hasCardsDue: boolean
} {
  const settings = deck.settings || DEFAULT_ANKI_DECK_SETTINGS
  const totalCards = deck.cardCount || deck.cards?.length || 0

  // For now, assume all cards are new and no reviews are due yet
  // This will be replaced with actual progress tracking from AnkiStudyManager
  const remainingNew = Math.min(settings.newCardsPerDay, totalCards)
  const remainingReviews = 0 // Will be calculated from study history

  return {
    remainingNew,
    remainingReviews,
    hasCardsDue: remainingNew > 0 || remainingReviews > 0
  }
}

// Deck Settings Menu Component
function DeckMenu({
  deckId,
  isOpen,
  onToggle,
  onEdit,
  onExport,
  onDelete,
  t
}: {
  deckId: string
  isOpen: boolean
  onToggle: () => void
  onEdit: () => void
  onExport: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onToggle}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
        title={t('anki.deckSettings')}
      >
        <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-600 py-1 z-50">
          <button
            onClick={() => { onEdit(); onToggle(); }}
            className="w-full px-4 py-2 text-left text-sm text-text-primary dark:text-dark-text-primary hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3"
          >
            <Settings className="w-4 h-4" />
            {t('anki.editSettings')}
          </button>
          <button
            onClick={() => { onExport(); onToggle(); }}
            className="w-full px-4 py-2 text-left text-sm text-text-primary dark:text-dark-text-primary hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3"
          >
            <Download className="w-4 h-4" />
            {t('anki.exportDeck')}
          </button>
          <div className="border-t border-gray-200 dark:border-dark-600 my-1" />
          <button
            onClick={() => { onDelete(); onToggle(); }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
          >
            <Trash2 className="w-4 h-4" />
            {t('anki.deleteDeck')}
          </button>
        </div>
      )}
    </div>
  )
}

// Edit Settings Modal Component
function EditSettingsModal({
  deck,
  isOpen,
  onClose,
  onSave,
  t
}: {
  deck: StoredAnkiDeck | null
  isOpen: boolean
  onClose: () => void
  onSave: (deckId: string, name: string, newCardsPerDay: number, reviewsPerDay: number) => Promise<void>
  t: (key: string) => string
}) {
  const [name, setName] = useState('')
  const [newCardsPerDay, setNewCardsPerDay] = useState(DEFAULT_ANKI_DECK_SETTINGS.newCardsPerDay)
  const [reviewsPerDay, setReviewsPerDay] = useState(DEFAULT_ANKI_DECK_SETTINGS.reviewsPerDay)
  const [isSaving, setIsSaving] = useState(false)

  // Update form when deck changes
  useEffect(() => {
    if (deck) {
      setName(deck.name)
      setNewCardsPerDay(deck.settings?.newCardsPerDay ?? DEFAULT_ANKI_DECK_SETTINGS.newCardsPerDay)
      setReviewsPerDay(deck.settings?.reviewsPerDay ?? DEFAULT_ANKI_DECK_SETTINGS.reviewsPerDay)
    }
  }, [deck])

  const handleSave = async () => {
    if (!deck) return
    setIsSaving(true)
    try {
      await onSave(deck.id, name, newCardsPerDay, reviewsPerDay)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!deck) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('anki.editDeckSettings')} size="md">
      <div className="p-6 space-y-6">
        {/* Deck Name */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-dark-text-primary mb-2">
            {t('anki.deckName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg
                     bg-white dark:bg-dark-700 text-text-primary dark:text-dark-text-primary
                     focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Study Settings */}
        <div className="border-t border-gray-200 dark:border-dark-600 pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-text-muted dark:text-dark-text-muted" />
            <h3 className="font-semibold text-text-primary dark:text-dark-text-primary">
              {t('anki.studySettings')}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* New Cards Per Day */}
            <div>
              <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-1">
                {t('anki.newCardsPerDay')}
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={newCardsPerDay}
                onChange={(e) => setNewCardsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg
                         bg-white dark:bg-dark-700 text-text-primary dark:text-dark-text-primary
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Reviews Per Day */}
            <div>
              <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-1">
                {t('anki.reviewsPerDay')}
              </label>
              <input
                type="number"
                min="1"
                max="9999"
                value={reviewsPerDay}
                onChange={(e) => setReviewsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg
                         bg-white dark:bg-dark-700 text-text-primary dark:text-dark-text-primary
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Due Today Preview */}
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
          <p className="text-sm text-primary-700 dark:text-primary-300">
            <strong>{t('anki.dueToday')}:</strong> {Math.min(newCardsPerDay, deck.cardCount)} {t('anki.newCards')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-600">
          <button onClick={onClose} className="btn btn-secondary" disabled={isSaving}>
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AnkiImportContent() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { isPremium, isLoading: isLoadingSubscription } = useSubscription()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingDeck, setEditingDeck] = useState<StoredAnkiDeck | null>(null)

  const userId = user?.uid || 'guest'
  // FIXED: Wait for subscription to load before determining premium status
  // isPremium is undefined while loading, so we treat it as false until loaded
  const isPremiumUser = !isLoadingSubscription && isPremium === true

  // Debug: Log subscription state
  console.log('[AnkiImportPage] Subscription:', { isPremium, isLoadingSubscription, isPremiumUser })

  const {
    getMediaStats,
    clearMedia,
    savedDecks,
    isLoadingDecks,
    deleteDeck,
    refreshDecks,
  } = useAnkiImport({
    userId,
    isPremium: isPremiumUser,
  })

  const [mediaStats, setMediaStats] = useState<{ totalFiles: number; totalSize: number } | null>(
    null
  )

  const [limitError, setLimitError] = useState<{ currentCount: number; limit: number } | null>(null)

  const handleImportSuccess = async (result: ImportResult) => {
    if (result.deck && userId !== 'guest') {
      setIsSaving(true)

      // Warn if subscription is still loading
      if (isLoadingSubscription) {
        console.warn('[AnkiImportPage] Subscription still loading - saving as local only!')
      }

      console.log('[AnkiImportPage] Saving deck with premium status:', isPremiumUser)

      try {
        await ankiDeckManager.saveDeck(
          result.deck,
          userId,
          isPremiumUser,
          result.deck.name
        )
        console.log('[AnkiImportPage] Deck saved:', result.deck.id, { toFirebase: isPremiumUser })
        setIsModalOpen(false)
        loadMediaStats()
        refreshDecks()
      } catch (error: any) {
        console.error('[AnkiImportPage] Failed to save deck:', error)
        if (error?.code === 'LIMIT_REACHED') {
          setLimitError({
            currentCount: error.currentCount || 0,
            limit: error.limit || 15,
          })
          setIsModalOpen(false)
        }
      } finally {
        setIsSaving(false)
      }
    } else {
      setIsModalOpen(false)
      loadMediaStats()
      refreshDecks()
    }
  }

  const loadMediaStats = async () => {
    const stats = await getMediaStats()
    setMediaStats(stats)
  }

  const handleClearMedia = async () => {
    if (confirm(t('anki.confirmClearCache'))) {
      await clearMedia()
      setMediaStats(null)
    }
  }

  const handleDeleteDeck = async (deckId: string) => {
    if (confirm(t('anki.confirmDeleteDeck'))) {
      await deleteDeck(deckId)
    }
  }

  const handleEditDeck = (deck: StoredAnkiDeck) => {
    setEditingDeck(deck)
  }

  const handleSaveSettings = async (
    deckId: string,
    name: string,
    newCardsPerDay: number,
    reviewsPerDay: number
  ) => {
    try {
      await ankiDeckManager.updateDeck(
        deckId,
        {
          name,
          settings: {
            newCardsPerDay,
            reviewsPerDay,
            autoPlayAudio: true,
          },
        },
        userId,
        isPremiumUser
      )
      refreshDecks()
    } catch (error) {
      console.error('[AnkiImportPage] Failed to update deck:', error)
    }
  }

  const handleExportDeck = async (deck: StoredAnkiDeck) => {
    try {
      // Create a JSON export of the deck
      const exportData = {
        name: deck.name,
        description: deck.description,
        cards: deck.cards.map(card => ({
          front: card.front,
          back: card.back,
          tags: card.tags,
        })),
        settings: deck.settings,
        exportedAt: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}_export.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[AnkiImportPage] Failed to export deck:', error)
    }
  }

  // Load media stats on mount
  useEffect(() => {
    loadMediaStats()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Import Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-lg flex items-center gap-3 px-8 py-4"
          >
            <Upload className="w-6 h-6" />
            <span className="text-lg">{t('anki.importButton')}</span>
          </button>
        </div>

        {/* Media Stats */}
        {mediaStats && mediaStats.totalFiles > 0 && (
          <div className="bg-soft-white dark:bg-dark-800 rounded-lg p-6 mb-8 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-text-primary dark:text-dark-text-primary">
                  {t('anki.mediaCache')}
                </h3>
                <p className="text-text-secondary dark:text-dark-text-secondary">
                  {t('anki.filesCount', { count: mediaStats.totalFiles })} •{' '}
                  {t('anki.sizeInMB', { size: (mediaStats.totalSize / 1024 / 1024).toFixed(2) })}
                </p>
              </div>
              <button
                onClick={handleClearMedia}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('anki.clearCache')}
              </button>
            </div>
          </div>
        )}

        {/* Storage Status Indicator */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2 text-sm text-text-muted dark:text-dark-text-muted">
            {isPremiumUser ? (
              <>
                <Cloud className="w-4 h-4 text-green-500" />
                <span>{t('anki.syncEnabled')}</span>
              </>
            ) : (
              <>
                <HardDrive className="w-4 h-4" />
                <span>{t('anki.localStorageOnly')}</span>
              </>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoadingDecks && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}

        {/* Imported Decks */}
        {!isLoadingDecks && savedDecks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary mb-4">
              {t('anki.importedDecks')} ({savedDecks.length})
            </h2>
            {savedDecks.map(deck => (
              <div
                key={deck.id}
                className="bg-soft-white dark:bg-dark-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Package className="w-6 h-6 text-primary-500" />
                      <h3 className="text-xl font-semibold text-text-primary dark:text-dark-text-primary">
                        {deck.name}
                      </h3>
                      {deck.metadata?.importedAt && (
                        <span className="text-xs text-text-muted dark:text-dark-text-muted">
                          {new Date(deck.metadata.importedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-text-secondary dark:text-dark-text-secondary mb-4">
                      {deck.description}
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-text-secondary dark:text-dark-text-secondary">
                          {deck.cardCount || deck.cards?.length || 0} {t('anki.cards')}
                        </span>
                      </div>
                      {deck.settings && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary-500" />
                          <span className="text-primary-600 dark:text-primary-400 font-medium">
                            {t('anki.dueToday')}: {Math.min(deck.settings.newCardsPerDay, deck.cardCount || deck.cards?.length || 0)}
                          </span>
                        </div>
                      )}
                      {deck.metadata?.hasMedia && (
                        <span className="text-text-muted dark:text-dark-text-muted">
                          {t('anki.hasMedia')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Settings Menu */}
                  <DeckMenu
                    deckId={deck.id}
                    isOpen={openMenuId === deck.id}
                    onToggle={() => setOpenMenuId(openMenuId === deck.id ? null : deck.id)}
                    onEdit={() => handleEditDeck(deck)}
                    onExport={() => handleExportDeck(deck)}
                    onDelete={() => handleDeleteDeck(deck.id)}
                    t={t}
                  />
                </div>

                {/* Sample Cards */}
                {deck.cards && deck.cards.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-600">
                    <p className="text-sm font-semibold text-text-secondary dark:text-dark-text-secondary mb-2">
                      {t('anki.sampleCards')}:
                    </p>
                    <div className="space-y-2">
                      {deck.cards.slice(0, 3).map((card, idx) => {
                        // Debug: Log card structure to help diagnose blank cards issue
                        if (idx === 0) {
                          console.log('[AnkiImportPage] Sample card structure:', {
                            id: card.id,
                            hasFront: !!card.front,
                            hasBack: !!card.back,
                            front: card.front?.substring?.(0, 30),
                            back: card.back?.substring?.(0, 30),
                            primaryDisplay: card.primaryDisplay?.substring?.(0, 30),
                            primaryAnswer: card.primaryAnswer?.substring?.(0, 30),
                            keys: Object.keys(card).slice(0, 10),
                          })
                        }
                        // Use front/back with fallback to primaryDisplay/primaryAnswer
                        const frontText = card.front || card.primaryDisplay || card.expression || ''
                        const backText = card.back || card.primaryAnswer || card.meaning || ''
                        return (
                          <div key={idx} className="text-sm bg-gray-50 dark:bg-dark-700 rounded p-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-semibold text-text-muted dark:text-dark-text-muted">
                                  {t('anki.front')}:
                                </span>
                                <p className="text-text-primary dark:text-dark-text-primary mt-1">
                                  {frontText ? (
                                    <>
                                      {frontText.substring(0, 100)}
                                      {frontText.length > 100 ? '...' : ''}
                                    </>
                                  ) : (
                                    <span className="text-red-500 italic">(empty - check console)</span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <span className="font-semibold text-text-muted dark:text-dark-text-muted">
                                  {t('anki.back')}:
                                </span>
                                <p className="text-text-primary dark:text-dark-text-primary mt-1">
                                  {backText ? (
                                    <>
                                      {backText.substring(0, 100)}
                                      {backText.length > 100 ? '...' : ''}
                                    </>
                                  ) : (
                                    <span className="text-red-500 italic">(empty - check console)</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Review Button */}
                <div className="mt-4 flex justify-end items-center gap-4">
                  {(() => {
                    const { remainingNew, remainingReviews, hasCardsDue } = getDeckStudyStatus(deck)
                    return (
                      <>
                        {hasCardsDue ? (
                          <>
                            <span className="text-sm text-text-secondary dark:text-dark-text-secondary">
                              {remainingNew > 0 && (
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {t('anki.study.newCardsToday', { count: remainingNew })}
                                </span>
                              )}
                              {remainingNew > 0 && remainingReviews > 0 && ' / '}
                              {remainingReviews > 0 && (
                                <span className="text-orange-600 dark:text-orange-400 font-medium">
                                  {t('anki.study.reviewsToday', { count: remainingReviews })}
                                </span>
                              )}
                            </span>
                            <Link
                              href={`/${getLocaleFromPath()}/anki-study/${deck.id}`}
                              className="btn btn-primary"
                            >
                              {t('anki.study.startStudy')}
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <CheckCircle className="w-4 h-4" />
                              {t('anki.study.noCardsDue')}
                            </span>
                            <button
                              className="btn btn-secondary opacity-50 cursor-not-allowed"
                              disabled
                            >
                              {t('anki.study.startStudy')}
                            </button>
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoadingDecks && savedDecks.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-24 h-24 text-gray-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-text-secondary dark:text-dark-text-secondary mb-2">
              {t('anki.noDecksYet')}
            </h3>
            <p className="text-text-muted dark:text-dark-text-muted">
              {t('anki.noDecksDescription')}
            </p>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <AnkiImportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Edit Settings Modal */}
      <EditSettingsModal
        deck={editingDeck}
        isOpen={editingDeck !== null}
        onClose={() => setEditingDeck(null)}
        onSave={handleSaveSettings}
        t={t}
      />

      {/* Import Limit Error Modal */}
      <Modal
        isOpen={limitError !== null}
        onClose={() => setLimitError(null)}
        title={t('anki.limitReached.title')}
        size="md"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary dark:text-dark-text-primary mb-2">
            {t('anki.limitReached.heading')}
          </h3>
          <p className="text-text-secondary dark:text-dark-text-secondary mb-4">
            {t('anki.limitReached.message', {
              current: limitError?.currentCount || 0,
              limit: limitError?.limit || 15,
            })}
          </p>
          <p className="text-sm text-text-muted dark:text-dark-text-muted mb-6">
            {t('anki.limitReached.suggestion')}
          </p>
          <button
            onClick={() => setLimitError(null)}
            className="btn btn-primary"
          >
            {t('common.understood')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default function AnkiImportPage() {
  return <AnkiImportContent />
}
