'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { cn } from '@/lib/utils'
import { createAnswer } from '@/lib/qa/answers'
import ModerationBadge from './ModerationBadge'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore as db } from '@/lib/firebase/client'

interface AnswerEditorProps {
  questionId: string
  onSuccess?: (answerId: string) => void
  onCancel?: () => void
  compact?: boolean
}

/**
 * AnswerEditor Component
 * Post answers to questions
 *
 * Access: ALL logged-in users (free + premium)
 */
export default function AnswerEditor({ questionId, onSuccess, onCancel, compact = false }: AnswerEditorProps) {
  const { t } = useI18n()
  const { user, isGuest } = useAuth()
  const { showToast } = useToast()

  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [moderationStatus, setModerationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [moderationReason, setModerationReason] = useState<string | null>(null)
  const [submittedAnswerId, setSubmittedAnswerId] = useState<string | null>(null)

  // Listen for moderation status changes
  useEffect(() => {
    if (!submittedAnswerId || !db) return

    const answerRef = doc(db, 'qa_answers', submittedAnswerId)
    const unsubscribe = onSnapshot(answerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        setModerationStatus(data.moderationStatus)
        setModerationReason(data.moderationReason || null)

        // Show notification for rejection
        if (data.moderationStatus === 'rejected' && moderationStatus !== 'rejected') {
          showToast(
            `Answer rejected: ${data.moderationReason || 'Content does not meet community guidelines'}`,
            'error'
          )
        }
      }
    })

    return () => unsubscribe()
  }, [submittedAnswerId, moderationStatus])

  const handleSubmit = async () => {
    // Validation
    if (!user || isGuest) {
      showToast(t('qa.editor.loginRequired'), 'error')
      return
    }

    if (!content.trim()) {
      showToast(t('qa.editor.answerTooShort'), 'error')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createAnswer(
        {
          questionId,
          content: content.trim(),
        },
        {
          uid: user.uid,
          name: user.displayName || user.email || 'Anonymous',
          email: user.email || '',
          avatar: user.photoURL || undefined,
        }
      )

      setModerationStatus(result.moderationStatus)
      setSubmittedAnswerId(result.answerId)

      showToast(
        result.moderationStatus === 'pending'
          ? t('qa.editor.answerSubmittedForReview')
          : t('qa.editor.answerPosted'),
        'success'
      )

      // Don't reset form immediately - wait for moderation result
      // Form will reset when user dismisses the success/rejection message
    } catch (error: any) {
      console.error('Failed to post answer:', error)
      showToast(error.message || t('qa.editor.error'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show success/rejection state
  if (moderationStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <ModerationBadge status={moderationStatus} />
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 max-w-md">
          {moderationStatus === 'pending' && t('qa.editor.answerModerationPending')}
          {moderationStatus === 'approved' && t('qa.editor.answerLive')}
          {moderationStatus === 'rejected' && (
            <>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                Your answer was not approved
              </span>
              <br />
              <span className="text-xs mt-2 block">
                {moderationReason || 'Content does not meet community guidelines'}
              </span>
            </>
          )}
        </p>
        {moderationStatus === 'rejected' && (
          <Button
            onClick={() => {
              setModerationStatus(null)
              setModerationReason(null)
              setSubmittedAnswerId(null)
              setContent('')
            }}
            size="sm"
            className="bg-primary-500 hover:bg-primary-600 text-white"
          >
            Try Again
          </Button>
        )}
        {moderationStatus === 'approved' && (
          <Button
            onClick={() => {
              setModerationStatus(null)
              setModerationReason(null)
              setSubmittedAnswerId(null)
              setContent('')
              onSuccess?.(submittedAnswerId!)
            }}
            size="sm"
            className="bg-primary-500 hover:bg-primary-600 text-white"
          >
            Post Another Answer
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('qa.editor.yourAnswer')}</h3>
      )}

      {/* Content */}
      <div className="space-y-2">
        <textarea
          placeholder={t('qa.editor.answerPlaceholder')}
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={compact ? 4 : 6}
          maxLength={5000}
          disabled={isSubmitting}
          className={cn(
            'w-full px-4 py-3 text-sm rounded-lg',
            'border border-gray-300 dark:border-dark-600',
            'bg-white dark:bg-dark-900',
            'text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600',
            'disabled:opacity-50 disabled:cursor-not-allowed resize-y',
            'transition-all'
          )}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {content.length}/5000 {t('qa.editor.characters')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            size="sm"
            className="hover:bg-gray-100 dark:hover:bg-dark-700"
          >
            {t('qa.editor.cancel')}
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || content.trim().length === 0}
          size={compact ? 'sm' : 'default'}
          className="bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('qa.editor.posting')}
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {t('qa.editor.postAnswer')}
            </>
          )}
        </Button>
      </div>

      {/* Login prompt for guests */}
      {(isGuest || !user) && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('qa.editor.loginToAnswer')}
        </p>
      )}
    </div>
  )
}
