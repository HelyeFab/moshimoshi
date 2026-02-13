'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  FileText,
  Calendar,
  Tag,
  Globe,
  Layers,
  Clock,
  Sparkles,
  ChevronDown,
  BookOpen,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import type { DeckMarketNote, DeckMarketNoteVersion } from '@/types/deckmarket'
import { cn } from '@/lib/utils'

/* ── Helpers ──────────────────────────────────────────────────────── */

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

const NOTE_GRADIENT = 'bg-gradient-to-br from-indigo-400 to-blue-700'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35 },
  }),
}

/* ── Component ────────────────────────────────────────────────────── */

export default function DeckMarketNoteDetailPage() {
  const { strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const params = useParams()
  const noteId = params?.noteId as string

  const [note, setNote] = useState<DeckMarketNote | null>(null)
  const [versions, setVersions] = useState<DeckMarketNoteVersion[]>([])
  const [latestVersion, setLatestVersion] = useState<DeckMarketNoteVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!noteId) return
    const loadNote = async () => {
      try {
        const res = await fetch(`/api/deckmarket/notes/${noteId}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        setNote(data.data.note)
        setVersions(data.data.versions)
        setLatestVersion(data.data.latestVersion)
      } catch {
        setNote(null)
        setVersions([])
        setLatestVersion(null)
      } finally {
        setLoading(false)
      }
    }
    void loadNote()
  }, [noteId])

  useEffect(() => {
    if (!noteId || !user || !latestVersion) return
    const loadPreview = async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const res = await fetch(`/api/deckmarket/notes/${noteId}/preview`)
        if (!res.ok) throw new Error('Preview unavailable')
        const data = await res.json()
        setPreviewUrl(data.previewUrl || null)
      } catch (error) {
        console.error('Preview load error:', error)
        setPreviewUrl(null)
        setPreviewError(strings.deckmarket.notes.previewUnavailable)
      } finally {
        setPreviewLoading(false)
      }
    }
    void loadPreview()
  }, [noteId, user, latestVersion?.id, strings.deckmarket.notes.previewUnavailable])

  const latestLabel = useMemo(() => {
    if (!latestVersion) return ''
    return `${latestVersion.versionLabel || strings.deckmarket.deck.version} • ${formatBytes(
      latestVersion.pdfSizeBytes
    )}`
  }, [latestVersion, strings.deckmarket.deck.version])

  const handleDownload = async () => {
    if (!noteId) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch(`/api/deckmarket/notes/${noteId}/download`)
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
      setDownloadError(strings.deckmarket.notes.downloadFailed)
    } finally {
      setDownloading(false)
    }
  }

  /** Append #toolbar=0 to hide the browser PDF toolbar. */
  const cleanPreviewUrl = previewUrl
    ? `${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={note?.title || strings.deckmarket.notes.title}
        description={note?.description || strings.deckmarket.notes.subtitle}
        backHref="/deckmarket"
        showFeatureReminderToggle={false}
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

        {!authLoading && user && !loading && !note && (
          <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
            {strings.deckmarket.notes.notFound}
          </div>
        )}

        {!authLoading && user && !loading && note && (
          <motion.div
            className="space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* ── Section 1: Hero Banner ─────────────────────────── */}
            <motion.div variants={itemVariants} className="rounded-2xl overflow-hidden shadow-lg">
              <div className={cn('relative px-6 py-10 sm:px-10 sm:py-14', NOTE_GRADIENT)}>
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />
                <div className="relative z-10">
                  <h1
                    className="text-3xl sm:text-4xl font-bold text-white mb-3"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
                  >
                    {note.title}
                  </h1>
                  <p className="text-white/80 text-sm sm:text-base max-w-2xl mb-6">
                    {note.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/20 backdrop-blur-sm text-white border border-white/20">
                      <Globe className="h-3.5 w-3.5" />
                      {note.language.toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/20 backdrop-blur-sm text-white border border-white/20">
                      <Download className="h-3.5 w-3.5" />
                      {note.downloadCount} {strings.deckmarket.deck.downloads.toLowerCase()}
                    </span>
                  </div>

                  {note.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-white/15 backdrop-blur-sm text-white border border-white/20"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── Section 2: Download CTA ────────────────────────── */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl border border-white/40 dark:border-dark-700/60 shadow-lg p-6"
            >
              {downloadError && (
                <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm mb-4">
                  {downloadError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div
                  className={cn(
                    'hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md',
                    NOTE_GRADIENT
                  )}
                >
                  <BookOpen className="h-7 w-7" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {strings.deckmarket.notes.downloadPdf}
                  </h3>
                  {latestVersion && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {latestLabel}
                      </span>
                      {latestVersion.createdAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(latestVersion.createdAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDownload}
                  disabled={downloading || !latestVersion}
                  className={cn(
                    'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white shadow-md transition-colors shrink-0',
                    downloading || !latestVersion
                      ? 'bg-gray-400 cursor-not-allowed'
                      : cn(NOTE_GRADIENT, 'hover:shadow-lg')
                  )}
                >
                  <Download className="h-4 w-4" />
                  {downloading
                    ? strings.deckmarket.deck.downloading
                    : strings.deckmarket.notes.downloadPdf}
                </motion.button>
              </div>

              {!latestVersion && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  {strings.deckmarket.admin.noNoteVersions}
                </p>
              )}
            </motion.div>

            {/* ── Section 3: PDF Preview ─────────────────────────── */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl border border-white/40 dark:border-dark-700/60 shadow-lg p-6"
            >
              <button
                type="button"
                onClick={() => setPreviewOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {strings.deckmarket.notes.previewTitle}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                    {strings.deckmarket.notes.previewSubtitle}
                  </span>
                </div>
                <motion.span
                  animate={{ rotate: previewOpen ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {previewOpen && (
                  <motion.div
                    key="preview-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pt-5">
                      {previewLoading && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <div className="h-4 w-4 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
                          {strings.deckmarket.notes.previewLoading}
                        </div>
                      )}

                      {!previewLoading && previewError && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {previewError}
                        </div>
                      )}

                      {!previewLoading && !previewError && cleanPreviewUrl && (
                        <div className="h-[700px] w-full rounded-xl overflow-hidden border border-gray-200 dark:border-dark-700 relative">
                          <iframe
                            title={strings.deckmarket.notes.previewTitle}
                            src={cleanPreviewUrl}
                            className="absolute inset-0 w-[calc(100%+20px)] h-full"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── Section 4: Version Timeline ────────────────────── */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl border border-white/40 dark:border-dark-700/60 shadow-lg p-6"
            >
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-primary-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {strings.deckmarket.deck.versions}
                </h3>
              </div>

              {versions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {strings.deckmarket.admin.noNoteVersions}
                </p>
              )}

              {versions.length > 0 && (
                <div className="relative">
                  <div className={cn('absolute left-[11px] top-3 bottom-3 w-0.5', NOTE_GRADIENT)} />

                  <div className="space-y-4">
                    {versions.map((version, idx) => {
                      const isLatest = idx === 0
                      return (
                        <motion.div
                          key={version.id}
                          custom={idx}
                          variants={cardVariants}
                          initial="hidden"
                          animate="visible"
                          className="relative pl-9"
                        >
                          <div className="absolute left-0 top-4">
                            {isLatest ? (
                              <span className="flex h-6 w-6 items-center justify-center">
                                <span className={cn('h-4 w-4 rounded-full shadow-md', NOTE_GRADIENT)} />
                                <span
                                  className={cn(
                                    'absolute h-6 w-6 rounded-full opacity-25 animate-ping',
                                    NOTE_GRADIENT
                                  )}
                                />
                              </span>
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center">
                                <span className="h-3 w-3 rounded-full border-2 border-gray-300 dark:border-dark-500 bg-white dark:bg-dark-800" />
                              </span>
                            )}
                          </div>

                          <div
                            className={cn(
                              'rounded-xl p-4 border transition-colors',
                              isLatest
                                ? 'bg-white/90 dark:bg-dark-700/80 border-primary-200 dark:border-primary-800 shadow-md'
                                : 'bg-white/60 dark:bg-dark-700/40 border-gray-100 dark:border-dark-600'
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {version.versionLabel || strings.deckmarket.deck.version}
                              </span>
                              {isLatest && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                                  <Sparkles className="h-3 w-3" />
                                  Latest
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="inline-flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                {formatBytes(version.pdfSizeBytes)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(version.createdAt)}
                              </span>
                            </div>
                            {version.changelog && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                                {version.changelog}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </div>

      <MobileNavSpacer />
    </div>
  )
}
