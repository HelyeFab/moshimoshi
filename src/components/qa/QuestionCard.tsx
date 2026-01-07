'use client'

import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/Avatar'
import { MessageCircle, CheckCircle } from 'lucide-react'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import type { Question } from '@/types/qa'
import VoteButton from './VoteButton'
import { formatDistanceToNow } from 'date-fns'

interface QuestionCardProps {
  question: Question
  userVote?: 'upvote' | 'downvote' | null
  compact?: boolean
}

/**
 * QuestionCard Component
 * Displays a question in list view
 */
export default function QuestionCard({ question, userVote, compact = false }: QuestionCardProps) {
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()

  const questionUrl = getLocalePath(`/village/tea-house/${question.id}`)

  // Format relative time
  const timeAgo = formatDistanceToNow(new Date(question.createdAt), { addSuffix: true })

  return (
    <Card className={cn(
      "border-0 shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]",
      "bg-white/60 dark:bg-dark-800/60",
      "backdrop-blur-xl backdrop-saturate-150"
    )}>
      <CardContent className={cn('p-4', !compact && 'sm:p-6')}>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Vote section - hidden on mobile, shown on desktop */}
          <div className="hidden sm:block flex-shrink-0">
            <VoteButton
              itemId={question.id}
              itemType="question"
              upvotes={question.upvotes}
              downvotes={question.downvotes}
              authorId={question.author.uid}
              userVote={userVote}
            />
          </div>

          {/* Content section */}
          <div className="flex-1 min-w-0">
            {/* Title + Accepted Answer Badge */}
            <div className="flex items-start gap-2 mb-2">
              <Link
                href={questionUrl}
                className="group flex-1"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                  {question.title}
                </h3>
              </Link>

              {question.hasAcceptedAnswer && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex-shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  {t('qa.questionCard.hasAnswer')}
                </Badge>
              )}
            </div>

            {/* Excerpt/Content Preview */}
            {!compact && (
              <Link href={questionUrl}>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                  {question.content.substring(0, 200)}
                  {question.content.length > 200 && '...'}
                </p>
              </Link>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {question.tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/30 cursor-pointer transition-colors"
                >
                  {tag}
                </Badge>
              ))}

              {question.difficulty && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    question.difficulty === 'beginner' && 'border-green-500 text-green-600 dark:text-green-400',
                    question.difficulty === 'intermediate' && 'border-yellow-500 text-yellow-600 dark:text-yellow-400',
                    question.difficulty === 'advanced' && 'border-red-500 text-red-600 dark:text-red-400'
                  )}
                >
                  {t(`qa.difficulty.${question.difficulty}`)}
                </Badge>
              )}
            </div>

            {/* Metadata footer */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              {/* Author info */}
              <div className="flex items-center gap-2">
                <Avatar
                  src={question.author.avatar}
                  name={question.author.name}
                  size="xs"
                  className="flex-shrink-0"
                />
                <span className="truncate max-w-[150px] font-medium">{question.author.name}</span>
                <span className="hidden sm:inline">•</span>
                <time dateTime={question.createdAt} className="hidden sm:inline flex-shrink-0">
                  {timeAgo}
                </time>
              </div>

              {/* Mobile vote buttons - horizontal layout */}
              <div className="sm:hidden">
                <VoteButton
                  itemId={question.id}
                  itemType="question"
                  upvotes={question.upvotes}
                  downvotes={question.downvotes}
                  authorId={question.author.uid}
                  userVote={userVote}
                  compact={true}
                />
              </div>

              {/* Answer count */}
              <div className="hidden sm:flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-4 h-4" />
                <span className="font-semibold">
                  {question.answerCount}
                </span>
                <span>
                  {question.answerCount === 1 ? t('qa.answer') : t('qa.answers')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
