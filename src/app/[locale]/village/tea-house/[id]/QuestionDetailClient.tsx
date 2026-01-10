'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/Avatar'
import Dialog from '@/components/ui/Dialog'
import { ArrowLeft, Edit2, Trash2, Eye, MessageSquare, Loader2, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { cn } from '@/lib/utils'
import VoteButton from '@/components/qa/VoteButton'
import ModerationBadge from '@/components/qa/ModerationBadge'
import AnswerList from '@/components/qa/AnswerList'
import AnswerEditor from '@/components/qa/AnswerEditor'
import { getQuestion, deleteQuestion } from '@/lib/qa/questions'
import type { Question } from '@/types/qa'
import { formatDistanceToNow } from 'date-fns'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore as db } from '@/lib/firebase/client'

/**
 * Question Detail Client Component
 * View full question with answers (client-side interactions)
 *
 * Access: Public (guests can view, must log in to interact)
 */
export default function QuestionDetailClient({ questionId }: { questionId: string }) {
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { user, isGuest } = useAuth()
  const { resolvedTheme } = useTheme()
  const { showToast } = useToast()
  const router = useRouter()

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [answerCount, setAnswerCount] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isAnswerFormCollapsed, setIsAnswerFormCollapsed] = useState(false)

  const isLightTheme = resolvedTheme === 'light'

  // Check if current user is question author
  const isAuthor = user?.uid === question?.author.uid

  // Load question with real-time updates
  useEffect(() => {
    console.log('[QuestionDetail] useEffect triggered for questionId:', questionId)
    loadQuestion()

    // Set up real-time listener for vote count updates
    console.log('[QuestionDetail] About to setup real-time listener')
    const unsubscribe = setupRealtimeListener()
    console.log('[QuestionDetail] Listener setup complete, unsubscribe function:', typeof unsubscribe)

    return () => {
      console.log('[QuestionDetail] Cleaning up listener')
      unsubscribe()
    }
  }, [questionId])

  const loadQuestion = async () => {
    try {
      setLoading(true)
      const fetchedQuestion = await getQuestion(questionId)
      if (!fetchedQuestion) {
        showToast(t('qa.detail.notFound'), 'error')
        router.push(getLocalePath('/village/tea-house'))
        return
      }
      setQuestion(fetchedQuestion)
      setAnswerCount(fetchedQuestion.answerCount)
    } catch (error) {
      console.error('Failed to load question:', error)
      showToast(t('qa.detail.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  // Real-time listener for vote count updates
  const setupRealtimeListener = () => {
    console.log('[QuestionDetail] setupRealtimeListener called, db exists:', !!db)

    // Check if Firestore is initialized
    if (!db) {
      console.warn('[QuestionDetail] Firestore not initialized, skipping real-time listener')
      return () => {} // Return empty cleanup function
    }

    const questionRef = doc(db, 'qa_questions', questionId)
    console.log('[QuestionDetail] Setting up real-time listener for:', questionId)

    const unsubscribe = onSnapshot(
      questionRef,
      (snapshot) => {
        console.log('[QuestionDetail] Snapshot received:', {
          exists: snapshot.exists(),
          data: snapshot.exists() ? snapshot.data() : null
        })

        if (snapshot.exists()) {
          const data = snapshot.data()
          console.log('[QuestionDetail] Updating question state with:', {
            upvotes: data.upvotes,
            downvotes: data.downvotes,
            answerCount: data.answerCount
          })

          setQuestion((prev) => {
            console.log('[QuestionDetail] Previous state:', prev ? {
              upvotes: prev.upvotes,
              downvotes: prev.downvotes
            } : 'null')

            // If prev is null, we're still loading - let loadQuestion() handle it
            // But if prev exists, update it with real-time data
            if (!prev) {
              console.log('[QuestionDetail] Skipping update - question not loaded yet')
              return prev
            }

            return {
              ...prev,
              upvotes: data.upvotes ?? 0,
              downvotes: data.downvotes ?? 0,
              answerCount: data.answerCount ?? 0,
              moderationStatus: data.moderationStatus ?? 'pending',
              moderationReason: data.moderationReason,
            }
          })
          setAnswerCount(data.answerCount ?? 0)
        }
      },
      (error) => {
        console.error('Real-time listener error:', error)
      }
    )

    return unsubscribe
  }

  const handleEdit = () => {
    router.push(getLocalePath(`/village/tea-house/${questionId}/edit`))
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!user) return

    console.log('[QuestionDetail] Delete button clicked', { questionId, userId: user.uid })

    try {
      setIsDeleting(true)
      console.log('[QuestionDetail] Calling deleteQuestion...')
      await deleteQuestion(questionId, user.uid)
      console.log('[QuestionDetail] Delete successful, redirecting...')
      showToast(t('qa.detail.deleted'), 'success')
      router.push(getLocalePath('/village/tea-house'))
    } catch (error: any) {
      console.error('[QuestionDetail] Delete failed:', error)
      console.error('[QuestionDetail] Error details:', {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack
      })

      // Show specific error message for questions with approved answers
      const errorMessage = error.code === 'HAS_APPROVED_ANSWERS'
        ? t('qa.detail.deleteErrorHasAnswers')
        : error.message || t('qa.detail.deleteError')

      console.log('[QuestionDetail] Showing error message:', errorMessage)
      showToast(errorMessage, 'error')
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleAnswerSuccess = () => {
    // Reload question to update answer count
    loadQuestion()
  }

  if (loading) {
    return <LoadingOverlay message={t('common.loading')} />
  }

  if (!question) {
    return null
  }

  const timeAgo = formatDistanceToNow(new Date(question.createdAt), { addSuffix: true })

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* Header with Back Button */}
      <div className={cn(
        "relative overflow-hidden",
        isLightTheme
          ? "bg-gradient-to-br from-japanese-zen via-japanese-sakura to-japanese-mizu"
          : "bg-gray-50/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700"
      )}>
        {/* Decorative Background */}
        {isLightTheme && (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-10 w-96 h-96 bg-japanese-matcha rounded-full blur-3xl" />
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(getLocalePath('/village/tea-house'))}
              className={cn(
                "mb-4",
                isLightTheme
                  ? "bg-white/30 backdrop-blur-sm text-white hover:bg-white/40"
                  : "hover:bg-gray-100 dark:hover:bg-dark-800"
              )}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center gap-3">
              <div className={cn(
                "p-3 rounded-2xl",
                isLightTheme
                  ? "bg-white/30 backdrop-blur-sm shadow-lg"
                  : "bg-primary-500/10 dark:bg-primary-900/20"
              )}>
                <MessageCircle className={cn(
                  "w-6 h-6",
                  isLightTheme
                    ? "text-white [text-shadow:_1px_1px_2px_rgb(0_0_0_/_40%)]"
                    : "text-primary-600 dark:text-primary-400"
                )} />
              </div>
              <div>
                <h1 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  isLightTheme
                    ? "text-white [text-shadow:_2px_2px_4px_rgb(0_0_0_/_40%)]"
                    : "text-gray-900 dark:text-gray-100"
                )}>
                  Question Details
                </h1>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Question Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className={cn(
            "mb-8 border-0 shadow-lg",
            "bg-white/60 dark:bg-dark-800/60",
            "backdrop-blur-xl backdrop-saturate-150"
          )}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Vote section - hidden on mobile, shown on desktop */}
                <div className="hidden sm:block flex-shrink-0">
                  <VoteButton
                    itemId={question.id}
                    itemType="question"
                    upvotes={question.upvotes}
                    downvotes={question.downvotes}
                    authorId={question.author.uid}
                  />
                </div>

                {/* Content section */}
                <div className="flex-1 min-w-0">
                  {/* Moderation badge */}
                  {question.moderationStatus !== 'approved' && (
                    <div className="mb-4">
                      <ModerationBadge status={question.moderationStatus} />
                      {question.moderationReason && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {question.moderationReason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {question.title}
                  </h1>

                  {/* Tags and difficulty */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {question.tags.map(tag => (
                      <Badge
                        key={tag}
                        className="text-xs bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      >
                        {t(`qa.tags.${tag}`)}
                      </Badge>
                    ))}
                    {question.difficulty && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          question.difficulty === 'beginner' && 'border-green-500 text-green-600 dark:text-green-400',
                          question.difficulty === 'intermediate' && 'border-yellow-500 text-yellow-600 dark:text-yellow-400',
                          question.difficulty === 'advanced' && 'border-red-500 text-red-600 dark:text-red-400'
                        )}
                      >
                        {t(`qa.difficulty.${question.difficulty}`)}
                      </Badge>
                    )}
                  </div>

                  {/* Content */}
                  <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                    <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                      {question.content}
                    </p>
                  </div>

                  {/* Stats - Desktop: single row, Mobile: two rows */}
                  <div className="mb-6 pb-6 border-b border-gray-200 dark:border-dark-700">
                    {/* Row 1: Views and Answers (always visible) */}
                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-0">
                      <span className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span className="font-medium">{question.viewCount}</span>
                        {t('qa.detail.views')}
                      </span>
                      <span className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <span className="font-medium">{answerCount}</span>
                        {answerCount === 1 ? t('qa.answer') : t('qa.answers')}
                      </span>
                    </div>

                    {/* Row 2: Vote buttons - Mobile only */}
                    <div className="sm:hidden">
                      <VoteButton
                        itemId={question.id}
                        itemType="question"
                        upvotes={question.upvotes}
                        downvotes={question.downvotes}
                        authorId={question.author.uid}
                        compact={true}
                      />
                    </div>
                  </div>

                  {/* Author info + actions */}
                  <div className="flex flex-wrap items-center gap-3 sm:justify-between">
                    <div className="flex items-center gap-3 text-sm">
                      <Avatar
                        src={question.author.avatar}
                        name={question.author.name}
                        size="sm"
                      />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {question.author.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <time dateTime={question.createdAt}>
                            {t('qa.detail.asked')} {timeAgo}
                          </time>
                          {question.updatedAt !== question.createdAt && (
                            <span className="italic">
                              ({t('qa.answerActions.edited')})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Author actions */}
                    {isAuthor && (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEdit}
                          className="hover:bg-gray-100 dark:hover:bg-dark-700"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          {t('qa.detail.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleDeleteClick}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-1" />
                          )}
                          {t('qa.detail.delete')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Answers Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <AnswerList
            question={question}
            onAnswerCountChange={setAnswerCount}
          />
        </motion.div>

        {/* Answer Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className={cn(
            "border-0 shadow-lg",
            "bg-white/60 dark:bg-dark-800/60",
            "backdrop-blur-xl backdrop-saturate-150"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {t('qa.detail.yourAnswer')}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAnswerFormCollapsed(!isAnswerFormCollapsed)}
                  className="hover:bg-gray-100 dark:hover:bg-dark-700"
                >
                  {isAnswerFormCollapsed ? (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      {t('common.show')}
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      {t('common.hide')}
                    </>
                  )}
                </Button>
              </div>

              {!isAnswerFormCollapsed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isGuest || !user ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <MessageCircle className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('qa.editor.loginToAnswer')}
                      </p>
                      <Button
                        onClick={() => router.push(getLocalePath(`/auth/login?returnUrl=/village/tea-house/${questionId}`))}
                        className="bg-primary-500 hover:bg-primary-600 text-white"
                      >
                        {t('auth.signIn')}
                      </Button>
                    </div>
                  ) : (
                    <AnswerEditor
                      questionId={questionId}
                      onSuccess={handleAnswerSuccess}
                      compact={false}
                    />
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mobile Bottom Nav Spacer */}
      <MobileNavSpacer />

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        title={t('qa.detail.deleteDialogTitle')}
        message={t('qa.detail.deleteDialogMessage')}
        confirmText={t('qa.detail.deleteConfirm')}
        cancelText={t('common.cancel')}
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
