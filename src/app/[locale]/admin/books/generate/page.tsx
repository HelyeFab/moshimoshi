'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { JLPTLevel } from '@/types/ai-story'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Sparkles, X, CheckCircle, Circle, Loader2, AlertTriangle } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { uploadBookCoverImage } from '@/lib/utils/imageUpload'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/client'

// Generation steps for the progress UI
type GenerationStep = 'content' | 'cover' | 'audio' | 'words' | 'complete'

interface GenerationProgress {
  step: GenerationStep
  message: string
  progress: number
  wordProgress?: {
    current: number
    total: number
    currentWord?: string
  }
  audioStatus?: 'success' | 'failed' | 'skipped'
  audioError?: string
}

// Step configuration for the stepper UI
const GENERATION_STEPS: { key: GenerationStep; label: string; description: string }[] = [
  { key: 'content', label: 'Content', description: 'Generating book summary' },
  { key: 'cover', label: 'Cover', description: 'Creating cover image' },
  { key: 'audio', label: 'Audio', description: 'Generating TTS audio' },
  { key: 'words', label: 'Words', description: 'Pre-caching word explanations' },
  { key: 'complete', label: 'Complete', description: 'Publishing book' },
]

export default function GenerateBookPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useAuth()
  const { showToast } = useToast()

  // Form state
  const [bookName, setBookName] = useState<string>('')
  const [author, setAuthor] = useState<string>('')
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5')
  const [additionalContext, setAdditionalContext] = useState<string>('')
  const [coverOption, setCoverOption] = useState<'upload' | 'ai' | 'none'>('ai')
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [coverImagePreview, setCoverImagePreview] = useState<string>('')
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)
  const [currentStep, setCurrentStep] = useState<'setup' | 'generating' | 'complete'>('setup')
  const [generatedBookId, setGeneratedBookId] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [firestoreData, setFirestoreData] = useState<any>(null)

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/')
    }
  }, [user, sessionLoading, router])

  // Real-time Firestore listener for draft progress
  useEffect(() => {
    if (!draftId || !firestore) return

    console.log(`🔄 Setting up Firestore listener for draft: ${draftId}`)

    const unsubscribe = onSnapshot(
      doc(firestore, 'book_drafts', draftId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          setFirestoreData(data)

          console.log(`📊 Firestore update:`, {
            status: data.status,
            step: data.metadata?.generationStep,
            progress: data.metadata?.progress,
            wordProgress: data.metadata?.wordProgress,
          })

          // Update progress based on Firestore data
          const step = data.metadata?.generationStep as GenerationStep || 'content'
          const progress = data.metadata?.progress || 0

          // Build message based on current step
          let message = 'Processing...'
          switch (step) {
            case 'content':
              message = 'AI is creating the condensed summary...'
              break
            case 'cover':
              message = 'Generating cover image with DALL-E 3...'
              break
            case 'audio':
              message = 'Creating TTS audio...'
              break
            case 'words':
              const wordProg = data.metadata?.wordProgress
              if (wordProg) {
                message = `Generating word explanations (${wordProg.current}/${wordProg.total})...`
              } else {
                message = 'Pre-caching word explanations...'
              }
              break
            case 'complete':
              message = 'Generation complete!'
              break
          }

          setGenerationProgress({
            step,
            message,
            progress,
            wordProgress: data.metadata?.wordProgress,
            audioStatus: data.metadata?.audioStatus,
            audioError: data.metadata?.audioError,
          })
        }
      },
      (error) => {
        console.error('Firestore listener error:', error)
      }
    )

    return () => {
      console.log(`🔄 Cleaning up Firestore listener for draft: ${draftId}`)
      unsubscribe()
    }
  }, [draftId])

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error')
        return
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image must be less than 10MB', 'error')
        return
      }

      setCoverImageFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveCoverImage = () => {
    setCoverImageFile(null)
    setCoverImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleGenerate = async () => {
    if (!bookName) {
      showToast('Please enter a book name', 'error')
      return
    }

    if (!user?.uid) {
      showToast('Authentication required', 'error')
      return
    }

    setIsGenerating(true)
    setCurrentStep('generating')

    try {
      let coverImageUrl = ''

      // Step 1: Upload cover image if provided
      if (coverOption === 'upload' && coverImageFile) {
        setGenerationProgress({
          step: 'cover',
          message: 'Uploading cover image...',
          progress: 5,
        })
        setIsUploadingCover(true)

        try {
          coverImageUrl = await uploadBookCoverImage(coverImageFile)
          console.log('✅ Cover image uploaded:', coverImageUrl)
        } catch (uploadError) {
          console.error('Cover image upload failed:', uploadError)
          showToast('Cover image upload failed, continuing without it', 'warning')
        } finally {
          setIsUploadingCover(false)
        }
      }

      // Step 2: Initialize draft to get ID for real-time tracking
      setGenerationProgress({
        step: 'content',
        message: 'Initializing draft...',
        progress: 5,
      })

      const initResponse = await fetch('/api/admin/books/init-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          bookName,
          author,
          jlptLevel,
          additionalContext,
          coverImageUrl,
          generateCover: coverOption === 'ai',
        }),
      })

      if (!initResponse.ok) {
        const error = await initResponse.json()
        throw new Error(error.error || 'Failed to initialize draft')
      }

      const initResult = await initResponse.json()
      const receivedDraftId = initResult.draftId

      // Set draftId immediately to enable real-time Firestore listener
      setDraftId(receivedDraftId)
      setGeneratedBookId(receivedDraftId)

      console.log(`📝 Draft initialized: ${receivedDraftId}, starting generation...`)

      // Step 3: Start the actual generation (real-time progress will be shown via Firestore)
      setGenerationProgress({
        step: 'content',
        message: 'Starting AI generation...',
        progress: 10,
      })

      const generateResponse = await fetch('/api/admin/books/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          draftId: receivedDraftId, // Pass the existing draftId
          bookName,
          author,
          jlptLevel,
          additionalContext,
          coverImageUrl,
          generateCover: coverOption === 'ai',
        }),
      })

      if (!generateResponse.ok) {
        const error = await generateResponse.json()
        throw new Error(error.error || 'Failed to generate book')
      }

      // API call completed - generation is done (progress was tracked via Firestore)
      setGenerationProgress({
        step: 'complete',
        message: 'Book generated successfully! Publishing...',
        progress: 90,
      })

      // Step 3: Auto-publish the book
      const publishResponse = await fetch('/api/admin/books/publish-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ draftId: receivedDraftId }),
      })

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json()
        console.error('❌ Publish failed:', errorData)
        throw new Error(errorData.error || errorData.details || 'Failed to publish book')
      }

      setGenerationProgress({
        step: 'complete',
        message: 'Book published successfully!',
        progress: 100,
      })

      showToast('Book generated and published successfully!', 'success')

      // Redirect to books management page
      setTimeout(() => {
        router.push('/admin/books')
      }, 2000)
    } catch (error) {
      console.error('Book generation error:', error)
      showToast(error instanceof Error ? error.message : 'Failed to generate book', 'error')
      setCurrentStep('setup')
    } finally {
      setIsGenerating(false)
      setIsUploadingCover(false)
      setGenerationProgress(null)
    }
  }

  if (sessionLoading) {
    return <LoadingOverlay />
  }

  if (!user || !user.isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          📚 Generate Book Summary
        </h1>

        {/* Setup Form */}
        {currentStep === 'setup' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-dark-700 space-y-6"
          >
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">AI will generate:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      A <strong>narrative story version</strong> (not a summary) in Japanese
                    </li>
                    <li>
                      Length: <strong>1000-1500 characters</strong> (5-7 min read, 2-3 pages)
                    </li>
                    <li>Proper story flow with beginning, middle, and end</li>
                    <li>JLPT-appropriate vocabulary and grammar</li>
                    <li>⏱️ Generation may take up to 10 minutes (using your Sheldon server)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Book Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Book Name *
              </label>
              <input
                type="text"
                value={bookName}
                onChange={e => setBookName(e.target.value)}
                placeholder="e.g., The Little Prince, Rich Dad Poor Dad"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Author (Optional)
              </label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="e.g., Antoine de Saint-Exupéry"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty and AI will research and fill in the correct author name
              </p>
            </div>

            {/* JLPT Level */}
            <div>
              <Dropdown
                label="JLPT Level *"
                value={jlptLevel}
                onChange={(value) => setJlptLevel(value as JLPTLevel)}
                options={[
                  { value: 'N5', label: 'N5 (Beginner)' },
                  { value: 'N4', label: 'N4 (Elementary)' },
                  { value: 'N3', label: 'N3 (Intermediate)' },
                  { value: 'N2', label: 'N2 (Upper Intermediate)' },
                  { value: 'N1', label: 'N1 (Advanced)' },
                ]}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The AI will condense the book to match this level's vocabulary and grammar
              </p>
            </div>

            {/* Additional Context */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Context (Optional)
              </label>
              <textarea
                value={additionalContext}
                onChange={e => setAdditionalContext(e.target.value)}
                rows={3}
                placeholder="Any specific focus or instructions for the AI..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
            </div>

            {/* Cover Image Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Book Cover
              </label>
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setCoverOption('ai')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    coverOption === 'ai'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Sparkles className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">AI Generate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCoverOption('upload')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    coverOption === 'upload'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Upload className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">Upload Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCoverOption('none')
                    handleRemoveCoverImage()
                  }}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    coverOption === 'none'
                      ? 'border-gray-500 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <X className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">No Cover</span>
                </button>
              </div>

              {coverOption === 'ai' && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    AI will generate a cover image based on the book title and content using DALL-E
                    3.
                  </p>
                </div>
              )}

              {coverOption === 'upload' && (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageChange}
                    className="hidden"
                  />

                  {!coverImagePreview ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Click to upload cover image
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        PNG, JPG, WebP up to 10MB
                      </span>
                    </button>
                  ) : (
                    <div className="relative inline-block">
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className="w-48 h-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveCoverImage}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Change image
                      </button>
                    </div>
                  )}
                </div>
              )}

              {coverOption === 'none' && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Book will be created without a cover image. You can add one later from the edit
                    page.
                  </p>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!bookName || isGenerating}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm"
            >
              Generate Book Summary
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Generating Book Summary
                </h2>
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {generationProgress.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${generationProgress.progress || 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Stepper UI */}
              <div className="space-y-3">
                {GENERATION_STEPS.map((step, index) => {
                  const currentStepIndex = GENERATION_STEPS.findIndex(s => s.key === generationProgress.step)
                  const stepIndex = index
                  const isCompleted = stepIndex < currentStepIndex
                  const isCurrent = stepIndex === currentStepIndex
                  const isPending = stepIndex > currentStepIndex

                  // Check if audio step has a warning (failed status)
                  const isAudioWarning = step.key === 'audio' &&
                    isCompleted &&
                    generationProgress.audioStatus === 'failed'

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isCurrent
                          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                          : isAudioWarning
                          ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
                          : isCompleted
                          ? 'bg-green-50 dark:bg-green-900/10'
                          : 'bg-gray-50 dark:bg-dark-800'
                      }`}
                    >
                      {/* Step Icon */}
                      <div className="flex-shrink-0">
                        {isAudioWarning ? (
                          <AlertTriangle className="w-6 h-6 text-amber-500" />
                        ) : isCompleted ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : isCurrent ? (
                          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                        )}
                      </div>

                      {/* Step Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium ${
                            isCurrent
                              ? 'text-primary-700 dark:text-primary-300'
                              : isAudioWarning
                              ? 'text-amber-700 dark:text-amber-400'
                              : isCompleted
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p
                          className={`text-sm ${
                            isCurrent
                              ? 'text-primary-600 dark:text-primary-400'
                              : isAudioWarning
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-500 dark:text-gray-500'
                          }`}
                        >
                          {isAudioWarning
                            ? generationProgress.audioError || 'Audio generation failed'
                            : isCurrent && step.key === 'words' && generationProgress.wordProgress
                            ? `Processing word ${generationProgress.wordProgress.current}/${generationProgress.wordProgress.total}${
                                generationProgress.wordProgress.currentWord
                                  ? `: "${generationProgress.wordProgress.currentWord}"`
                                  : ''
                              }`
                            : step.description}
                        </p>
                      </div>

                      {/* Step Status Badge */}
                      {isCurrent && (
                        <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                          In Progress
                        </span>
                      )}
                      {isAudioWarning && (
                        <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                          Warning
                        </span>
                      )}
                      {isCompleted && !isAudioWarning && (
                        <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Word Progress Detail (when in words step) */}
              <AnimatePresence>
                {generationProgress.step === 'words' && generationProgress.wordProgress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Word Explanations Progress
                      </span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {generationProgress.wordProgress.current} / {generationProgress.wordProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                      <motion.div
                        className="bg-blue-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(generationProgress.wordProgress.current / generationProgress.wordProgress.total) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    {generationProgress.wordProgress.currentWord && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        Currently processing: <span className="font-japanese">{generationProgress.wordProgress.currentWord}</span>
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Current Action Message */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                {generationProgress.message}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
