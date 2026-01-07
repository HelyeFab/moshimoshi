'use client'

import { useState, useEffect, useRef } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  voteQuestion,
  voteAnswer,
  getUserQuestionVote,
  getUserAnswerVote,
  type VoteType
} from '@/lib/qa/voting'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'

interface VoteButtonProps {
  itemId: string
  itemType: 'question' | 'answer'
  upvotes: number
  downvotes: number
  userVote?: VoteType | null
  authorId: string // Author of the question/answer
  onVoteChange?: (newVote: VoteType | undefined) => void
  compact?: boolean // If true, shows horizontal layout for mobile
}

/**
 * VoteButton Component
 * Upvote/downvote for questions and answers
 *
 * Access: ALL logged-in users (free + premium)
 * Guests: Can see votes but cannot vote
 * Authors: CANNOT vote on their own content
 */
export default function VoteButton({
  itemId,
  itemType,
  upvotes,
  downvotes,
  userVote,
  compact = false,
  authorId,
  onVoteChange,
}: VoteButtonProps) {
  const { user, isGuest } = useAuth()
  const { t } = useI18n()
  const { showToast } = useToast()
  const [currentVote, setCurrentVote] = useState<VoteType | undefined>(userVote || undefined)
  const [isVoting, setIsVoting] = useState(false)

  // Use ref to prevent race conditions from rapid clicking
  const isVotingRef = useRef(false)

  // Local state for optimistic vote count updates
  const [localUpvotes, setLocalUpvotes] = useState(upvotes)
  const [localDownvotes, setLocalDownvotes] = useState(downvotes)

  // Update local counts when props change (e.g., from server refresh)
  useEffect(() => {
    setLocalUpvotes(upvotes)
    setLocalDownvotes(downvotes)
  }, [upvotes, downvotes])

  // Fetch existing vote if not provided (e.g., list/detail views)
  useEffect(() => {
    let cancelled = false

    const fetchExistingVote = async () => {
      if (!user || isGuest || currentVote !== undefined) return

      try {
        const existingVote =
          itemType === 'question'
            ? await getUserQuestionVote(itemId, user.uid)
            : await getUserAnswerVote(itemId, user.uid)

        if (!cancelled && existingVote) {
          setCurrentVote(existingVote)
        }
      } catch (error) {
        console.error('Failed to fetch existing vote:', error)
      }
    }

    fetchExistingVote()

    return () => {
      cancelled = true
    }
  }, [user, isGuest, currentVote, itemType, itemId])

  // Calculate net score using local counts
  const score = localUpvotes - localDownvotes

  console.log('[VoteButton] Render:', {
    itemId,
    itemType,
    upvotes,
    downvotes,
    localUpvotes,
    localDownvotes,
    score,
    currentVote
  })

  // Check if current user is the author
  const isAuthor = user?.uid === authorId

  const handleVote = async (voteType: VoteType) => {
    // Auth check
    if (!user || isGuest) {
      showToast(t('qa.voting.loginRequired'), 'error')
      return
    }

    // Prevent authors from voting on their own content
    if (isAuthor) {
      showToast(t('qa.voting.cannotVoteOwnContent'), 'error')
      return
    }

    // Prevent race conditions - check ref synchronously
    if (isVotingRef.current) {
      console.log('[VoteButton] Already voting, ignoring rapid click')
      return
    }

    console.log('[VoteButton] Voting:', { voteType, itemId, itemType })
    isVotingRef.current = true
    setIsVoting(true)

    try {
      const voteFunction = itemType === 'question' ? voteQuestion : voteAnswer
      const result = await voteFunction(itemId, user.uid, voteType)

      console.log('[VoteButton] Vote result:', result)

      if (result.success) {
        const previousVote = currentVote
        const newVote = result.currentVote

        console.log('[VoteButton] Vote update:', {
          previousVote,
          newVote,
          action: newVote === undefined ? 'REMOVED' : previousVote ? 'SWITCHED' : 'NEW'
        })

        // Optimistically update local vote counts
        if (newVote === 'upvote' && previousVote === undefined) {
          // New upvote
          console.log('[VoteButton] Action: New upvote')
          setLocalUpvotes(prev => prev + 1)
        } else if (newVote === 'downvote' && previousVote === undefined) {
          // New downvote
          console.log('[VoteButton] Action: New downvote')
          setLocalDownvotes(prev => prev + 1)
        } else if (newVote === undefined && previousVote === 'upvote') {
          // Removed upvote
          console.log('[VoteButton] Action: Removed upvote (toggle off)')
          setLocalUpvotes(prev => prev - 1)
        } else if (newVote === undefined && previousVote === 'downvote') {
          // Removed downvote
          console.log('[VoteButton] Action: Removed downvote (toggle off)')
          setLocalDownvotes(prev => prev - 1)
        } else if (newVote === 'upvote' && previousVote === 'downvote') {
          // Switched from downvote to upvote
          console.log('[VoteButton] Action: Switched from downvote to upvote')
          setLocalUpvotes(prev => prev + 1)
          setLocalDownvotes(prev => prev - 1)
        } else if (newVote === 'downvote' && previousVote === 'upvote') {
          // Switched from upvote to downvote
          console.log('[VoteButton] Action: Switched from upvote to downvote')
          setLocalUpvotes(prev => prev - 1)
          setLocalDownvotes(prev => prev + 1)
        }

        setCurrentVote(result.currentVote)
        onVoteChange?.(result.currentVote)
        console.log('[VoteButton] Final state - currentVote:', result.currentVote, 'Icon should be:', result.currentVote === 'upvote' ? 'GREEN' : result.currentVote === 'downvote' ? 'RED' : 'GRAY')
      } else {
        showToast(t('qa.voting.error'), 'error')
      }
    } catch (error) {
      console.error('Vote failed:', error)
      showToast(t('qa.voting.error'), 'error')
    } finally {
      isVotingRef.current = false
      setIsVoting(false)
    }
  }

  // Compact horizontal layout for mobile
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {/* Upvote button */}
        <button
          onClick={() => handleVote('upvote')}
          disabled={isVoting || isGuest || isAuthor}
          className={cn(
            'group p-1 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed',
            currentVote === 'upvote'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
          )}
          aria-label={t('qa.voting.upvote')}
          title={
            isGuest
              ? t('qa.voting.loginRequired')
              : isAuthor
                ? t('qa.voting.cannotVoteOwnContent')
                : t('qa.voting.upvote')
          }
        >
          <ThumbsUp
            className={cn(
              'w-4 h-4 transition-all',
              currentVote === 'upvote' ? 'fill-current' : 'group-hover:scale-110'
            )}
          />
        </button>

        {/* Score display */}
        <span
          className={cn(
            'text-sm font-semibold tabular-nums min-w-[2rem] text-center',
            score > 0 && 'text-green-600 dark:text-green-400',
            score < 0 && 'text-red-600 dark:text-red-400',
            score === 0 && 'text-muted-foreground'
          )}
        >
          {score > 0 && '+'}
          {score}
        </span>

        {/* Downvote button */}
        <button
          onClick={() => handleVote('downvote')}
          disabled={isVoting || isGuest || isAuthor}
          className={cn(
            'group p-1 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed',
            currentVote === 'downvote'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
          )}
          aria-label={t('qa.voting.downvote')}
          title={
            isGuest
              ? t('qa.voting.loginRequired')
              : isAuthor
                ? t('qa.voting.cannotVoteOwnContent')
                : t('qa.voting.downvote')
          }
        >
          <ThumbsDown
            className={cn(
              'w-4 h-4 transition-all',
              currentVote === 'downvote' ? 'fill-current' : 'group-hover:scale-110'
            )}
          />
        </button>
      </div>
    )
  }

  // Standard vertical layout for desktop
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Upvote button */}
      <button
        onClick={() => handleVote('upvote')}
        disabled={isVoting || isGuest || isAuthor}
        className={cn(
          'group p-1.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          currentVote === 'upvote'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
        )}
        aria-label={t('qa.voting.upvote')}
        title={
          isGuest
            ? t('qa.voting.loginRequired')
            : isAuthor
              ? t('qa.voting.cannotVoteOwnContent')
              : t('qa.voting.upvote')
        }
      >
        <ThumbsUp
          className={cn(
            'w-5 h-5 transition-all',
            currentVote === 'upvote' ? 'fill-current' : 'group-hover:scale-110'
          )}
        />
      </button>

      {/* Score display */}
      <span
        className={cn(
          'text-sm font-semibold tabular-nums min-w-[2.5rem] text-center',
          score > 0 && 'text-green-600 dark:text-green-400',
          score < 0 && 'text-red-600 dark:text-red-400',
          score === 0 && 'text-muted-foreground'
        )}
      >
        {score > 0 && '+'}
        {score}
      </span>

      {/* Downvote button */}
      <button
        onClick={() => handleVote('downvote')}
        disabled={isVoting || isGuest || isAuthor}
        className={cn(
          'group p-1.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          currentVote === 'downvote'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
        )}
        aria-label={t('qa.voting.downvote')}
        title={
          isGuest
            ? t('qa.voting.loginRequired')
            : isAuthor
              ? t('qa.voting.cannotVoteOwnContent')
              : t('qa.voting.downvote')
        }
      >
        <ThumbsDown
          className={cn(
            'w-5 h-5 transition-all',
            currentVote === 'downvote' ? 'fill-current' : 'group-hover:scale-110'
          )}
        />
      </button>
    </div>
  )
}
