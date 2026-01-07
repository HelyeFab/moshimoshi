'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { cn } from '@/lib/utils'
import { createQuestion, updateQuestion } from '@/lib/qa/questions'
import type { CreateQuestionInput } from '@/types/qa'
import ModerationBadge from './ModerationBadge'

interface QuestionEditorProps {
  questionId?: string // If provided, component is in edit mode
  initialData?: {
    title: string
    content: string
    tags: string[]
    difficulty?: 'beginner' | 'intermediate' | 'advanced'
    relatedArticleId?: string
  }
  onSuccess?: (questionId: string) => void
  onCancel?: () => void
}

// Available topic tags
const AVAILABLE_TAGS = [
  'grammar',
  'vocabulary',
  'kanji',
  'pronunciation',
  'particles',
  'verb-conjugation',
  'culture',
  'jlpt',
  'translation',
  'reading',
  'listening',
  'writing',
  'other'
]

/**
 * QuestionEditor Component
 * Create or edit questions in Q&A forum
 *
 * Access: ALL logged-in users (free + premium)
 */
export default function QuestionEditor({
  questionId,
  initialData,
  onSuccess,
  onCancel
}: QuestionEditorProps) {
  const { t } = useI18n()
  const { user, isGuest } = useAuth()
  const { showToast } = useToast()

  const isEditMode = !!questionId

  const [title, setTitle] = useState(initialData?.title || '')
  const [content, setContent] = useState(initialData?.content || '')
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || [])
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | undefined>(initialData?.difficulty)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [moderationStatus, setModerationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)

  // Auto-save to localStorage (only in create mode)
  useEffect(() => {
    if (!isEditMode) {
      const draft = { title, content, selectedTags, difficulty }
      localStorage.setItem('qa_question_draft', JSON.stringify(draft))
    }
  }, [title, content, selectedTags, difficulty, isEditMode])

  // Restore draft on mount (only in create mode)
  useEffect(() => {
    if (!isEditMode) {
      const saved = localStorage.getItem('qa_question_draft')
      if (saved) {
        try {
          const draft = JSON.parse(saved)
          setTitle(draft.title || '')
          setContent(draft.content || '')
          setSelectedTags(draft.selectedTags || [])
          setDifficulty(draft.difficulty)
        } catch (error) {
          console.error('Failed to restore draft:', error)
        }
      }
    }
  }, [isEditMode])

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleSubmit = async () => {
    // Validation
    if (!user || isGuest) {
      showToast(t('qa.editor.loginRequired'), 'error')
      return
    }

    if (!title.trim() || title.trim().length < 10) {
      showToast(t('qa.editor.titleTooShort'), 'error')
      return
    }

    if (!content.trim() || content.trim().length < 20) {
      showToast(t('qa.editor.contentTooShort'), 'error')
      return
    }

    if (selectedTags.length === 0) {
      showToast(t('qa.editor.selectTags'), 'error')
      return
    }

    setIsSubmitting(true)

    try {
      const input: CreateQuestionInput = {
        title: title.trim(),
        content: content.trim(),
        tags: selectedTags,
        difficulty,
      }

      if (isEditMode && questionId) {
        // Update existing question
        await updateQuestion(questionId, input, user.uid)

        showToast(t('qa.edit.questionUpdated'), 'success')

        // Call onSuccess callback
        if (onSuccess) {
          onSuccess(questionId)
        }
      } else {
        // Create new question
        const result = await createQuestion(input, {
          uid: user.uid,
          name: user.displayName || user.email || 'Anonymous',
          email: user.email || '',
          avatar: user.photoURL || undefined,
        })

        // Clear draft
        localStorage.removeItem('qa_question_draft')

        // Show moderation status
        setModerationStatus(result.moderationStatus)

        showToast(
          result.moderationStatus === 'pending'
            ? t('qa.editor.submittedForReview')
            : t('qa.editor.questionPosted'),
          'success'
        )

        // Reset form and call onSuccess
        setTimeout(() => {
          setTitle('')
          setContent('')
          setSelectedTags([])
          setDifficulty(undefined)
          setModerationStatus(null)
          onSuccess?.(result.questionId)
        }, 2000)
      }
    } catch (error: any) {
      console.error('Failed to submit question:', error)
      showToast(error.message || t('qa.editor.error'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show success state if moderation pending/approved
  if (moderationStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <ModerationBadge status={moderationStatus} />
        <p className="text-center text-muted-foreground max-w-md">
          {moderationStatus === 'pending'
            ? t('qa.editor.moderationPending')
            : t('qa.editor.questionLive')}
        </p>
        <Button onClick={() => setModerationStatus(null)}>
          {t('qa.editor.askAnother')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="question-title" className="text-sm font-medium text-card-foreground">
          {t('qa.editor.title')} <span className="text-red-500">*</span>
        </label>
        <Input
          id="question-title"
          placeholder={t('qa.editor.titlePlaceholder')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={200}
          className="text-lg"
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          {title.length}/200 {t('qa.editor.characters')}
        </p>
      </div>

      {/* Content/Details */}
      <div className="space-y-2">
        <label htmlFor="question-content" className="text-sm font-medium text-card-foreground">
          {t('qa.editor.details')} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="question-content"
          placeholder={t('qa.editor.detailsPlaceholder')}
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={8}
          maxLength={5000}
          disabled={isSubmitting}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-md border border-input bg-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[200px]'
          )}
        />
        <p className="text-xs text-muted-foreground">
          {content.length}/5000 {t('qa.editor.characters')}
        </p>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-card-foreground">
          {t('qa.editor.topics')} <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_TAGS.map(tag => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary'
              )}
              onClick={() => !isSubmitting && toggleTag(tag)}
            >
              {t(`qa.tags.${tag}`)}
              {selectedTags.includes(tag) && (
                <X className="w-3 h-3 ml-1" />
              )}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedTags.length} {t('qa.editor.tagsSelected')}
        </p>
      </div>

      {/* Difficulty (Optional) */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-card-foreground">
          {t('qa.editor.difficulty')} <span className="text-muted-foreground">({t('qa.editor.optional')})</span>
        </label>
        <div className="flex gap-2">
          {(['beginner', 'intermediate', 'advanced'] as const).map(level => (
            <Badge
              key={level}
              variant={difficulty === level ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer',
                difficulty === level && 'bg-primary text-primary-foreground'
              )}
              onClick={() => !isSubmitting && setDifficulty(difficulty === level ? undefined : level)}
            >
              {t(`qa.difficulty.${level}`)}
            </Badge>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t('qa.editor.cancel')}
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim() || !content.trim() || selectedTags.length === 0}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('qa.editor.posting')}
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {isEditMode ? t('qa.editor.updateQuestion') : t('qa.editor.postQuestion')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
