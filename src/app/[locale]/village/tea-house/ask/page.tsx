'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MessageSquarePlus, Lightbulb } from 'lucide-react'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/lib/theme/ThemeContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import Navbar from '@/components/layout/Navbar'
import QuestionEditor from '@/components/qa/QuestionEditor'
import { cn } from '@/lib/utils'
import TeaHouseAcknowledgmentModal from '@/components/qa/TeaHouseAcknowledgmentModal'
import { useTeaHouseGuidelines } from '@/hooks/useTeaHouseGuidelines'

/**
 * Ask Question Page
 * Create new questions in Q&A forum
 *
 * Access: ALL logged-in users (free + premium)
 * Guests are redirected to login
 */
export default function AskQuestionPage() {
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { user, isGuest, loading } = useAuth()
  const { resolvedTheme } = useTheme()
  const router = useRouter()

  const isLightTheme = resolvedTheme === 'light'

  // Tea House guidelines acknowledgment
  const { hasAcknowledged, loading: guidelinesLoading } = useTeaHouseGuidelines()
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false)
  const [canPost, setCanPost] = useState(false)

  // Redirect guests to login
  useEffect(() => {
    if (!loading && (isGuest || !user)) {
      router.push(getLocalePath('/auth/login?returnUrl=/village/tea-house/ask'))
    }
  }, [user, isGuest, loading, router, getLocalePath])

  // Check if user needs to acknowledge guidelines
  useEffect(() => {
    if (!guidelinesLoading && !isGuest && user) {
      if (hasAcknowledged === false) {
        // User hasn't acknowledged yet - show modal
        setShowAcknowledgmentModal(true)
        setCanPost(false)
      } else if (hasAcknowledged === true) {
        // User has acknowledged - allow posting
        setCanPost(true)
      }
    }
  }, [hasAcknowledged, guidelinesLoading, user, isGuest])

  const handleAcknowledged = () => {
    setShowAcknowledgmentModal(false)
    setCanPost(true)
  }

  const handleAcknowledgmentClose = () => {
    // If they close without acknowledging, go back to tea house
    router.push(getLocalePath('/village/tea-house'))
  }

  // Show loading while checking auth or guidelines
  if (loading || guidelinesLoading || isGuest || !user) {
    return <LoadingOverlay message={t('common.loading')} />
  }

  const handleSuccess = (questionId: string) => {
    // Redirect to the question detail page after successful post
    router.push(getLocalePath(`/village/tea-house/${questionId}`))
  }

  const handleCancel = () => {
    router.push(getLocalePath('/village/tea-house'))
  }

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

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
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
                <MessageSquarePlus className={cn(
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
                  {t('qa.askQuestion')}
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  isLightTheme
                    ? "text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_30%)]"
                    : "text-gray-600 dark:text-gray-400"
                )}>
                  {t('qa.editor.askQuestionSubtitle')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Question Editor Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className={cn(
            "border-0 shadow-lg mb-6",
            "bg-white/60 dark:bg-dark-800/60",
            "backdrop-blur-xl backdrop-saturate-150"
          )}>
            <CardHeader className="border-b border-gray-200 dark:border-dark-700">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('qa.editor.writeYourQuestion')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <QuestionEditor onSuccess={handleSuccess} onCancel={handleCancel} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Helpful Tips Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className={cn(
            "border-0 shadow-lg",
            "bg-primary-50/60 dark:bg-primary-900/10",
            "backdrop-blur-xl backdrop-saturate-150"
          )}>
            <CardHeader className="border-b border-primary-200 dark:border-primary-800/30">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                  <Lightbulb className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('qa.editor.tips')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-semibold">
                    1
                  </span>
                  <span className="pt-0.5">{t('qa.editor.tip1')}</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-semibold">
                    2
                  </span>
                  <span className="pt-0.5">{t('qa.editor.tip2')}</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-semibold">
                    3
                  </span>
                  <span className="pt-0.5">{t('qa.editor.tip3')}</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-semibold">
                    4
                  </span>
                  <span className="pt-0.5">{t('qa.editor.tip4')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mobile Bottom Nav Spacer */}

      {/* Guidelines Acknowledgment Modal - Required before first post */}
      <TeaHouseAcknowledgmentModal
        isOpen={showAcknowledgmentModal}
        onClose={handleAcknowledgmentClose}
        onAcknowledged={handleAcknowledged}
      />
    </div>
  )
}
