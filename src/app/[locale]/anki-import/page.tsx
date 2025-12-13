'use client'

import { useState, useEffect } from 'react'
// Navigation is now global via NavigationWrapper in root layout;
import { AnkiImportModal } from '@/components/anki/AnkiImportModal'
import { useAnkiImport } from '@/hooks/useAnkiImport'
import { useI18n } from '@/i18n/I18nContext'
import { EntitlementGate } from '@/components/review-engine/EntitlementGate'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager'
import { ImportResult } from '@/lib/anki/importer'
import { Upload, Package, FileText, Trash2, Cloud, HardDrive, Loader2 } from 'lucide-react'

function AnkiImportContent() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const userId = user?.uid || 'guest'
  const isPremiumUser = isPremium === true

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

  const handleImportSuccess = async (result: ImportResult) => {
    // Save the deck to persistent storage
    if (result.deck && userId !== 'guest') {
      setIsSaving(true)
      try {
        await ankiDeckManager.saveDeck(
          result.deck,
          userId,
          isPremiumUser,
          result.deck.name
        )
        console.log('[AnkiImportPage] Deck saved:', result.deck.id)
      } catch (error) {
        console.error('[AnkiImportPage] Failed to save deck:', error)
      } finally {
        setIsSaving(false)
      }
    }

    setIsModalOpen(false)
    loadMediaStats()
    refreshDecks()
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

  // Load media stats on mount
  useEffect(() => {
    loadMediaStats()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
      {/* Navigation is now global - rendered in root layout */}

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
                      {deck.metadata?.hasMedia && (
                        <span className="text-text-muted dark:text-dark-text-muted">
                          {t('anki.hasMedia')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDeck(deck.id)}
                    className="text-red-500 hover:text-red-600 p-2"
                    title={t('anki.deleteDeck')}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Sample Cards */}
                {deck.cards && deck.cards.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-600">
                    <p className="text-sm font-semibold text-text-secondary dark:text-dark-text-secondary mb-2">
                      {t('anki.sampleCards')}:
                    </p>
                    <div className="space-y-2">
                      {deck.cards.slice(0, 3).map((card, idx) => (
                        <div key={idx} className="text-sm bg-gray-50 dark:bg-dark-700 rounded p-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-semibold text-text-muted dark:text-dark-text-muted">
                                {t('anki.front')}:
                              </span>
                              <p className="text-text-primary dark:text-dark-text-primary mt-1">
                                {card.front.substring(0, 100)}
                                {card.front.length > 100 ? '...' : ''}
                              </p>
                            </div>
                            <div>
                              <span className="font-semibold text-text-muted dark:text-dark-text-muted">
                                {t('anki.back')}:
                              </span>
                              <p className="text-text-primary dark:text-dark-text-primary mt-1">
                                {card.back.substring(0, 100)}
                                {card.back.length > 100 ? '...' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Button */}
                <div className="mt-4 flex justify-end">
                  <button className="btn btn-primary">{t('anki.startReview')}</button>
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
    </div>
  )
}

export default function AnkiImportPage() {
  return (
    <EntitlementGate featureId="anki_import">
      <AnkiImportContent />
    </EntitlementGate>
  )
}
