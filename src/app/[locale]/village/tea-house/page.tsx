'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Users, MessageCircle, Sparkles } from 'lucide-react'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/lib/theme/ThemeContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import QuestionCard from '@/components/qa/QuestionCard'
import { getQuestions } from '@/lib/qa/questions'
import type { Question, QuestionSortBy } from '@/types/qa'
import { cn } from '@/lib/utils'
import TeaHouseWelcomeModal from '@/components/qa/TeaHouseWelcomeModal'
import FloatingGuidelinesButton from '@/components/qa/FloatingGuidelinesButton'
import { useTeaHouseGuidelines } from '@/hooks/useTeaHouseGuidelines'

/**
 * Q&A Forum Main Page - Tea House (茶屋)
 * A beautiful community space for learners to gather, ask questions, and share wisdom
 *
 * Access: Public (guests can view, must log in to post)
 */
export default function QAForumPage() {
  const { t, strings } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { user, isGuest } = useAuth()
  const { resolvedTheme } = useTheme()
  const router = useRouter()

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<QuestionSortBy>('recent')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const isLightTheme = resolvedTheme === 'light'

  // Tea House guidelines management
  const { shouldShowWelcome, markWelcomeShown } = useTeaHouseGuidelines()
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  // Show welcome modal on first visit
  useEffect(() => {
    if (shouldShowWelcome) {
      setShowWelcomeModal(true)
    }
  }, [shouldShowWelcome])

  const handleWelcomeClose = () => {
    setShowWelcomeModal(false)
    markWelcomeShown()
  }

  // Load questions
  useEffect(() => {
    loadQuestions()
  }, [sortBy, selectedTags])

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const fetchedQuestions = await getQuestions(
        { tags: selectedTags.length > 0 ? selectedTags : undefined },
        sortBy,
        20
      )
      setQuestions(fetchedQuestions)
    } catch (error) {
      console.error('Failed to load questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAskQuestion = () => {
    if (isGuest || !user) {
      // Redirect to login with return URL
      router.push(getLocalePath('/auth/login?returnUrl=/village/tea-house/ask'))
    } else {
      router.push(getLocalePath('/village/tea-house/ask'))
    }
  }

  // Calculate community stats
  const totalQuestions = questions.length
  const answeredQuestions = questions.filter(q => q.answerCount > 0).length
  const activeMembers = new Set(questions.map(q => q.author.uid)).size

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* Hero Header - Japanese Tea House Aesthetic */}
      <div className={cn(
        "relative overflow-hidden",
        isLightTheme
          ? "bg-gradient-to-br from-japanese-zen via-japanese-sakura to-japanese-mizu"
          : "bg-gray-50/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700"
      )}>
        {/* Decorative Background Pattern */}
        {isLightTheme && (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-10 w-96 h-96 bg-japanese-matcha rounded-full blur-3xl" />
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 md:py-16 relative">
          {/* Title Section with CTA Button */}
          <div className="flex items-start justify-between gap-4 mb-3 sm:mb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <div className={cn(
                "p-2 sm:p-3 rounded-xl sm:rounded-2xl",
                isLightTheme
                  ? "bg-white/30 backdrop-blur-sm shadow-lg"
                  : "bg-primary-500/10 dark:bg-primary-900/20"
              )}>
                <Users className={cn(
                  "w-6 h-6 sm:w-8 sm:h-8",
                  isLightTheme
                    ? "text-white [text-shadow:_1px_1px_2px_rgb(0_0_0_/_40%)]"
                    : "text-primary-600 dark:text-primary-400"
                )} />
              </div>
              <div>
                <h1 className={cn(
                  "text-2xl sm:text-4xl md:text-5xl font-bold",
                  isLightTheme
                    ? "text-white [text-shadow:_2px_2px_4px_rgb(0_0_0_/_40%)]"
                    : "bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent"
                )}>
                  {strings.qa.title}
                </h1>
                <p className={cn(
                  "text-base sm:text-2xl font-light mt-0.5 sm:mt-1",
                  isLightTheme
                    ? "text-white/95 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]"
                    : "text-gray-500 dark:text-gray-400"
                )}>
                  茶屋
                </p>
              </div>
            </motion.div>

            {/* CTA Button - Speech Bubble Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Button
                onClick={handleAskQuestion}
                size="icon"
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110",
                  "backdrop-blur-xl backdrop-saturate-150 text-white",
                  isLightTheme
                    ? "bg-white/30 hover:bg-white/40 border-2 border-white/50"
                    : "bg-primary-500/20 hover:bg-primary-500/30 border-2 border-primary-400/30 dark:border-primary-300/30"
                )}
                aria-label={strings.qa.askQuestion}
              >
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </motion.div>
          </div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={cn(
              "text-sm sm:text-lg max-w-2xl mb-3 sm:mb-4",
              isLightTheme
                ? "text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_30%)]"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            {strings.qa.subtitle}
          </motion.p>

          {/* Guidelines Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-3 sm:mb-4"
          >
            <FloatingGuidelinesButton />
          </motion.div>

          {/* Community Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap gap-2 sm:gap-4"
          >
            <div className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-4 sm:py-2 rounded-full",
              isLightTheme
                ? "bg-white/30 backdrop-blur-sm shadow-lg"
                : "bg-gray-100 dark:bg-dark-800"
            )}>
              <MessageCircle className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4",
                isLightTheme ? "text-white" : "text-primary-600 dark:text-primary-400"
              )} />
              <span className={cn(
                "text-xs sm:text-sm font-semibold",
                isLightTheme ? "text-white" : "text-gray-700 dark:text-gray-300"
              )}>
                {totalQuestions} Questions
              </span>
            </div>
            <div className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-4 sm:py-2 rounded-full",
              isLightTheme
                ? "bg-white/30 backdrop-blur-sm shadow-lg"
                : "bg-gray-100 dark:bg-dark-800"
            )}>
              <Sparkles className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4",
                isLightTheme ? "text-white" : "text-green-600 dark:text-green-400"
              )} />
              <span className={cn(
                "text-xs sm:text-sm font-semibold",
                isLightTheme ? "text-white" : "text-gray-700 dark:text-gray-300"
              )}>
                {answeredQuestions} Answered
              </span>
            </div>
            <div className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-4 sm:py-2 rounded-full",
              isLightTheme
                ? "bg-white/30 backdrop-blur-sm shadow-lg"
                : "bg-gray-100 dark:bg-dark-800"
            )}>
              <Users className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4",
                isLightTheme ? "text-white" : "text-purple-600 dark:text-purple-400"
              )} />
              <span className={cn(
                "text-xs sm:text-sm font-semibold",
                isLightTheme ? "text-white" : "text-gray-700 dark:text-gray-300"
              )}>
                {activeMembers} Active Members
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters/Sort Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-6"
        >
          <Card className={cn(
            "border-0 shadow-lg",
            "bg-white/60 dark:bg-dark-800/60",
            "backdrop-blur-xl backdrop-saturate-150"
          )}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Browse Questions
                </h2>
                <Search className="w-5 h-5 text-gray-400" />
              </div>

              <div className="flex flex-wrap gap-2">
                {(['recent', 'popular', 'unanswered'] as QuestionSortBy[]).map(sort => (
                  <Badge
                    key={sort}
                    variant={sortBy === sort ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer px-4 py-2 text-sm font-medium transition-all hover:scale-105',
                      sortBy === sort
                        ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    )}
                    onClick={() => setSortBy(sort)}
                  >
                    {strings.qa.tabs[sort]}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Questions List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingOverlay message={strings.common.loading} />
            </motion.div>
          ) : questions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className={cn(
                "border-0 shadow-lg",
                "bg-white/60 dark:bg-dark-800/60",
                "backdrop-blur-xl backdrop-saturate-150"
              )}>
                <CardContent className="py-20 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <MessageCircle className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                      {strings.qa.empty?.noQuestions || 'No questions yet'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                      {strings.qa.empty?.beFirst || 'Be the first to ask a question!'}
                    </p>
                    <Button
                      onClick={handleAskQuestion}
                      size="lg"
                      className="bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      {strings.qa.askQuestion}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <QuestionCard question={question} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Nav Spacer */}

      {/* Welcome Modal - First visit */}
      <TeaHouseWelcomeModal isOpen={showWelcomeModal} onClose={handleWelcomeClose} />
    </div>
  )
}
