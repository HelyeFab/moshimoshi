'use client'

import { useState } from 'react'
import { GrammarPoint } from '@/lib/grammar/types'
import SettingToggle from '@/components/ui/SettingToggle'
import FuriganaText from './FuriganaText'
import { ExampleSentence } from './ExampleSentence'
import { GrammarStructure } from './GrammarStructure'
import { RelatedPoints } from './RelatedPoints'
import PracticeLinkPrefetch from './PracticeLinkPrefetch'

interface GrammarPointDetailProps {
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

export function GrammarPointDetail({
  point,
  locale,
  level = 'n5',
  labels,
}: GrammarPointDetailProps) {
  const [showFurigana, setShowFurigana] = useState(true)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              <FuriganaText
                text={point.title.ja}
                showFurigana={showFurigana}
                className="leading-tight"
              />
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-1">
              {point.title.romaji}
            </p>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              {point.title.en}
            </p>
          </div>
          <span className="ml-4 inline-flex items-center px-3 py-1 rounded-lg bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-sm font-medium">
            {point.jlptLevel}
          </span>
        </div>
        <SettingToggle
          label={labels.showFuriganaLabel}
          description={labels.showFuriganaDescription}
          enabled={showFurigana}
          onChange={setShowFurigana}
          className="pt-2"
        />
      </div>

      <section className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {labels.explanation}
        </h2>
        <div className="prose max-w-none">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {point.explanation.en}
          </p>
        </div>
      </section>

      <section className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {labels.structure}
        </h2>
        <GrammarStructure
          structure={point.structure}
          showFurigana={showFurigana}
          labels={{
            pattern: labels.pattern,
            examples: labels.componentExamples,
          }}
        />
      </section>

      <section className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {labels.examples}
        </h2>
        <div className="space-y-6">
          {point.examples.map((example, idx) => (
            <ExampleSentence
              key={idx}
              example={example}
              index={idx + 1}
              showFurigana={showFurigana}
              labels={{
                example: labels.example,
                breakdown: labels.breakdown,
                note: labels.note,
              }}
            />
          ))}
        </div>
      </section>

      {point.relatedPoints.length > 0 && (
        <section className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {labels.related}
          </h2>
          <RelatedPoints pointIds={point.relatedPoints} locale={locale} level={level} />
        </section>
      )}

      <div className="text-center mt-8">
        <PracticeLinkPrefetch
          href={`/${locale}/learn/grammar/${point.id}/practice`}
          label={`${labels.practice} →`}
          pointId={point.id}
          level={level}
          className="inline-flex items-center px-8 py-4 rounded-lg bg-primary-600 text-white text-lg font-semibold hover:bg-primary-700 transition-colors shadow-lg"
        />
      </div>
    </div>
  )
}
