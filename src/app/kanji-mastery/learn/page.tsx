'use client'

import { Suspense } from 'react'
import { LoadingOverlay } from '@/components/ui/Loading'
import LearnContent from './LearnContent'

export default function LearnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Loading learning session..." showDoshi={true} />
      </div>
    }>
      <LearnContent />
    </Suspense>
  )
}