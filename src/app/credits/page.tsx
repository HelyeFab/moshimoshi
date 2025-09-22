'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/layout/Navbar'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { LoadingOverlay } from '@/components/ui/Loading'

interface CreditItem {
  name: string
  description: string
  url?: string
  license?: string
  icon?: string
}

export default function CreditsPage() {
  const { strings } = useI18n()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading for smooth transition
    setTimeout(() => setLoading(false), 300)
  }, [])

  // Define credits data
  const dataSourceCredits: CreditItem[] = [
    {
      name: 'JMdict',
      description: strings.credits?.sources?.jmdict || 'Japanese-Multilingual Dictionary project',
      url: 'https://www.edrdg.org/jmdict/j_jmdict.html',
      license: 'Creative Commons',
      icon: '📚'
    },
    {
      name: 'WaniKani',
      description: strings.credits?.sources?.wanikani || 'Kanji learning methodology and mnemonics inspiration',
      url: 'https://www.wanikani.com',
      icon: '🦀'
    },
    {
      name: 'KanjiCanvas',
      description: strings.credits?.sources?.kanjicanvas || 'Stroke order diagrams and kanji drawing components',
      url: 'https://github.com/asdfjkl/kanjicanvas',
      license: 'MIT License',
      icon: '✏️'
    },
    {
      name: 'Flaticon',
      description: strings.credits?.sources?.flaticon || 'Icons and visual assets',
      url: 'https://www.flaticon.com',
      license: 'Flaticon License',
      icon: '🎨'
    }
  ]

  const libraryCredits: CreditItem[] = [
    {
      name: 'Next.js',
      description: strings.credits?.libraries?.nextjs || 'React framework for production',
      url: 'https://nextjs.org',
      license: 'MIT',
      icon: '⚡'
    },
    {
      name: 'React',
      description: strings.credits?.libraries?.react || 'JavaScript library for user interfaces',
      url: 'https://react.dev',
      license: 'MIT',
      icon: '⚛️'
    },
    {
      name: 'TypeScript',
      description: strings.credits?.libraries?.typescript || 'JavaScript with syntax for types',
      url: 'https://www.typescriptlang.org',
      license: 'Apache-2.0',
      icon: '📘'
    },
    {
      name: 'Firebase',
      description: strings.credits?.libraries?.firebase || 'Authentication, database, and storage',
      url: 'https://firebase.google.com',
      icon: '🔥'
    },
    {
      name: 'Tailwind CSS',
      description: strings.credits?.libraries?.tailwind || 'Utility-first CSS framework',
      url: 'https://tailwindcss.com',
      license: 'MIT',
      icon: '🎨'
    },
    {
      name: 'OpenAI',
      description: strings.credits?.libraries?.openai || 'AI-powered content generation and analysis',
      url: 'https://openai.com',
      icon: '🤖'
    },
    {
      name: 'Redis',
      description: strings.credits?.libraries?.redis || 'In-memory data structure store',
      url: 'https://redis.io',
      license: 'BSD',
      icon: '💾'
    },
    {
      name: 'Stripe',
      description: strings.credits?.libraries?.stripe || 'Payment processing and subscriptions',
      url: 'https://stripe.com',
      icon: '💳'
    }
  ]

  const specialThanks: CreditItem[] = [
    {
      name: strings.credits?.thanks?.community?.name || 'The Japanese Learning Community',
      description: strings.credits?.thanks?.community?.description || 'For continuous feedback and support',
      icon: '🌸'
    },
    {
      name: strings.credits?.thanks?.contributors?.name || 'Open Source Contributors',
      description: strings.credits?.thanks?.contributors?.description || 'For making amazing tools freely available',
      icon: '💝'
    },
    {
      name: strings.credits?.thanks?.users?.name || 'Our Users',
      description: strings.credits?.thanks?.users?.description || 'For trusting us with your learning journey',
      icon: '🎌'
    }
  ]

  if (loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={strings.credits?.loading || "Loading credits..."}
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  const renderCreditSection = (title: string, items: CreditItem[], icon: string) => (
    <div className="mb-10">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        {title}
      </h2>
      <div className="grid gap-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="p-4 rounded-lg bg-soft-white dark:bg-dark-900/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              {item.icon && (
                <span className="text-2xl mt-1">{item.icon}</span>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                    >
                      {item.name} ↗
                    </a>
                  ) : (
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {item.name}
                    </h3>
                  )}
                  {item.license && (
                    <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                      {item.license}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-primary-100/10 to-primary-200/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800 transition-colors duration-500">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Navbar */}
      <Navbar
        user={user}
        showUserMenu={true}
        backLink={{
          href: '/settings',
          label: strings.credits?.backToSettings || '← Back to Settings'
        }}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Title with Doshi */}
        <div className="mb-10 text-center">
          <div className="flex justify-center mb-4">
            <DoshiMascot
              size="large"
              variant="animated"
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {strings.credits?.title || 'Credits & Acknowledgments'}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {strings.credits?.subtitle || 'Moshimoshi is built on the shoulders of giants. We gratefully acknowledge the following projects and communities.'}
          </p>
        </div>

        {/* Data Sources Section */}
        {renderCreditSection(
          strings.credits?.sections?.dataSources || 'Data Sources & Content',
          dataSourceCredits,
          '📊'
        )}

        {/* Libraries Section */}
        {renderCreditSection(
          strings.credits?.sections?.libraries || 'Libraries & Technologies',
          libraryCredits,
          '🛠️'
        )}

        {/* Special Thanks Section */}
        {renderCreditSection(
          strings.credits?.sections?.specialThanks || 'Special Thanks',
          specialThanks,
          '🙏'
        )}

        {/* License Notice */}
        <div className="mt-10 p-6 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <span>📜</span>
            {strings.credits?.license?.title || 'License & Usage'}
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {strings.credits?.license?.description || 'Moshimoshi respects the licenses of all third-party projects. We use these resources in compliance with their respective licenses. For detailed license information, please refer to each project\'s official documentation.'}
          </p>
        </div>

        {/* Footer Message */}
        <div className="mt-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {strings.credits?.footer?.madeWith || 'Made with'} ❤️ {strings.credits?.footer?.forLearners || 'for Japanese learners worldwide'}
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            {strings.credits?.footer?.contact || 'Have a suggestion? Contact us!'} →
          </Link>
        </div>
      </main>
    </div>
  )
}