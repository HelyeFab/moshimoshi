'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Upload,
  FileText,
  Package,
  Sparkles,
  ChevronRight,
  Save,
  Trash2,
  List,
  AlertTriangle,
} from 'lucide-react'
import type { CreateDeckRequest, CardSide, CardStyle } from '@/types/flashcards'
import type { UserList } from '@/types/userLists'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { DECK_COLORS, SUGGESTED_DECK_EMOJIS } from '@/types/flashcards'
import { AnkiImportModal } from '@/components/anki/AnkiImportModal'
import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager'
import { VirtualCardList } from './VirtualCardList'
import { ImageUpload } from './ImageUpload'
import { listManager } from '@/lib/lists/ListManager'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown, Check } from 'lucide-react'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import Modal from '@/components/ui/Modal'
import { generateFuriganaBatch, needsFurigana } from '@/lib/flashcards/furiganaUtils'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { getR2UploadQueue } from '@/lib/r2/R2UploadQueue'
import { debugLogger } from '@/lib/debug-logger'
import { storageManager } from '@/lib/flashcards/StorageManager'

interface DeckCreatorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (deck: CreateDeckRequest) => void
  onAnkiImportComplete?: () => void // Called after Anki import to refresh deck list
  userLists?: UserList[]
  userId: string
  isPremium: boolean
  editDeck?: any // FlashcardDeck type when editing
}

type ImportSource = 'scratch' | 'anki' | 'list' | 'csv'

export function DeckCreator({
  isOpen,
  onClose,
  onSave,
  onAnkiImportComplete,
  userLists = [],
  userId,
  isPremium,
  editDeck,
}: DeckCreatorProps) {
  const { t } = useI18n()
  const router = useRouter()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'source' | 'details' | 'cards'>('source')
  const [importSource, setImportSource] = useState<ImportSource>('scratch')
  const [showAnkiImport, setShowAnkiImport] = useState(false)

  // Deck details - initialize with editDeck values if editing
  const [deckName, setDeckName] = useState(editDeck?.name || '')
  const [description, setDescription] = useState(editDeck?.description || '')
  const [selectedEmoji, setSelectedEmoji] = useState(editDeck?.emoji || '🎴')
  const [selectedColor, setSelectedColor] = useState<string>(editDeck?.color || 'primary')
  const [cardStyle, setCardStyle] = useState<CardStyle>(editDeck?.cardStyle || 'minimal')
  const [sessionLength, setSessionLength] = useState<number>(
    editDeck?.settings?.sessionLength || 20
  )

  // Furigana settings
  const [furiganaEnabled, setFuriganaEnabled] = useState<boolean>(
    editDeck?.settings?.furigana?.enabled ?? true
  )
  const [furiganaOnFront, setFuriganaOnFront] = useState<boolean>(
    editDeck?.settings?.furigana?.showOnFront ?? true
  )
  const [furiganaOnBack, setFuriganaOnBack] = useState<boolean>(
    editDeck?.settings?.furigana?.showOnBack ?? true
  )

  // Cards - initialize with editDeck cards if editing
  const [cards, setCards] = useState<Array<{
    id?: string;
    front: string;
    back: string;
    notes?: string;
    frontImage?: { type: 'image'; url: string; filename?: string; alt?: string };
    backImage?: { type: 'image'; url: string; filename?: string; alt?: string };
  }>>(
    editDeck?.cards?.map((card: any) => {
      const frontMedia = typeof card.front === 'string' ? undefined : card.front?.media
      const backMedia = typeof card.back === 'string' ? undefined : card.back?.media
      return {
        id: card.id, // Preserve existing card ID for SRS data
        front: card.front.text || card.front,
        back: card.back.text || card.back,
        notes: card.metadata?.notes || '',
        frontImage: frontMedia?.type === 'image' ? frontMedia : undefined,
        backImage: backMedia?.type === 'image' ? backMedia : undefined,
      }
    }) || []
  )
  const [currentCard, setCurrentCard] = useState<{
    front: string
    back: string
    notes: string
    frontImage?: { type: 'image'; url: string; filename?: string; alt?: string }
    backImage?: { type: 'image'; url: string; filename?: string; alt?: string }
  }>({ front: '', back: '', notes: '' })
  const [selectedListId, setSelectedListId] = useState<string>('')

  // State for dynamically loaded lists
  const [fetchedLists, setFetchedLists] = useState<UserList[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [showListPicker, setShowListPicker] = useState(false)

  // State for limit error modal
  const [limitError, setLimitError] = useState<{ currentCount: number; limit: number } | null>(null)
  const [checkingLimit, setCheckingLimit] = useState(false)

  // State to prevent duplicate saves
  const [isSaving, setIsSaving] = useState(false)

  // If editing, skip source selection and go straight to details
  React.useEffect(() => {
    if (editDeck && isOpen) {
      // Load editDeck data into form
      setDeckName(editDeck.name || '')
      setDescription(editDeck.description || '')
      setSelectedEmoji(editDeck.emoji || '🎴')
      setSelectedColor(editDeck.color || 'primary')
      setCardStyle(editDeck.cardStyle || 'minimal')
      setSessionLength(editDeck.settings?.sessionLength || 20)
      setFuriganaEnabled(editDeck.settings?.furigana?.enabled ?? true)
      setFuriganaOnFront(editDeck.settings?.furigana?.showOnFront ?? true)
      setFuriganaOnBack(editDeck.settings?.furigana?.showOnBack ?? true)
      setCards(
        editDeck.cards?.map((card: any) => {
          const frontMedia = typeof card.front === 'string' ? undefined : card.front?.media
          const backMedia = typeof card.back === 'string' ? undefined : card.back?.media
          return {
            id: card.id, // Preserve existing card ID for SRS data
            front: card.front.text || card.front,
            back: card.back.text || card.back,
            notes: card.metadata?.notes || '',
            frontImage: frontMedia?.type === 'image' ? frontMedia : undefined,
            backImage: backMedia?.type === 'image' ? backMedia : undefined,
          }
        }) || []
      )
      setStep('details')
    }
  }, [editDeck, isOpen])

  // Reset saving state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsSaving(false)
    }
  }, [isOpen])

  // Load lists when "From List" is selected
  React.useEffect(() => {
    const loadLists = async () => {
      if (importSource === 'list' && isOpen && userId) {
        setLoadingLists(true)
        try {
          const lists = await listManager.getLists(userId, isPremium)
          setFetchedLists(lists)
        } catch (error) {
          // Failed to load lists (likely offline) - silently fail
          console.log('[DeckCreator] Could not load lists (offline or network error)')
        } finally {
          setLoadingLists(false)
        }
      }
    }
    loadLists()
  }, [importSource, isOpen, userId, isPremium])

  // Use fetched lists if available, otherwise fall back to prop
  const availableLists = fetchedLists.length > 0 ? fetchedLists : userLists

  // Get selected list details
  const selectedList = availableLists.find(l => l.id === selectedListId)

  // Handle list selection from modal
  const handleListSelect = (listId: string) => {
    setSelectedListId(listId)
    setShowListPicker(false)
  }

  const handleImportSource = (source: ImportSource) => {
    // Redirect free users to pricing for premium features
    if ((source === 'anki' || source === 'csv') && !isPremium) {
      router.push('/pricing')
      return
    }

    setImportSource(source)
    if (source === 'anki') {
      setShowAnkiImport(true)
    } else if (source === 'scratch') {
      setStep('details')
    } else if (source === 'list') {
      setStep('details')
    } else if (source === 'csv') {
      fileInputRef.current?.click()
    }
  }

  const handleAnkiImportSuccess = async (result: any) => {
    if (result.deck) {
      // Save directly using AnkiDeckManager to preserve rich content and set source: 'anki'
      try {
        await ankiDeckManager.saveDeck(
          result.deck,
          userId,
          isPremium,
          result.deck.name
        )

        // Start R2 backup in background for premium users (non-blocking)
        if (isPremium && result.packageFile) {
          debugLogger.r2Upload('Triggering R2 backup in background...', {
            deckId: result.deck.id,
            deckName: result.deck.name,
            hasPackageFile: !!result.packageFile,
            mediaCount: result.media?.size || 0,
            packageSize: Math.round(result.packageFile.size / 1024) + ' KB'
          })

          setTimeout(async () => {
            try {
              const queue = getR2UploadQueue(userId)
              await queue.queueDeckUpload(
                result.deck.id,
                result.packageFile,
                result.media || new Map()
              )
              await queue.start()
              if (!queue.isDeckDeleted(result.deck.id)) {
                debugLogger.success('R2 backup queue started!', {
                  deckId: result.deck.id,
                  deckName: result.deck.name
                })
              }
            } catch (queueError) {
              if ((queueError as any)?.code === 'R2_STORAGE_LIMIT_EXCEEDED') {
                const details = (queueError as any)?.details || {}
                const available = details.availableBytes ?? 0
                const requested = details.requestedBytes ?? 0
                showToast(
                  `Cloud backup limit reached. Available ${storageManager.formatBytes(available)}, needed ${storageManager.formatBytes(requested)}.`,
                  'error'
                )
                return
              }
              debugLogger.error('Failed to start R2 backup!', queueError)
              showToast(
                'Cloud backup is queued. Check the backup badge on your deck.',
                'info'
              )
            }
          }, 100)
        } else if (isPremium && !result.packageFile) {
          debugLogger.error('Premium user but packageFile is missing!', {
            deckId: result.deck.id,
            deckName: result.deck.name,
            message: 'Cannot backup to R2 without package file'
          })
        }

        setShowAnkiImport(false)
        onAnkiImportComplete?.() // Refresh the deck list in the parent
        onClose() // Close the modal - deck is already saved
      } catch (error: any) {

        if (error?.code === 'DUPLICATE_DECK_NAME') {
          showToast(t('errors.resource.alreadyExists') || 'This already exists. Please choose a different name.', 'error')
          setShowAnkiImport(false)
          return
        }

        // Check for deck limit error
        if (error?.code === 'LIMIT_REACHED') {
          setLimitError({
            currentCount: error.currentCount || 0,
            limit: error.limit || 15,
          })
          setShowAnkiImport(false)
          return
        }

        // Fallback: show in the regular flow (loses rich content but at least works)
        setDeckName(result.deck.name)
        setDescription(result.deck.description || '')
        const importedCards = result.deck.cards.map((card: any) => ({
          front: card.front,
          back: card.back,
          notes: card.tags?.join(', ') || '',
        }))
        setCards(importedCards)
        setShowAnkiImport(false)
        setStep('details')
      }
    }
  }

  const handleListImport = async () => {
    if (!selectedListId) return

    const list = availableLists.find(l => l.id === selectedListId)

    if (list) {
      setDeckName(list.name)

      // Filter out items without required metadata (reading OR meaning)
      const validItems = list.items.filter(item => {
        const hasReading = !!item.metadata?.reading?.trim()
        const hasMeaning = !!item.metadata?.meaning?.trim()
        return hasReading || hasMeaning
      })

      const skippedCount = list.items.length - validItems.length
      if (skippedCount > 0) {
        // Show warning toast to user
        const warningMessage = t('lists.validation.invalidItemsSkipped', { count: skippedCount })
        // Note: Toast will be shown in parent component after this returns
      }

      // Convert valid list items to cards
      const importedCards = validItems.map(item => ({
        front: item.content,
        back: item.metadata?.meaning || item.metadata?.reading || '',
        notes: item.metadata?.notes || '',
      }))

      setCards(importedCards)
      setStep('cards')
    }
  }

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const lines = text.split('\n')
      const importedCards: typeof cards = []

      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes('front') ? 1 : 0

      for (let i = startIndex; i < lines.length; i++) {
        if (!lines[i].trim()) continue

        const values = lines[i].match(/(".*?"|[^,]+)/g) || []
        const cleanValues = values.map(value =>
          value.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
        )

        if (cleanValues.length >= 2) {
          importedCards.push({
            front: cleanValues[0],
            back: cleanValues[1],
            notes: cleanValues[2] || '',
          })
        }
      }

      setCards(importedCards)
      setDeckName(file.name.replace('.csv', ''))
      setStep('details')
    }
    reader.readAsText(file)
  }

  const addCard = () => {
    if (currentCard.front && currentCard.back) {
      // Add card with all data including images
      setCards([
        ...cards,
        {
          front: currentCard.front,
          back: currentCard.back,
          notes: currentCard.notes || undefined,
          frontImage: currentCard.frontImage,
          backImage: currentCard.backImage,
        },
      ])
      setCurrentCard({ front: '', back: '', notes: '' })
    }
  }

  const removeCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!deckName || (!editDeck && importSource === 'scratch' && cards.length === 0)) return
    if (isSaving) return // Prevent duplicate saves

    try {
      setIsSaving(true)

      // Generate furigana for cards that need it
      const textsToProcess: string[] = []
      cards.forEach(card => {
        if (needsFurigana(card.front)) textsToProcess.push(card.front)
        if (needsFurigana(card.back)) textsToProcess.push(card.back)
      })

      let furiganaMap = new Map<string, string>()
      if (textsToProcess.length > 0) {
        furiganaMap = await generateFuriganaBatch(textsToProcess)
      }

      const deckRequest: CreateDeckRequest = {
        name: deckName,
        description,
        emoji: selectedEmoji,
        color: selectedColor,
        cardStyle,
        settings: {
          studyDirection: 'front-to-back',
          autoPlay: false,
          showHints: true,
          animationSpeed: 'normal',
          soundEffects: true,
          hapticFeedback: true,
          sessionLength: sessionLength,
          reviewMode: 'srs',
          furigana: {
            enabled: furiganaEnabled,
            showOnFront: furiganaOnFront,
            showOnBack: furiganaOnBack,
          },
        },
        sourceListId: importSource === 'list' ? selectedListId : undefined,
        initialCards: cards.map(card => ({
          ...(card.id ? { id: card.id } : {}), // Preserve existing card ID for SRS data
          front: {
            text: card.front,
            ...(card.frontImage ? { media: card.frontImage } : {}),
          } as CardSide,
          back: {
            text: card.back,
            ...(card.backImage ? { media: card.backImage } : {}),
          } as CardSide,
          metadata: {
            ...(card.notes ? { notes: card.notes } : {}),
            furiganaFront: furiganaMap.get(card.front),
            furiganaBack: furiganaMap.get(card.back),
          },
        })),
      }

      onSave(deckRequest)
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    setStep('source')
    setImportSource('scratch')
    setDeckName('')
    setDescription('')
    setSelectedEmoji('🎴')
    setSelectedColor('primary')
    setCardStyle('minimal')
    setSessionLength(20)
    setCards([])
    setCurrentCard({ front: '', back: '', notes: '' })
    setSelectedListId('')
    setLimitError(null) // Reset limit error when form resets
    setFetchedLists([])
    setLoadingLists(false)
    setShowListPicker(false)
    setIsSaving(false) // Reset saving state
  }

  if (!isOpen) return null

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full sm:max-w-3xl h-[85vh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-dark-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-primary-500" />
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {editDeck ? t('flashcards.editDeck') : t('flashcards.createDeck')}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="px-4 sm:px-6 py-3 bg-gray-50 dark:bg-dark-850 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto">
                  <div
                    className={cn(
                      'flex items-center justify-center min-w-[40px] w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
                      step === 'source'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <span className="sm:hidden">1</span>
                    <span className="hidden sm:inline">1. {t('flashcards.import.selectFile')}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                  <div
                    className={cn(
                      'flex items-center justify-center min-w-[40px] w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
                      step === 'details'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <span className="sm:hidden">2</span>
                    <span className="hidden sm:inline">2. {t('flashcards.deckSettings')}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                  <div
                    className={cn(
                      'flex items-center justify-center min-w-[40px] w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
                      step === 'cards'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <span className="sm:hidden">3</span>
                    <span className="hidden sm:inline">3. {t('flashcards.addCard')}</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto scrollbar-hide">
                {step === 'source' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <button
                      onClick={() => handleImportSource('scratch')}
                      data-testid="flashcards-source-scratch"
                      className="p-4 sm:p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 transition-all group flex flex-col items-center text-center"
                    >
                      <Plus className="w-6 sm:w-8 h-6 sm:h-8 text-primary-500 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">
                        {t('common.create')}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.empty.createFirst')}
                      </p>
                    </button>

                    <button
                      onClick={() => handleImportSource('anki')}
                      className={cn(
                        'p-4 sm:p-6 rounded-xl border-2 transition-all group flex flex-col items-center text-center relative',
                        !isPremium
                          ? 'border-gray-200 dark:border-gray-700 opacity-75 hover:border-orange-400 dark:hover:border-orange-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600'
                      )}
                    >
                      <Package
                        className={cn(
                          'w-6 sm:w-8 h-6 sm:h-8 mb-2 sm:mb-3 group-hover:scale-110 transition-transform',
                          isPremium ? 'text-blue-500' : 'text-gray-400 dark:text-gray-600'
                        )}
                      />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">
                        {t('flashcards.import.ankiTitle')}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.import.supportedFormats')}
                      </p>
                      {!isPremium && (
                        <span className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          {t('common.premiumOnly')}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => handleImportSource('list')}
                      className="p-4 sm:p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 transition-all group flex flex-col items-center text-center"
                    >
                      <List className="w-6 sm:w-8 h-6 sm:h-8 text-green-500 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">
                        {t('flashcards.import.fromList')}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {userLists.length > 0
                          ? `${userLists.length} ${t('lists.title')}`
                          : t('flashcards.import.yourLists')}
                      </p>
                    </button>

                    <button
                      onClick={() => handleImportSource('csv')}
                      className={cn(
                        'p-4 sm:p-6 rounded-xl border-2 transition-all group flex flex-col items-center text-center relative',
                        !isPremium
                          ? 'border-gray-200 dark:border-gray-700 opacity-75 hover:border-orange-400 dark:hover:border-orange-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600'
                      )}
                    >
                      <Upload
                        className={cn(
                          'w-6 sm:w-8 h-6 sm:h-8 mb-2 sm:mb-3 group-hover:scale-110 transition-transform',
                          isPremium ? 'text-purple-500' : 'text-gray-400 dark:text-gray-600'
                        )}
                      />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">
                        {t('flashcards.import.csvTitle')}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.import.csv')}
                      </p>
                      {!isPremium && (
                        <span className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          {t('common.premiumOnly')}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {step === 'details' && (
                  <div className="space-y-6">
                    {/* Deck Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.deckName')}
                      </label>
                      <input
                        type="text"
                        value={deckName}
                        onChange={e => setDeckName(e.target.value)}
                        data-testid="flashcards-deck-name"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={t('flashcards.deckName')}
                      />
                    </div>

                    {/* List Selection (if importing from list) */}
                    {importSource === 'list' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('flashcards.import.selectList')}
                        </label>
                        {loadingLists ? (
                          <div className="flex items-center gap-2 py-3 text-gray-500 dark:text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{t('common.loading')}</span>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowListPicker(true)}
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors flex items-center justify-between"
                            >
                              {selectedList ? (
                                <div className="flex items-center gap-3">
                                  <span className="text-xl">{selectedList.emoji}</span>
                                  <div className="text-left">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {selectedList.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {selectedList.items.length} {t('lists.items')}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {t('flashcards.import.selectList')}
                                </span>
                              )}
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            </button>
                            {availableLists.length === 0 && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                {t('flashcards.import.createListFirst')}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.deckDescription')}
                      </label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows={3}
                        placeholder={t('flashcards.deckDescription')}
                      />
                    </div>

                    {/* Emoji Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('lists.emoji')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_DECK_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => setSelectedEmoji(emoji)}
                            className={cn(
                              'w-12 h-12 rounded-lg text-2xl transition-all',
                              selectedEmoji === emoji
                                ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                                : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('lists.color')}
                      </label>
                      <div className="flex gap-2">
                        {DECK_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={cn(
                              'w-12 h-12 rounded-lg transition-all',
                              selectedColor === color && 'ring-2 ring-offset-2 ring-primary-500',
                              color === 'primary' && 'bg-gradient-to-br from-pink-400 to-pink-600',
                              color === 'ocean' && 'bg-gradient-to-br from-blue-400 to-blue-600',
                              color === 'matcha' && 'bg-gradient-to-br from-green-400 to-green-600',
                              color === 'sunset' && 'bg-gradient-to-br from-orange-400 to-red-600',
                              color === 'lavender' &&
                                'bg-gradient-to-br from-purple-400 to-purple-600',
                              color === 'monochrome' &&
                                'bg-gradient-to-br from-gray-400 to-gray-600'
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Card Style */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.customize.cardStyle')}
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['minimal', 'decorated', 'themed'] as CardStyle[]).map(style => (
                          <button
                            key={style}
                            onClick={() => setCardStyle(style)}
                            className={cn(
                              'px-4 py-2 rounded-lg font-medium transition-all',
                              cardStyle === style
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                            )}
                          >
                            {t(`flashcards.customize.${style}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Session Length */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.settings.sessionLength')}
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="5"
                          max="100"
                          value={sessionLength}
                          onChange={e => setSessionLength(Number(e.target.value))}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="5"
                            max="100"
                            value={sessionLength}
                            onChange={e => {
                              const value = Math.max(5, Math.min(100, Number(e.target.value)))
                              setSessionLength(value)
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('flashcards.cards')}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('flashcards.settings.sessionLengthHint')}
                      </p>
                    </div>

                    {/* Furigana Settings */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('flashcards.settings.furigana')}
                      </label>

                      {/* Enable Furigana Toggle */}
                      <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-850 cursor-pointer">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {t('flashcards.settings.furiganaEnabled')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('flashcards.settings.furiganaEnabledHint')}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={furiganaEnabled}
                          onChange={e => setFuriganaEnabled(e.target.checked)}
                          className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                        />
                      </label>

                      {/* Show on Front/Back Toggles - only visible when enabled */}
                      {furiganaEnabled && (
                        <div className="ml-4 space-y-2">
                          <label className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-dark-850 cursor-pointer">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {t('flashcards.settings.furiganaOnFront')}
                            </span>
                            <input
                              type="checkbox"
                              checked={furiganaOnFront}
                              onChange={e => setFuriganaOnFront(e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                          </label>

                          <label className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-dark-850 cursor-pointer">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {t('flashcards.settings.furiganaOnBack')}
                            </span>
                            <input
                              type="checkbox"
                              checked={furiganaOnBack}
                              onChange={e => setFuriganaOnBack(e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Spacer for mobile bottom nav */}
                    <MobileNavSpacer />
                  </div>
                )}

                {step === 'cards' && (
                  <div className="space-y-6">
                    {/* Add New Card Form */}
                    <div className="p-4 bg-gray-50 dark:bg-dark-850 rounded-lg">
                      <h3 className="font-semibold mb-4">{t('flashcards.addCard')}</h3>
                      <div className="space-y-4">
                        {/* Front Side */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('flashcards.frontSide')}
                          </label>
                          <input
                            type="text"
                            value={currentCard.front}
                            onChange={e =>
                              setCurrentCard({ ...currentCard, front: e.target.value })
                            }
                            data-testid="flashcards-card-front"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700"
                            placeholder={t('flashcards.frontSide')}
                          />
                          <ImageUpload
                            currentImage={
                              currentCard.frontImage
                                ? {
                                    url: currentCard.frontImage.url,
                                    alt: currentCard.frontImage.alt,
                                  }
                                : undefined
                            }
                            onImageAdded={imageData =>
                              setCurrentCard({ ...currentCard, frontImage: imageData })
                            }
                            onImageRemoved={() => {
                              const { frontImage, ...rest } = currentCard
                              setCurrentCard(rest)
                            }}
                            maxSizeMB={1}
                          />
                        </div>

                        {/* Back Side */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('flashcards.backSide')}
                          </label>
                          <input
                            type="text"
                            value={currentCard.back}
                            onChange={e => setCurrentCard({ ...currentCard, back: e.target.value })}
                            data-testid="flashcards-card-back"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700"
                            placeholder={t('flashcards.backSide')}
                          />
                          <ImageUpload
                            currentImage={
                              currentCard.backImage
                                ? { url: currentCard.backImage.url, alt: currentCard.backImage.alt }
                                : undefined
                            }
                            onImageAdded={imageData =>
                              setCurrentCard({ ...currentCard, backImage: imageData })
                            }
                            onImageRemoved={() => {
                              const { backImage, ...rest } = currentCard
                              setCurrentCard(rest)
                            }}
                            maxSizeMB={1}
                          />
                        </div>

                        {/* Notes */}
                        <input
                          type="text"
                          value={currentCard.notes}
                          onChange={e => setCurrentCard({ ...currentCard, notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700"
                          placeholder={t('flashcards.cardNotes')}
                        />
                        <button
                          onClick={addCard}
                          disabled={!currentCard.front || !currentCard.back}
                          data-testid="flashcards-add-card"
                          className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-4 h-4 inline mr-2" />
                          {t('flashcards.addCard')}
                        </button>
                      </div>
                    </div>

                    {/* Card List with Virtual Scrolling */}
                    {cards.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        {t('flashcards.empty.noCards')}
                      </p>
                    ) : (
                      <VirtualCardList
                        cards={cards.map((card, index) => ({
                          id: `temp-card-${index}`,
                          front: { text: card.front },
                          back: { text: card.back },
                          metadata: card.notes ? { notes: card.notes } : undefined,
                        }))}
                        onRemove={removeCard}
                        containerHeight={256} // Equivalent to max-h-64
                        itemHeight={80}
                        showStats={false}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg"
                      />
                    )}

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.totalCards', { count: cards.length })}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <button
                  onClick={() => {
                    if (step === 'details') setStep('source')
                    else if (step === 'cards') setStep('details')
                  }}
                  className={cn(
                    'px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors',
                    step === 'source' && 'invisible'
                  )}
                >
                  {t('common.back')}
                </button>

                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={onClose}
                    className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>

                  {step === 'details' && (
                    <button
                      onClick={() => {
                        if (importSource === 'list' && selectedListId) {
                          handleListImport()
                        } else {
                          setStep('cards')
                        }
                      }}
                      disabled={!deckName}
                      data-testid="flashcards-next"
                      className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 sm:gap-2"
                    >
                      {t('common.next')}
                      <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4" />
                    </button>
                  )}

                  {step === 'cards' && (
                    <button
                      onClick={handleSave}
                      disabled={!deckName || (!editDeck && importSource === 'scratch' && cards.length === 0) || isSaving}
                      data-testid="flashcards-save"
                      className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 sm:gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                      ) : (
                        <Save className="w-3 sm:w-4 h-3 sm:h-4" />
                      )}
                      {isSaving ? t('common.saving') || 'Saving...' : t('common.save')}
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile bottom nav spacer */}
              <MobileNavSpacer />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden file input for CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVUpload}
        className="hidden"
      />

      {/* Anki Import Modal */}
      <AnkiImportModal
        isOpen={showAnkiImport}
        onClose={() => setShowAnkiImport(false)}
        onImportSuccess={handleAnkiImportSuccess}
      />

      {/* List Picker Modal */}
      <Modal
        isOpen={showListPicker}
        onClose={() => setShowListPicker(false)}
        title={t('flashcards.import.selectList')}
        size="md"
      >
        <div className="space-y-2">
          {availableLists.length > 0 ? (
            availableLists.map(list => (
              <button
                key={list.id}
                onClick={() => handleListSelect(list.id)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4',
                  selectedListId === list.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-dark-700'
                )}
              >
                <span className="text-3xl">{list.emoji}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {list.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {list.items.length} {t('lists.items')} • {list.type}
                  </div>
                </div>
                {selectedListId === list.id && (
                  <Check className="w-6 h-6 text-primary-500" />
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                {t('flashcards.import.noLists')}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {t('flashcards.import.createListFirst')}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Deck Limit Error Modal */}
      <Modal
        isOpen={limitError !== null}
        onClose={() => {
          setLimitError(null)
          onClose() // Also close the main modal
        }}
        title={t('anki.limitReached.title')}
        size="md"
      >
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('anki.limitReached.title')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('anki.limitReached.message', {
              current: limitError?.currentCount || 0,
              limit: limitError?.limit || 15,
            })}
          </p>
          <button
            onClick={() => {
              setLimitError(null)
              onClose()
            }}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            {t('anki.limitReached.understood')}
          </button>
        </div>
      </Modal>
    </>
  )
}
