'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/Avatar'
import Dialog from '@/components/ui/Dialog'
import { CheckCircle, Edit2, Trash2, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { cn } from '@/lib/utils'
import type { Answer, Question } from '@/types/qa'
import VoteButton from './VoteButton'
import { getAnswersForQuestion, deleteAnswer, updateAnswer } from '@/lib/qa/answers'
import { acceptAnswer } from '@/lib/qa/questions'
import { formatDistanceToNow } from 'date-fns'

interface AnswerListProps {
  question: Question
  initialAnswers?: Answer[]
  onAnswerCountChange?: (count: number) => void
}

/**
 * AnswerList Component
 * Display all approved answers for a question
 * Question author can accept answers
 */
export default function AnswerList({ question, initialAnswers = [], onAnswerCountChange }: AnswerListProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [answers, setAnswers] = useState<Answer[]>(initialAnswers)
  const [loading, setLoading] = useState(!initialAnswers.length)
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [answerToDelete, setAnswerToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Track avatar updates for current user's answers
  const [avatarKey, setAvatarKey] = useState(Date.now())
  const [currentUserAvatar, setCurrentUserAvatar] = useState(user?.photoURL)

  // Check if current user is question author
  const isQuestionAuthor = user?.uid === question.author.uid

  // Load answers
  useEffect(() => {
    loadAnswers()
  }, [question.id])

  // Listen for profile photo updates
  useEffect(() => {
    const handlePhotoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ photoURL: string }>
      // Update avatar for current user's answers
      setCurrentUserAvatar(customEvent.detail.photoURL)
      setAvatarKey(Date.now())
    }

    window.addEventListener('profile-photo-updated', handlePhotoUpdate)
    return () => window.removeEventListener('profile-photo-updated', handlePhotoUpdate)
  }, [])

  const loadAnswers = async () => {
    try {
      setLoading(true)
      const fetchedAnswers = await getAnswersForQuestion(question.id, 'accepted')
      setAnswers(fetchedAnswers)
      onAnswerCountChange?.(fetchedAnswers.length)
    } catch (error) {
      console.error('Failed to load answers:', error)
      showToast(t('qa.answerActions.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptAnswer = async (answerId: string) => {
    if (!isQuestionAuthor || !user) return

    try {
      await acceptAnswer(question.id, answerId, user.uid)
      showToast(t('qa.answerActions.accepted'), 'success')
      loadAnswers() // Reload to update accepted status
    } catch (error: any) {
      showToast(error.message || t('qa.answerActions.acceptError'), 'error')
    }
  }

  const handleDeleteClick = (answerId: string) => {
    setAnswerToDelete(answerId)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!user || !answerToDelete) return

    try {
      setIsDeleting(true)
      await deleteAnswer(answerToDelete, user.uid)
      showToast(t('qa.answerActions.deleted'), 'success')
      setAnswers(answers.filter(a => a.id !== answerToDelete))
      onAnswerCountChange?.(answers.length - 1)
      setShowDeleteDialog(false)
      setAnswerToDelete(null)
    } catch (error: any) {
      showToast(error.message || t('qa.answerActions.deleteError'), 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const startEditing = (answer: Answer) => {
    setEditingAnswerId(answer.id)
    setEditContent(answer.content)
  }

  const cancelEditing = () => {
    setEditingAnswerId(null)
    setEditContent('')
  }

  const handleUpdateAnswer = async (answerId: string) => {
    if (!user) return

    try {
      await updateAnswer(answerId, editContent, user.uid)
      showToast(t('qa.answerActions.updated'), 'success')
      cancelEditing()
      loadAnswers()
    } catch (error: any) {
      showToast(error.message || t('qa.answerActions.updateError'), 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 dark:text-primary-400" />
      </div>
    )
  }

  if (answers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">{t('qa.answerActions.noAnswersYet')}</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">{t('qa.answerActions.beTheFirst')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        {answers.length} {answers.length === 1 ? t('qa.answer') : t('qa.answers')}
      </h2>

      {/* Accepted answer first */}
      {answers
        .sort((a, b) => {
          if (a.accepted && !b.accepted) return -1
          if (!a.accepted && b.accepted) return 1
          return b.upvotes - a.upvotes // Then by votes
        })
        .map(answer => {
          const isEditing = editingAnswerId === answer.id
          const isAuthor = user?.uid === answer.author.uid
          const timeAgo = formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true })

          return (
            <Card
              key={answer.id}
              className={cn(
                "border-0 shadow-lg",
                "bg-white/60 dark:bg-dark-800/60",
                "backdrop-blur-xl backdrop-saturate-150",
                answer.accepted && 'ring-2 ring-green-500 dark:ring-green-600'
              )}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Vote section - hidden on mobile, shown on desktop */}
                  <div className="hidden sm:block flex-shrink-0">
                    <VoteButton
                      itemId={answer.id}
                      itemType="answer"
                      upvotes={answer.upvotes}
                      downvotes={answer.downvotes}
                      authorId={answer.author.uid}
                      // TODO: userVote={userVote}
                    />
                  </div>

                  {/* Content section */}
                  <div className="flex-1 min-w-0">
                    {/* Accepted badge */}
                    {answer.accepted && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 mb-3">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        {t('qa.answerActions.acceptedAnswer')}
                      </Badge>
                    )}

                    {/* Answer content */}
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={6}
                          className={cn(
                            'w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-dark-600',
                            'bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600'
                          )}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUpdateAnswer(answer.id)} className="bg-primary-500 hover:bg-primary-600 text-white">
                            {t('qa.answerActions.saveEdit')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditing} className="hover:bg-gray-100 dark:hover:bg-dark-700">
                            {t('qa.answerActions.cancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                        <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{answer.content}</p>
                      </div>
                    )}

                    {/* Mobile vote buttons - horizontal layout */}
                    <div className="sm:hidden flex justify-end mb-3">
                      <VoteButton
                        itemId={answer.id}
                        itemType="answer"
                        upvotes={answer.upvotes}
                        downvotes={answer.downvotes}
                        authorId={answer.author.uid}
                        compact={true}
                      />
                    </div>

                    {/* Author info + actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-dark-700">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Avatar
                          key={isAuthor ? avatarKey : `static-${answer.id}`}
                          src={isAuthor ? (currentUserAvatar ?? undefined) : (answer.author.avatar ?? undefined)}
                          name={answer.author.name}
                          size="xs"
                        />
                        <span className="font-medium text-gray-700 dark:text-gray-300">{answer.author.name}</span>
                        <span>•</span>
                        <time dateTime={answer.createdAt}>{timeAgo}</time>
                        {answer.updatedAt !== answer.createdAt && (
                          <>
                            <span>•</span>
                            <span className="italic">{t('qa.answerActions.edited')}</span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {/* Author can edit/delete */}
                        {isAuthor && !isEditing && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(answer)}
                              className="hover:bg-gray-100 dark:hover:bg-dark-700"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteClick(answer.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}

                        {/* Question author can accept */}
                        {isQuestionAuthor && !answer.accepted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcceptAnswer(answer.id)}
                            className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {t('qa.answerActions.acceptAnswer')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        title={t('qa.answerActions.deleteDialogTitle')}
        message={t('qa.answerActions.deleteDialogMessage')}
        confirmText={t('qa.answerActions.deleteDialogConfirm')}
        cancelText={t('common.cancel')}
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
