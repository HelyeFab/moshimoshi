'use client'

import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { GrammarPointDetail } from '@/components/grammar/GrammarPointDetail'
import { GrammarPoint } from '@/lib/grammar/types'
import { useAuth } from '@/hooks/useAuth'

interface GrammarDetailPageClientProps {
  point: GrammarPoint
  locale: string
  level?: string
  labels: {
    explanation: string
    structure: string
    examples: string
    related: string
    practice: string
    example: string
    breakdown: string
    note: string
    pattern: string
    componentExamples: string
    showFuriganaLabel: string
    showFuriganaDescription: string
  }
}

export default function GrammarDetailPageClient({
  point,
  locale,
  level = 'n5',
  labels,
}: GrammarDetailPageClientProps) {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={point.title.ja}
        description={point.title.en}
        backHref={level === 'n5' ? '/learn/grammar' : `/learn/grammar/${level}`}
        actions={(
          <span className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 dark:bg-primary-500 text-white text-sm font-medium">
            {point.jlptLevel}
          </span>
        )}
      />

      <GrammarPointDetail point={point} locale={locale} level={level} labels={labels} />

      <MobileNavSpacer />
    </div>
  )
}
