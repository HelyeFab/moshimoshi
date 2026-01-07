'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/lib/theme/ThemeContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast/ToastContext'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import QuestionEditor from '@/components/qa/QuestionEditor'
import { getQuestion } from '@/lib/qa/questions'
import type { Question } from '@/types/qa'
import { cn } from '@/lib/utils'

/**
 * Edit Question Page
 * Edit existing questions
 *
 * Access: Question author only
 */
export default function EditQuestionPage() {
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { user, isGuest, loading: authLoading } = useAuth()
  const { resolvedTheme } = useTheme()
  const { showToast } = useToast()
  const router = useRouter()
  const params = useParams()
  const questionId = params.id as string

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)

  const isLightTheme = resolvedTheme === 'light'

  // Load question
  useEffect(() => {
    loadQuestion()
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

      // Check if user is the author
      if (!user || fetchedQuestion.author.uid !== user.uid) {
        showToast(t('qa.edit.unauthorized'), 'error')
        router.push(getLocalePath(`/village/tea-house/${questionId}`))
        return
      }

      setQuestion(fetchedQuestion)
    } catch (error) {
      console.error('Failed to load question:', error)
      showToast(t('qa.detail.loadError'), 'error')
      router.push(getLocalePath('/village/tea-house'))
    } finally {
      setLoading(false)
    }
  }

  // Redirect guests to login
  useEffect(() => {
    if (!authLoading && (isGuest || !user)) {
      router.push(getLocalePath(`/auth/login?returnUrl=/village/tea-house/${questionId}/edit`))
    }
  }, [user, isGuest, authLoading, router, getLocalePath, questionId])

  // Show loading while checking auth or loading question
  if (authLoading || loading || isGuest || !user || !question) {
    return <LoadingOverlay message={t('common.loading')} />
  }

  const handleSuccess = () => {
    // Redirect back to question detail after successful edit
    router.push(getLocalePath(`/village/tea-house/${questionId}`))
  }

  const handleCancel = () => {
    router.push(getLocalePath(`/village/tea-house/${questionId}`))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* Header */}
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
                <Edit3 className={cn(
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
                  {t('qa.edit.editQuestion')}
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  isLightTheme
                    ? "text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_30%)]"
                    : "text-gray-600 dark:text-gray-400"
                )}>
                  {t('qa.edit.editQuestionSubtitle')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className={cn(
            "border-0 shadow-lg",
            "bg-white/60 dark:bg-dark-800/60",
            "backdrop-blur-xl backdrop-saturate-150"
          )}>
            <CardHeader className="border-b border-gray-200 dark:border-dark-700">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('qa.editor.writeYourQuestion')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <QuestionEditor
                questionId={questionId}
                initialData={{
                  title: question.title,
                  content: question.content,
                  tags: question.tags,
                  difficulty: question.difficulty,
                  relatedArticleId: question.relatedArticleId,
                }}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mobile Bottom Nav Spacer */}
      <MobileNavSpacer />
    </div>
  )
}
