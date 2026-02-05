'use client'

import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import Alert from '@/components/ui/Alert'
import { Upload, FileText, CheckCircle2, Settings, Package } from 'lucide-react'
import { AnkiImporter, ImportResult, AnkiDeck, DEFAULT_ANKI_DECK_SETTINGS } from '@/lib/anki/importer'
import { AnkiMediaStore, buildAnkiMediaKey } from '@/lib/anki/mediaStore'
import { storageManager } from '@/lib/flashcards/StorageManager'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'

interface AnkiImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess?: (result: ImportResult) => void
}

type ImportStep = 'select' | 'preview' | 'complete'

export function AnkiImportModal({ isOpen, onClose, onImportSuccess }: AnkiImportModalProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<ImportStep>('select')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Preview state - editable before final import
  const [previewDeck, setPreviewDeck] = useState<AnkiDeck | null>(null)
  const [deckName, setDeckName] = useState('')
  const [newCardsPerDay, setNewCardsPerDay] = useState(DEFAULT_ANKI_DECK_SETTINGS.newCardsPerDay)
  const [reviewsPerDay, setReviewsPerDay] = useState(DEFAULT_ANKI_DECK_SETTINGS.reviewsPerDay)
  const [strictTemplateMode, setStrictTemplateMode] = useState(DEFAULT_ANKI_DECK_SETTINGS.strictTemplateMode)
  const [backupToCloud, setBackupToCloud] = useState(false)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      await processFile(selectedFile)
    }
  }

  const processFile = async (selectedFile: File) => {
    const validation = AnkiImporter.validateFile(selectedFile)
    if (!validation.valid) {
      setError(validation.error || t('anki.invalidFile'))
      return
    }

    setFile(selectedFile)
    setError('')
    setImportResult(null)

    // Parse the file to get deck preview
    setParsing(true)
    setProgress(0)

    try {
      const result = await AnkiImporter.importDeck(selectedFile, {
        onProgress: (prog, message) => {
          setProgress(prog)
          setProgressMessage(message)
        },
        strictTemplateMode,
      })

      if (result.success && result.deck) {
        setPreviewDeck(result.deck)

        // Use filename without extension as default deck name (more user-friendly than Anki's internal name)
        const fileNameWithoutExt = selectedFile.name.replace(/\.apkg$/i, '')

        // Use filename unless it's generic, then fallback to Anki deck name
        const suggestedName = fileNameWithoutExt || result.deck.name || 'Imported Deck'
        setDeckName(suggestedName)

        // Use deck's existing settings or defaults
        setNewCardsPerDay(result.deck.settings?.newCardsPerDay ?? DEFAULT_ANKI_DECK_SETTINGS.newCardsPerDay)
        setReviewsPerDay(result.deck.settings?.reviewsPerDay ?? DEFAULT_ANKI_DECK_SETTINGS.reviewsPerDay)
        setStrictTemplateMode(result.deck.settings?.strictTemplateMode ?? DEFAULT_ANKI_DECK_SETTINGS.strictTemplateMode)
        setStep('preview')
      } else {
        setError(result.error || t('anki.importFailed'))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t('anki.importFailed'))
    } finally {
      setParsing(false)
      setProgress(0)
      setProgressMessage('')
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      await processFile(droppedFile)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
  }

  const handleConfirmImport = async () => {
    if (!previewDeck) return

    const mediaStore = AnkiMediaStore.getInstance()

    setSaving(true)

    try {

      // Apply user's customizations to the deck
      const finalDeck: AnkiDeck = {
        ...previewDeck,
        name: deckName.trim() || previewDeck.name,
        settings: {
          newCardsPerDay,
          reviewsPerDay,
          autoPlayAudio: previewDeck.settings?.autoPlayAudio ?? DEFAULT_ANKI_DECK_SETTINGS.autoPlayAudio,
          strictTemplateMode,
        },
      }


      const mediaBlobs = previewDeck.mediaBlobs || new Map()
      const hasMedia = mediaBlobs.size > 0

      // Store media in IndexedDB (local-only storage)
      if (hasMedia && user?.uid) {
        for (const [filename, blob] of mediaBlobs.entries()) {
          const mediaKey = buildAnkiMediaKey(finalDeck.id, filename)
          await mediaStore.storeMedia(mediaKey, blob, {
            userId: user.uid,
            deckId: finalDeck.id,
            syncStatus: 'synced' // 'synced' means successfully stored locally
          })
        }
        showToast(
          `Deck imported! ${mediaBlobs.size} media files stored locally.`,
          'success'
        )
      }

      const result: ImportResult = {
        success: true,
        deck: finalDeck,
        cardsImported: finalDeck.cards.length,
        packageFile: file || undefined,  // Original .apkg file for R2 backup
        media: mediaBlobs,  // Media blobs for R2 backup
        r2BackupEnabled: isPremium ? backupToCloud : false,
      }


      setImportResult(result)
      setStep('complete')

      if (onImportSuccess) {
        onImportSuccess(result)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t('anki.importFailed'))
    } finally {
      setSaving(false)
    }
  }

  const resetModal = () => {
    setFile(null)
    setStep('select')
    setError('')
    setImportResult(null)
    setPreviewDeck(null)
    setDeckName('')
    setNewCardsPerDay(DEFAULT_ANKI_DECK_SETTINGS.newCardsPerDay)
    setReviewsPerDay(DEFAULT_ANKI_DECK_SETTINGS.reviewsPerDay)
    setStrictTemplateMode(DEFAULT_ANKI_DECK_SETTINGS.strictTemplateMode)
    setBackupToCloud(false)
    setProgress(0)
    setProgressMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    // Close modal first to avoid showing intermediate states
    onClose()
    // Reset after a brief delay to allow modal to close
    setTimeout(() => {
      resetModal()
    }, 300) // Match modal close animation duration
  }

  const handleBack = () => {
    setStep('select')
    setPreviewDeck(null)
    setFile(null)
    setError('')
    setBackupToCloud(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('anki.importTitle')} size="lg">
      <div className="p-6">
        {/* Step 1: File Selection */}
        {step === 'select' && (
          <>
            {/* File Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center
                transition-colors cursor-pointer
                ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-dark-600 hover:border-primary-400'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".apkg"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="space-y-4">
                <Upload className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
                    {t('anki.dropFile')}
                  </p>
                  <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                    {t('anki.orBrowse')}
                  </p>
                </div>
                <p className="text-xs text-text-muted dark:text-dark-text-muted">
                  {t('anki.maxFileSize')}
                </p>
              </div>
            </div>

            {/* Info Alert - Formatting Notice */}
            <Alert
              type="info"
              message={t('anki.formattingNotice')}
              className="mt-4"
            />

            {/* Error Alert */}
            {error && <Alert type="error" message={error} className="mt-4" />}

            {/* Progress Bar (during parsing) */}
            {parsing && (
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary dark:text-dark-text-secondary">
                    {progressMessage || t('anki.processing')}
                  </span>
                  <span className="text-text-primary dark:text-dark-text-primary">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={handleClose} disabled={parsing} className="btn btn-secondary">
                {t('common.cancel')}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Preview & Settings */}
        {step === 'preview' && previewDeck && (
          <>
            <div className="space-y-6">
              {/* Deck Preview Card */}
              <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-8 h-8 text-primary-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-muted dark:text-dark-text-muted truncate" title={file?.name}>
                      {file?.name}
                    </p>
                    <p className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
                      {previewDeck.cards.length} {t('anki.cards')}
                    </p>
                  </div>
                </div>
                {isPremium && (
                  <p className="text-xs text-text-muted dark:text-dark-text-muted">
                    Estimated cloud backup size:{' '}
                    {storageManager.formatBytes(
                      (file?.size || 0) +
                        Array.from(previewDeck.mediaBlobs?.values() || []).reduce(
                          (sum, blob) => sum + blob.size,
                          0
                        )
                    )}
                  </p>
                )}
              </div>

              {isPremium && (
                <div className="border-t border-gray-200 dark:border-dark-600 pt-4">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupToCloud}
                      onChange={(e) => setBackupToCloud(e.target.checked)}
                      className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text-primary dark:text-dark-text-primary">
                        {t('anki.backupToCloud')}
                      </div>
                      <p className="text-xs text-text-muted dark:text-dark-text-muted mt-0.5">
                        {t('anki.backupToCloudHint')}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Editable Deck Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-dark-text-primary mb-2">
                  {t('anki.deckName')}
                </label>
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg
                           bg-white dark:bg-dark-700 text-text-primary dark:text-dark-text-primary
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={previewDeck.name}
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
                    <p className="text-xs text-text-muted dark:text-dark-text-muted mt-1">
                      {t('anki.newCardsHint')}
                    </p>
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
                    <p className="text-xs text-text-muted dark:text-dark-text-muted mt-1">
                      {t('anki.reviewsHint')}
                    </p>
                  </div>
                </div>

                {/* Strict Template Mode Toggle */}
                <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={strictTemplateMode}
                      onChange={(e) => setStrictTemplateMode(e.target.checked)}
                      className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text-primary dark:text-dark-text-primary">
                        {t('anki.strictTemplateMode')}
                      </div>
                      <p className="text-xs text-text-muted dark:text-dark-text-muted mt-0.5">
                        {t('anki.strictTemplateModeHint')}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Due Today Preview */}
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  <strong>{t('anki.dueToday')}:</strong> {Math.min(newCardsPerDay, previewDeck.cards.length)} {t('anki.newCards')}
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                  {t('anki.dueTodayExplanation', {
                    total: previewDeck.cards.length,
                    daily: newCardsPerDay
                  })}
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {error && <Alert type="error" message={error} className="mt-4" />}

            {/* Action Buttons */}
            <div className="flex justify-between mt-6">
              <button onClick={handleBack} disabled={saving} className="btn btn-secondary">
                {t('common.back')}
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={saving || !deckName.trim()}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t('anki.saving') : t('anki.confirmImport')}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {step === 'complete' && importResult?.success && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-text-primary dark:text-dark-text-primary">
              {t('anki.importSuccess')}
            </h3>
            <p className="text-text-secondary dark:text-dark-text-secondary mb-4">
              {t('anki.cardsImported', { count: importResult.cardsImported || 0 })}
            </p>
            {importResult.deck && (
              <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-text-primary dark:text-dark-text-primary">
                  {importResult.deck.name}
                </h4>
                {importResult.deck.settings && (
                  <p className="text-sm text-text-secondary dark:text-dark-text-secondary mt-2">
                    {t('anki.settingsSummary', {
                      newCards: importResult.deck.settings.newCardsPerDay,
                      reviews: importResult.deck.settings.reviewsPerDay,
                    })}
                  </p>
                )}
              </div>
            )}
            <button onClick={handleClose} className="btn btn-primary">
              {t('common.close')}
            </button>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {(parsing || saving) && <LoadingOverlay message={progressMessage || (saving ? t('anki.saving') : '')} />}
    </Modal>
  )
}
