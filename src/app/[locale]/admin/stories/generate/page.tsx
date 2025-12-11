'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import { JLPTLevel } from '@/types/ai-story'
import { STORY_THEMES } from '@/types/story'
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

  // Form state
  const [theme, setTheme] = useState<string>('')
  const [customTheme, setCustomTheme] = useState<string>('')
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5')
  const [pageCount, setPageCount] = useState<number>(5)
  const [generateImages, setGenerateImages] = useState<boolean>(true)
  const [includeQuiz, setIncludeQuiz] = useState<boolean>(true)

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
    const finalTheme = theme === 'custom' ? customTheme : theme

    if (!finalTheme) {
      showToast(t('admin.stories.generate.errors.themeRequired'), 'error')
      return
    }

    if (!user?.uid) {
      showToast(t('admin.stories.generate.errors.authRequired'), 'error')
      return
    }

    setIsGenerating(true)
    setCurrentStep('generating')
    setGenerationProgress({
      step: 'character_sheet',
      message: t('admin.stories.generate.progress.characterSheet'),
      progress: 10,
    })

    try {
      // Step 1: Generate character sheet
      const characterResponse = await fetch('/api/admin/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          step: 'character_sheet',
          theme: finalTheme,
          jlptLevel,
          pageCount,
        }),
      })

      if (!characterResponse.ok) {
        const error = await characterResponse.json()
        throw new Error(error.error || 'Failed to generate character sheet')
      }

      const characterData = await characterResponse.json()
      const newDraftId = characterData.draftId
      setDraftId(newDraftId)

      // Update progress
      setGenerationProgress({
        step: 'outline',
        message: t('admin.stories.generate.progress.outline'),
        progress: 25,
      })

      // Step 2: Generate outline
      const outlineResponse = await fetch('/api/admin/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          step: 'outline',
          theme: finalTheme,
          jlptLevel,
          pageCount,
          draftId: newDraftId,
        }),
      })

      if (!outlineResponse.ok) {
        const error = await outlineResponse.json()
        throw new Error(error.error || 'Failed to generate outline')
      }

      // Step 3: Generate pages one by one
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        setGenerationProgress({
          step: 'pages',
          currentPage: pageNum,
          totalPages: pageCount,
          message: t('admin.stories.generate.progress.writingPage', {
            current: pageNum,
            total: pageCount,
          }),
          progress: 25 + (pageNum / pageCount) * 40,
        })

        const pageResponse = await fetch('/api/admin/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            step: 'generate_page',
            jlptLevel,
            pageNumber: pageNum,
            draftId: newDraftId,
          }),
        })

        if (!pageResponse.ok) {
          const error = await pageResponse.json()
          throw new Error(error.error || `Failed to generate page ${pageNum}`)
        }
      }

      // Step 4: Generate quiz if requested
      if (includeQuiz) {
        setGenerationProgress({
          step: 'quiz',
          message: t('admin.stories.generate.progress.quiz'),
          progress: 70,
        })

        const quizResponse = await fetch('/api/admin/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            step: 'generate_quiz',
            jlptLevel,
            draftId: newDraftId,
          }),
        })

        if (!quizResponse.ok) {
          console.error('Quiz generation failed, but continuing...')
        }
      }

      // Step 5: Generate character model sheet if images requested
      if (generateImages) {
        try {
          setGenerationProgress({
            step: 'images',
            message: t('admin.stories.generate.progress.modelSheet'),
            progress: 70,
          })

          const modelSheetResponse = await fetch('/api/admin/generate-story', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              step: 'generate_model_sheet',
              draftId: newDraftId,
            }),
          })

          if (!modelSheetResponse.ok) {
            console.error('Model sheet generation failed, continuing without images...')
          } else {
            const modelSheetData = await modelSheetResponse.json()
            console.log('✅ Model sheet generated:', modelSheetData.data)

            // Step 6: Generate images for each page
            for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
              try {
                setGenerationProgress({
                  step: 'images',
                  currentPage: pageNum,
                  totalPages: pageCount,
                  message: t('admin.stories.generate.progress.generatingImage', {
                    current: pageNum,
                    total: pageCount,
                  }),
                  progress: 70 + (pageNum / pageCount) * 25,
                })

                const imageResponse = await fetch('/api/admin/generate-story', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    step: 'generate_page_image',
                    draftId: newDraftId,
                    pageNumber: pageNum,
                  }),
                })

                if (!imageResponse.ok) {
                  console.error(`Image generation failed for page ${pageNum}`)
                } else {
                  const imageData = await imageResponse.json()
                  console.log(`✅ Image generated for page ${pageNum}:`, imageData.data)
                }
              } catch (imageError) {
                console.error(`Error generating image for page ${pageNum}:`, imageError)
                // Continue with next page even if this one fails
              }
            }
          }
        } catch (imageError) {
          console.error('Image generation error:', imageError)
          showToast(t('admin.stories.generate.errors.imageFailed'), 'warning')
        }
      }

      setGenerationProgress({
        step: 'complete',
        message: t('admin.stories.generate.progress.publishing'),
        progress: 95,
      })

      // Automatically publish the story to make it visible in admin list
      try {
        const publishResponse = await fetch('/api/admin/stories/publish-draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ draftId: newDraftId }),
        })

        if (!publishResponse.ok) {
          throw new Error('Failed to publish story')
        }

        const { storyId } = await publishResponse.json()
        console.log('✅ Story published:', storyId)

        setGenerationProgress({
          step: 'complete',
          message: t('admin.stories.generate.progress.complete'),
          progress: 100,
        })

        showToast(t('admin.stories.generate.success.generated'), 'success')

        // Redirect to stories page after a short delay
        setTimeout(() => {
          router.push('/admin/stories')
        }, 2000)
      } catch (publishError) {
        console.error('Error publishing story:', publishError)
        showToast(t('admin.stories.generate.errors.publishFailed'), 'warning')

        // Still redirect to stories page
        setTimeout(() => {
          router.push('/admin/stories')
        }, 2000)
      }
    } catch (error) {
      console.error('Story generation error:', error)
      showToast(error instanceof Error ? error.message : 'Failed to generate story', 'error')
      setCurrentStep('setup')
    } finally {
      setIsGenerating(false)
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
              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.stories.generate.theme')}
                </label>
                <select
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                >
                  <option value="">{t('admin.stories.generate.themePlaceholder')}</option>
                  {STORY_THEMES.map(themeOption => (
                    <option key={themeOption} value={themeOption}>
                      {themeOption}
                    </option>
                  ))}
                  <option value="custom">{t('admin.stories.generate.customTheme')}</option>
                </select>

                {theme === 'custom' && (
                  <input
                    type="text"
                    value={customTheme}
                    onChange={e => setCustomTheme(e.target.value)}
                    placeholder={t('admin.stories.generate.customThemePlaceholder')}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                  />
                )}
              </div>

              {/* JLPT Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.stories.generate.jlptLevel')}
                </label>
                <select
                  value={jlptLevel}
                  onChange={e => setJlptLevel(e.target.value as JLPTLevel)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                >
                  <option value="N5">{t('admin.stories.generate.jlptOptions.N5')}</option>
                  <option value="N4">{t('admin.stories.generate.jlptOptions.N4')}</option>
                  <option value="N3">{t('admin.stories.generate.jlptOptions.N3')}</option>
                  <option value="N2">{t('admin.stories.generate.jlptOptions.N2')}</option>
                  <option value="N1">{t('admin.stories.generate.jlptOptions.N1')}</option>
                </select>
              </div>

              {/* Page Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.stories.generate.pageCount')}
                </label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={pageCount}
                  onChange={e => {
                    const num = parseInt(e.target.value)
                    if (!isNaN(num)) {
                      setPageCount(num)
                    }
                  }}
                  onBlur={e => {
                    // When user leaves the field, enforce min/max
                    const num = parseInt(e.target.value)
                    if (isNaN(num) || num < 3) {
                      setPageCount(3)
                    } else if (num > 20) {
                      setPageCount(20)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('admin.stories.generate.pageCountHint')}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={generateImages}
                    onChange={e => setGenerateImages(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {t('admin.stories.generate.options.generateImages')}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeQuiz}
                    onChange={e => setIncludeQuiz(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {t('admin.stories.generate.options.includeQuiz')}
                  </span>
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!theme && !customTheme}
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
                <div className="space-y-6 max-h-96 overflow-y-auto">
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
