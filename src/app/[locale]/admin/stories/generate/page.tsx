'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import { AIStoryDraft, AIGenerationProgress, AICharacterSheet } from '@/types/ai-story'
import { storyService } from '@/lib/services/StoryService'
// Navigation is now global via NavigationWrapper in root layout;
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import RegenerateImageModal from '@/components/admin/RegenerateImageModal'
import { motion, AnimatePresence } from 'framer-motion'

export default function GenerateStoryPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useAuth()
  const { showToast } = useToast()
  const { t } = useI18n()

  // Progress tracking state
  const [progress, setProgress] = useState<{ step: string; percentage: number } | null>(null)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<AIGenerationProgress | null>(null)
  const [storyDraft, setStoryDraft] = useState<AIStoryDraft | null>(null)
  const [currentStep, setCurrentStep] = useState<'setup' | 'generating' | 'review'>('setup')
  const [draftId, setDraftId] = useState<string | null>(null)

  // Character and session state for consistency
  const [characterProfile, setCharacterProfile] = useState<any>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Regeneration modal state
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')
  const [selectedPageNumber, setSelectedPageNumber] = useState<number | undefined>()

  const handleOpenRegenerateModal = (imageUrl: string, pageNumber?: number) => {
    setSelectedImageUrl(imageUrl)
    setSelectedPageNumber(pageNumber)
    setIsRegenerateModalOpen(true)
  }

  const handleImageRegenerated = async (newImageUrl: string) => {
    // Reload draft to get updated data
    if (draftId) {
      const draft = await storyService.getAIDraft(draftId)
      if (draft) {
        setStoryDraft(draft)
      }
    }
  }

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/')
    }
  }, [user, sessionLoading, router])

  const handleGenerate = async () => {
    if (!user?.uid) {
      showToast(t('admin.stories.generate.errors.authRequired'), 'error')
      return
    }

    setIsGenerating(true)
    setCurrentStep('generating')
    setProgress({ step: 'starting', percentage: 0 })

    try {
      // Dynamically import Firebase functions
      const { getFunctions, httpsCallable } = await import('firebase/functions')
      const { app } = await import('@/lib/firebase/client')
      const functions = getFunctions(app)

      // Call the Cloud Function that runs the automated scheduler
      const generateStory = httpsCallable(functions, 'manualStoryGeneratorFunction')
      const result = await generateStory({})
      const data = result.data as any

      if (!data.success || !data.draftId) {
        throw new Error(data.error || 'Failed to start story generation')
      }

      const newDraftId = data.draftId
      setDraftId(newDraftId)

      // Set up Firestore listener for real-time progress
      const { doc, onSnapshot } = await import('firebase/firestore')
      const { firestore } = await import('@/lib/firebase/client')

      const unsubscribe = onSnapshot(
        doc(firestore, 'ai_story_drafts', newDraftId),
        (snapshot) => {
          const draftData = snapshot.data()
          if (!draftData) return

          const step = draftData.metadata?.generationStep || 'starting'
          const percentage = draftData.metadata?.progress || 0

          setProgress({ step, percentage })

          // Update generationProgress for compatibility with existing UI
          const stepMessages: Record<string, string> = {
            character_sheet: t('admin.stories.generate.progress.characterSheet'),
            outline: t('admin.stories.generate.progress.outline'),
            pages: t('admin.stories.generate.progress.writingPage', { current: 1, total: 5 }),
            quiz: t('admin.stories.generate.progress.quiz'),
            model_sheet: t('admin.stories.generate.progress.modelSheet'),
            page_images: t('admin.stories.generate.progress.generatingImage', { current: 1, total: 5 }),
            audio: 'Generating audio...',
            sentences: 'Generating sentence translations...',
            publish: t('admin.stories.generate.progress.publishing'),
            completed: t('admin.stories.generate.progress.complete'),
          }

          setGenerationProgress({
            step,
            message: stepMessages[step] || `Processing ${step}...`,
            progress: percentage,
          })

          // When completed, redirect to stories page
          if (step === 'completed' && percentage === 100) {
            showToast(t('admin.stories.generate.success.generated'), 'success')
            setIsGenerating(false)
            unsubscribe()

            setTimeout(() => {
              router.push('/admin/stories')
            }, 2000)
          }

          // Handle errors
          if (draftData.metadata?.error) {
            throw new Error(draftData.metadata.error)
          }
        },
        (error) => {
          console.error('Error listening to draft updates:', error)
          showToast('Failed to track generation progress', 'error')
          unsubscribe()
          setIsGenerating(false)
          setCurrentStep('setup')
        }
      )
    } catch (error) {
      console.error('Story generation error:', error)
      showToast(error instanceof Error ? error.message : 'Failed to generate story', 'error')
      setIsGenerating(false)
      setCurrentStep('setup')
      setProgress(null)
      setGenerationProgress(null)
    }
  }

  const handlePublish = async () => {
    if (!storyDraft || !draftId) return

    try {
      // Convert draft to story format and save
      const slug = storyDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()

      await storyService.saveStory({
        title: storyDraft.title,
        titleJa: storyDraft.titleJa,
        description: storyDraft.description,
        theme: storyDraft.theme,
        jlptLevel: storyDraft.jlptLevel,
        pages: storyDraft.pages,
        quiz: [],
        authorId: user?.uid || 'admin',
        status: 'published',
        viewCount: 0,
        completionCount: 0,
        slug,
        tags: ['ai-generated'],
        isAIGenerated: true,
        aiModel: storyDraft.metadata.openAiModel,
        characterSheet: storyDraft.characterSheet,
      })

      // Update draft status
      await storyService.updateAIDraftStatus(draftId, 'published')

      showToast(t('admin.stories.generate.success.published'), 'success')

      router.push('/admin/stories')
    } catch (error) {
      console.error('Error publishing story:', error)
      showToast(t('admin.stories.generate.errors.generalFailed'), 'error')
    }
  }

  const handleSaveDraft = async () => {
    if (!storyDraft || !draftId) return

    try {
      await storyService.updateAIDraftStatus(draftId, 'draft')

      showToast(t('admin.stories.generate.success.draftSaved'), 'success')

      router.push('/admin/stories')
    } catch (error) {
      console.error('Error saving draft:', error)
      showToast(t('admin.stories.generate.errors.saveDraftFailed'), 'error')
    }
  }

  if (sessionLoading) {
    return <LoadingOverlay />
  }

  if (!user || !user.isAdmin) {
    return null
  }

  return (
    <>
      {/* Navigation is now global - rendered in root layout */}
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            {t('admin.stories.generate.title')}
          </h1>

          {/* Setup Form */}
          {currentStep === 'setup' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-dark-700 space-y-6"
            >
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-400">
                  Generate a new story using the automated scheduler. The story will include:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>Character sheet and model sheet</li>
                  <li>Story pages with illustrations</li>
                  <li>Comprehension quiz</li>
                  <li>Audio narration (VOICEVOX)</li>
                  <li>Sentence translations</li>
                </ul>
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  Theme and JLPT level are automatically selected based on the current date rotation.
                </p>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm"
              >
                {t('admin.stories.generate.button')}
              </button>
            </motion.div>
          )}

          {/* Generation Progress */}
          {currentStep === 'generating' && generationProgress && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg"
            >
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('common.generating')}
                </h2>

                {/* Progress Message */}
                <p className="text-gray-600 dark:text-gray-400">{generationProgress.message}</p>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <motion.div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${generationProgress.progress || 0}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Step Details */}
                {generationProgress.currentPage && generationProgress.totalPages && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    {t('admin.stories.generate.labels.page')} {generationProgress.currentPage} /{' '}
                    {generationProgress.totalPages}
                  </p>
                )}

                {/* Loading Animation */}
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Review Draft */}
          {currentStep === 'review' && storyDraft && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Draft Preview */}
              <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {storyDraft.title}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                  {storyDraft.titleJa}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-4">{storyDraft.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      {t('admin.stories.generate.labels.theme')}:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {storyDraft.theme}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      {t('admin.stories.generate.labels.level')}:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {storyDraft.jlptLevel}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      {t('admin.stories.generate.labels.pages')}:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {storyDraft.pages.length}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      {t('admin.stories.generate.labels.status')}:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {storyDraft.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Character Sheet Preview */}
              {storyDraft.characterSheet && (
                <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    {t('admin.stories.generate.review.characterDesign')}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Character Model Sheet */}
                    {(storyDraft as any).modelSheet?.imageUrl && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {t('admin.stories.generate.review.modelSheet')}
                          </p>
                          <button
                            onClick={() =>
                              handleOpenRegenerateModal((storyDraft as any).modelSheet.imageUrl)
                            }
                            className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 rounded transition-colors"
                          >
                            {t('admin.stories.generate.review.regenerate')}
                          </button>
                        </div>
                        <img
                          src={(storyDraft as any).modelSheet.imageUrl}
                          alt="Character Model Sheet"
                          className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                        />
                      </div>
                    )}

                    {/* Character Details */}
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          {t('admin.stories.generate.labels.mainCharacter')}:
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          {storyDraft.characterSheet.mainCharacter.name} (
                          {storyDraft.characterSheet.mainCharacter.nameJa})
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">
                        {storyDraft.characterSheet.mainCharacter.description}
                      </p>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          {t('admin.stories.generate.labels.visualStyle')}:
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          {storyDraft.characterSheet.visualStyle}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Page Preview */}
              <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  {t('admin.stories.generate.review.pagesPreview')}
                </h3>
                <div className="space-y-6 max-h-96 overflow-y-auto scrollbar-hide">
                  {storyDraft.pages.slice(0, 3).map((page, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <p className="font-medium text-gray-900 dark:text-white mb-2">
                        {t('admin.stories.generate.labels.page')} {page.pageNumber}
                      </p>

                      {/* Page Image */}
                      {(page as any).imageUrl && (
                        <div className="mb-3 relative group">
                          <img
                            src={(page as any).imageUrl}
                            alt={`Page ${page.pageNumber}`}
                            className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                          <button
                            onClick={() =>
                              handleOpenRegenerateModal((page as any).imageUrl, page.pageNumber)
                            }
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 bg-white/90 dark:bg-dark-900/90 text-primary-600 dark:text-primary-400 hover:bg-white dark:hover:bg-dark-900 rounded-lg shadow-lg text-sm font-medium"
                          >
                            {t('admin.stories.generate.review.regenerate')}
                          </button>
                        </div>
                      )}

                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        {page.text.substring(0, 150)}...
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        {page.translation.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
                  {storyDraft.pages.length > 3 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      {t('admin.stories.generate.review.morePages', {
                        count: storyDraft.pages.length - 3,
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handlePublish}
                  className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  {t('admin.stories.generate.actions.publish')}
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  {t('admin.stories.generate.actions.saveDraft')}
                </button>
                <button
                  onClick={() => {
                    setCurrentStep('setup')
                    setStoryDraft(null)
                    setDraftId(null)
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  {t('admin.stories.generate.actions.startOver')}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Regenerate Image Modal */}
        {draftId && (
          <RegenerateImageModal
            isOpen={isRegenerateModalOpen}
            onClose={() => setIsRegenerateModalOpen(false)}
            currentImageUrl={selectedImageUrl}
            pageNumber={selectedPageNumber}
            draftId={draftId}
            onImageRegenerated={handleImageRegenerated}
          />
        )}
      </div>
    </>
  )
}
