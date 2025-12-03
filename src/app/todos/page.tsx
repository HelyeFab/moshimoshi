// TODO Feature Page
// Main page for the todo list feature

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TodoList } from '@/components/todos/TodoList'
// Navigation is now global via NavigationWrapper in root layout
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import { useSubscription } from '@/hooks/useSubscription'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import LearningPageHeader from '@/components/learn/LearningPageHeader'

// Features are DISABLED by default unless explicitly set to 'true'
const isTodosEnabled = process.env.NEXT_PUBLIC_FEATURE_TODOS === 'true'

export default function TodosPage() {
  const { t } = useI18n()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { isPremium, isLoading: subLoading } = useSubscription()
  const router = useRouter()

  // Redirect if Todos feature is disabled
  useEffect(() => {
    if (!isTodosEnabled) {
      router.replace('/dashboard')
    }
  }, [router])

  // Don't render if feature is disabled (prevents flash before redirect)
  if (!isTodosEnabled) {
    return null
  }

  // Show loading while auth is being checked
  if (authLoading || subLoading) {
    return <LoadingOverlay />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-soft-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Navigation is now global - rendered in root layout */}

      <div className="container mx-auto px-4 py-6">
        {/* Todo list component */}
        <TodoList />
      </div>
    </div>
  )
}