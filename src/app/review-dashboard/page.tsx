'use client'

import Navbar from '@/components/layout/Navbar'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import ReviewDashboard from './ReviewDashboard'

export default function ReviewDashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800 transition-colors duration-500">
      <Navbar user={user} showUserMenu={true} />
      <LearningPageHeader
        title={t('reviewDashboard.title', 'Review Dashboard')}
        description={t('reviewDashboard.description', 'Track your learning progress and review schedule')}
      />
      <ReviewDashboard />
    </div>
  )
}