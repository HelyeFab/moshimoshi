'use client'

import { useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import StructuredData from '@/components/StructuredData'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import type { DeckMarketDeck, DeckMarketVersion } from '@/types/deckmarket'
import { cn } from '@/lib/utils'
import { useParams } from 'next/navigation'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}

export default function DeckMarketDetailPage() {
  const { strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const deckId = params?.deckId as string

  const [deck, setDeck] = useState<DeckMarketDeck | null>(null)
  const [versions, setVersions] = useState<DeckMarketVersion[]>([])
  const [latestVersion, setLatestVersion] = useState<DeckMarketVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!deckId) return
    const loadDeck = async () => {
      try {
        const res = await fetch(`/api/deckmarket/decks/${deckId}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        setDeck(data.data.deck)
        setVersions(data.data.versions)
        setLatestVersion(data.data.latestVersion)
      } catch {
        setDeck(null)
        setVersions([])
        setLatestVersion(null)
      } finally {
        setLoading(false)
      }
    }
    void loadDeck()
  }, [deckId])

  const handleDownload = async (versionId?: string, format: 'apkg' | 'csv' = 'apkg') => {
    if (!deckId) return
    const downloadKey = `${versionId || 'latest'}-${format}`
    setDownloadingId(downloadKey)
    setDownloadError(null)
    try {
      const url = versionId
        ? `/api/deckmarket/decks/${deckId}/versions/${versionId}/download?format=${format}`
        : `/api/deckmarket/decks/${deckId}/download?format=${format}`

      const res = await fetch(url)
      if (!res.ok) throw new Error('Download failed')
      const data = await res.json()

      const anchor = document.createElement('a')
      anchor.href = data.downloadUrl
      anchor.download = data.filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    } catch (error) {
      console.error('Download error:', error)
      setDownloadError('Failed to start download. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  const latestLabel = useMemo(() => {
    if (!latestVersion) return ''
    return `${latestVersion.versionLabel || strings.deckmarket.deck.version} • ${formatBytes(
      latestVersion.sizeBytes
    )}`
  }, [latestVersion, strings.deckmarket.deck.version])

  return (
    <>
      {deck && (
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'LearningResource',
            name: deck.title,
            description: deck.description,
            url: `https://moshimoshi.app/${locale}/deckmarket/${deck.id}`,
            educationalLevel: deck.jlpt
              ? [`JLPT ${deck.jlpt}`]
              : ['Beginner', 'Intermediate', 'Advanced'],
            teaches: ['Japanese Language'],
            inLanguage: [deck.language, 'en'],
            learningResourceType: 'Flashcard Deck',
            isAccessibleForFree: true,
            provider: {
              '@type': 'Organization',
              name: 'Moshimoshi',
              url: 'https://moshimoshi.app',
            },
          }}
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={deck?.title || strings.deckmarket.title}
        description={deck?.description || strings.deckmarket.subtitle}
        backHref="/deckmarket"
      />

      <div className="container mx-auto px-4 py-8 pb-24">
        {authLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!authLoading && !user && (
          <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
            {strings.deckmarket.deck.loginRequired}
          </div>
        )}

        {!authLoading && user && loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!authLoading && user && !loading && !deck && (
          <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
            {strings.deckmarket.deck.notFound}
          </div>
        )}

        {!authLoading && user && !loading && deck && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">{deck.description}</p>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                {deck.jlpt && (
                  <span>
                    {strings.deckmarket.filters.jlpt}: {deck.jlpt}
                  </span>
                )}
                <span>
                  {strings.deckmarket.filters.language}: {deck.language.toUpperCase()}
                </span>
                <span>
                  {deck.downloadCount} {strings.deckmarket.deck.downloads.toLowerCase()}
                </span>
              </div>

              {deck.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {deck.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
              {downloadError && (
                <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm mb-4">
                  {downloadError}
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {strings.deckmarket.deck.downloadLatest}
                  </h3>
                  {latestVersion && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {latestLabel}
                    </p>
                  )}
                  {latestVersion?.createdAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {strings.deckmarket.deck.updated}: {formatDate(latestVersion.createdAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleDownload(undefined, 'apkg')}
                    disabled={downloadingId !== null || !latestVersion}
                    aria-label={`Download ${deck.title} Anki deck`}
                    className={cn(
                      'px-6 py-3 rounded-lg font-medium text-white transition-colors',
                      downloadingId !== null || !latestVersion
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-500 hover:bg-primary-600'
                    )}
                  >
                    {downloadingId === 'latest-apkg'
                      ? strings.deckmarket.deck.downloading
                      : strings.deckmarket.deck.downloadAnki}
                  </button>
                  {latestVersion?.csvR2Key && (
                    <button
                      onClick={() => handleDownload(undefined, 'csv')}
                      disabled={downloadingId !== null || !latestVersion}
                      aria-label={`Download ${deck.title} CSV`}
                      className={cn(
                        'px-6 py-3 rounded-lg font-medium transition-colors border',
                        downloadingId !== null || !latestVersion
                          ? 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-dark-700'
                          : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
                      )}
                    >
                      {downloadingId === 'latest-csv'
                        ? strings.deckmarket.deck.downloading
                        : strings.deckmarket.deck.downloadCsv}
                    </button>
                  )}
                </div>
              </div>
              {!latestVersion && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  {strings.deckmarket.admin.noVersions}
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {strings.deckmarket.deck.versions}
              </h3>

              {versions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {strings.deckmarket.admin.noVersions}
                </p>
              )}

              {versions.length > 0 && (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-700"
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {version.versionLabel || strings.deckmarket.deck.version}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatBytes(version.sizeBytes)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(version.createdAt)}
                          </span>
                        </div>
                        {version.changelog && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {version.changelog}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(version.id, 'apkg')}
                          disabled={downloadingId !== null}
                          aria-label={`Download version ${version.versionLabel || version.id} Anki`}
                          className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
                            downloadingId !== null
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-primary-500 hover:bg-primary-600'
                          )}
                        >
                          {downloadingId === `${version.id}-apkg`
                            ? strings.deckmarket.deck.downloading
                            : strings.deckmarket.deck.downloadAnki}
                        </button>
                        {version.csvR2Key && (
                          <button
                            onClick={() => handleDownload(version.id, 'csv')}
                            disabled={downloadingId !== null}
                            aria-label={`Download version ${version.versionLabel || version.id} CSV`}
                            className={cn(
                              'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                              downloadingId !== null
                                ? 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-dark-700'
                                : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
                            )}
                          >
                            {downloadingId === `${version.id}-csv`
                              ? strings.deckmarket.deck.downloading
                              : strings.deckmarket.deck.downloadCsv}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <MobileNavSpacer />
      </div>
    </>
  )
}
