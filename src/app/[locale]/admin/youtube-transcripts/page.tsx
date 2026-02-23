'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { formatDistanceToNow } from 'date-fns'
import {
  Search,
  Trash2,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Eye,
  ChevronUp,
  ChevronDown,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Hash,
} from 'lucide-react'
import { YOUTUBE_TRANSCRIPTS_COPY as COPY } from './constants'

// --- Types ---

interface TranscriptListItem {
  videoId: string
  contentId: string
  videoTitle: string | null
  thumbnailUrl: string | null
  videoUrl: string | null
  segmentCount: number
  hasTranslations: boolean
  isOffloaded: boolean
  isFormatted: boolean
  formattingModel: string | null
  language: string
  accessCount: number
  createdAt: string | null
  lastAccessed: string | null
  wordStatus: string
  wordCount: number
  precomputeChunkTotal: number | null
  precomputeChunkCompleted: number | null
}

interface TranscriptDetail {
  videoId: string
  contentId: string
  videoTitle: string | null
  thumbnailUrl: string | null
  videoUrl: string | null
  language: string
  accessCount: number
  createdAt: string | null
  lastAccessed: string | null
  isOffloaded: boolean
  isFormatted: boolean
  formattingModel: string | null
  formattedAt: string | null
  storagePath: string | null
  segmentCount: number
  hasTranslations: boolean
  segments: { text: string; startTime: number; endTime: number; translation: string | null }[]
  wordStatus: string
  wordCount: number
  precomputeChunkTotal: number | null
  precomputeChunkCompleted: number | null
  wordStartedAt: string | null
  wordCompletedAt: string | null
}

type SortField = 'videoId' | 'videoTitle' | 'segmentCount' | 'wordStatus' | 'lastAccessed' | 'createdAt'

// --- Helpers ---

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}


function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// --- Status Badge ---

function WordStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    complete: {
      label: COPY.status.complete,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    generating: {
      label: COPY.status.generating,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    failed: {
      label: COPY.status.failed,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      icon: <XCircle className="w-3 h-3" />,
    },
    pending: {
      label: COPY.status.pending,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: <Clock className="w-3 h-3" />,
    },
    none: {
      label: COPY.status.none,
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
      icon: null,
    },
  }

  const c = config[status] || config.none

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

// --- Stat Card ---

function StatCard({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string
  value: number
  subtitle?: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function YouTubeTranscriptsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  // Data
  const [transcripts, setTranscripts] = useState<TranscriptListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search & sort
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('lastAccessed')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Detail modal
  const [detailVideoId, setDetailVideoId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<TranscriptDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<{ videoIds: string[]; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // --- Data Fetching ---

  const fetchTranscripts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/youtube-transcripts', { credentials: 'include' })
      if (!res.ok) throw new Error(COPY.errors.fetchFailed)
      const data = await res.json()
      setTranscripts(data.transcripts || [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : COPY.errors.fetchFailed
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchTranscripts()
  }, [user, fetchTranscripts])

  // --- Computed ---

  const stats = useMemo(() => {
    const total = transcripts.length
    const segments = transcripts.reduce((sum, t) => sum + t.segmentCount, 0)
    const wordComplete = transcripts.filter(t => t.wordStatus === 'complete').length
    const wordFailed = transcripts.filter(t => t.wordStatus === 'failed').length
    const wordProcessing = transcripts.filter(t => t.wordStatus === 'generating').length
    const noTitle = transcripts.filter(t => !t.videoTitle).length
    return { total, segments, wordComplete, wordFailed, wordProcessing, noTitle }
  }, [transcripts])

  const filteredAndSorted = useMemo(() => {
    let items = transcripts

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        t =>
          t.videoId.toLowerCase().includes(q) ||
          (t.videoTitle?.toLowerCase().includes(q) ?? false)
      )
    }

    items = [...items].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortField) {
        case 'videoId':
          aVal = a.videoId
          bVal = b.videoId
          break
        case 'videoTitle':
          aVal = (a.videoTitle || '').toLowerCase()
          bVal = (b.videoTitle || '').toLowerCase()
          break
        case 'segmentCount':
          aVal = a.segmentCount
          bVal = b.segmentCount
          break
        case 'wordStatus':
          aVal = a.wordStatus
          bVal = b.wordStatus
          break
        case 'lastAccessed':
          aVal = a.lastAccessed || ''
          bVal = b.lastAccessed || ''
          break
        case 'createdAt':
          aVal = a.createdAt || ''
          bVal = b.createdAt || ''
          break
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return items
  }, [transcripts, searchQuery, sortField, sortDirection])

  const allVisibleSelected = filteredAndSorted.length > 0 && filteredAndSorted.every(t => selectedIds.has(t.videoId))

  // --- Handlers ---

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const toggleSelect = (videoId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(t => t.videoId)))
    }
  }

  const handleViewDetail = async (videoId: string) => {
    setDetailVideoId(videoId)
    setDetailLoading(true)
    setDetailData(null)
    try {
      const res = await fetch(`/api/admin/youtube-transcripts/${videoId}`, { credentials: 'include' })
      if (!res.ok) throw new Error(COPY.errors.detailFailed)
      const data = await res.json()
      setDetailData(data.transcript)
    } catch {
      showToast(COPY.errors.detailFailed, 'error')
      setDetailVideoId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/youtube-transcripts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoIds: deleteTarget.videoIds }),
      })
      if (!res.ok) throw new Error(COPY.errors.deleteFailed)

      const count = deleteTarget.videoIds.length
      showToast(count === 1 ? COPY.success.deleted : COPY.success.bulkDeleted(count), 'success')

      // Remove from local state
      setTranscripts(prev => prev.filter(t => !deleteTarget.videoIds.includes(t.videoId)))
      setSelectedIds(prev => {
        const next = new Set(prev)
        deleteTarget.videoIds.forEach(id => next.delete(id))
        return next
      })
      setDeleteTarget(null)

      // Close detail modal if the deleted transcript was being viewed
      if (detailVideoId && deleteTarget.videoIds.includes(detailVideoId)) {
        setDetailVideoId(null)
        setDetailData(null)
      }
    } catch {
      showToast(COPY.errors.deleteFailed, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleResetWordGeneration = async (videoId: string) => {
    try {
      const res = await fetch(`/api/admin/youtube-transcripts/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'resetWordGeneration' }),
      })
      if (!res.ok) throw new Error(COPY.errors.resetFailed)

      showToast(COPY.success.resetComplete, 'success')

      // Update local state
      setTranscripts(prev =>
        prev.map(t =>
          t.videoId === videoId
            ? { ...t, wordStatus: 'pending', precomputeChunkCompleted: 0 }
            : t
        )
      )

      // Update detail if open
      if (detailData?.videoId === videoId) {
        setDetailData(prev => prev ? { ...prev, wordStatus: 'pending', precomputeChunkCompleted: 0 } : prev)
      }
    } catch {
      showToast(COPY.errors.resetFailed, 'error')
    }
  }

  // --- Sort Header ---

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  )

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </p>
          <button onClick={fetchTranscripts} className="mt-2 text-sm text-red-700 dark:text-red-300 underline">
            {COPY.actions.refresh}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{COPY.page.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{COPY.page.subtitle}</p>
        </div>
        <button
          onClick={fetchTranscripts}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {COPY.actions.refresh}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={COPY.overview.totalTranscripts}
          value={stats.total}
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          label={COPY.overview.totalSegments}
          value={stats.segments}
          icon={<Hash className="w-5 h-5" />}
        />
        <StatCard
          label={COPY.overview.wordExplanations}
          value={stats.wordComplete}
          subtitle={`${stats.wordFailed} ${COPY.overview.failed}, ${stats.wordProcessing} ${COPY.overview.processing}`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <StatCard
          label={COPY.overview.needsAttention}
          value={stats.noTitle}
          subtitle={COPY.overview.noTitle}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* Search & Bulk Actions */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={COPY.table.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {COPY.table.selectedCount(selectedIds.size)}
              </span>
              <button
                onClick={() =>
                  setDeleteTarget({
                    videoIds: Array.from(selectedIds),
                    label: COPY.modals.bulkDeleteMessage(selectedIds.size),
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {COPY.actions.bulkDelete}
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-700/50">
              <tr>
                <th className="pl-4 pr-2 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-2 py-3 text-left">
                  <SortHeader field="videoId">{COPY.table.videoId}</SortHeader>
                </th>
                <th className="px-2 py-3 text-left">
                  <SortHeader field="videoTitle">{COPY.table.title}</SortHeader>
                </th>
                <th className="px-2 py-3 text-center">
                  <SortHeader field="segmentCount">{COPY.table.segments}</SortHeader>
                </th>
                <th className="px-2 py-3 text-center">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {COPY.table.formatted}
                  </span>
                </th>
                <th className="px-2 py-3 text-center">
                  <SortHeader field="wordStatus">{COPY.table.wordStatus}</SortHeader>
                </th>
                <th className="px-2 py-3 text-left hidden xl:table-cell">
                  <SortHeader field="lastAccessed">{COPY.table.lastAccessed}</SortHeader>
                </th>
                <th className="pl-2 pr-4 py-3 text-right">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {COPY.table.actions}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? COPY.table.noResultsSearch : COPY.table.noResults}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map(t => (
                  <tr
                    key={t.videoId}
                    className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                  >
                    <td className="pl-4 pr-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.videoId)}
                        onChange={() => toggleSelect(t.videoId)}
                        className="rounded border-gray-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => handleViewDetail(t.videoId)}
                        className="text-sm font-mono text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {t.videoId}
                      </button>
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[180px] truncate">
                      {t.videoTitle || (
                        <span className="text-gray-400 dark:text-gray-500 italic">{COPY.table.unknown}</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-sm text-center text-gray-900 dark:text-gray-100">
                      {t.isOffloaded ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">{COPY.table.offloaded}</span>
                      ) : (
                        t.segmentCount
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={t.isFormatted ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                        {t.isFormatted ? COPY.status.yes : COPY.status.no}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <WordStatusBadge status={t.wordStatus} />
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400 hidden xl:table-cell whitespace-nowrap">
                      {t.lastAccessed
                        ? formatDistanceToNow(new Date(t.lastAccessed), { addSuffix: true })
                        : '-'}
                    </td>
                    <td className="pl-2 pr-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetail(t.videoId)}
                          title={COPY.actions.viewDetails}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={`https://www.youtube.com/watch?v=${t.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={COPY.actions.openOnYouTube}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {(t.wordStatus === 'failed' || t.wordStatus === 'generating') && (
                          <button
                            onClick={() => handleResetWordGeneration(t.videoId)}
                            title={COPY.actions.resetWordGeneration}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:text-yellow-400 dark:hover:bg-yellow-900/20 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              videoIds: [t.videoId],
                              label: COPY.modals.deleteMessage,
                            })
                          }
                          title={COPY.actions.delete}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailVideoId && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => { setDetailVideoId(null); setDetailData(null) }}
        >
          <div
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {COPY.modals.detailTitle}
              </h2>
              <button
                onClick={() => { setDetailVideoId(null); setDetailData(null) }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                {COPY.modals.close}
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : detailData ? (
              <div className="p-6 space-y-6">
                {/* Metadata */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {COPY.modals.metadata}
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.videoId}</div>
                    <div className="font-mono text-gray-900 dark:text-gray-100">{detailData.videoId}</div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.title}</div>
                    <div className="text-gray-900 dark:text-gray-100">{detailData.videoTitle || '-'}</div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.language}</div>
                    <div className="text-gray-900 dark:text-gray-100">{detailData.language}</div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.segments}</div>
                    <div className="text-gray-900 dark:text-gray-100">{detailData.segmentCount}</div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.translations}</div>
                    <div className="text-gray-900 dark:text-gray-100">
                      {detailData.hasTranslations ? COPY.status.yes : COPY.status.no}
                    </div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.accessCount}</div>
                    <div className="text-gray-900 dark:text-gray-100">{detailData.accessCount}</div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.createdAt}</div>
                    <div className="text-gray-900 dark:text-gray-100">
                      {detailData.createdAt
                        ? formatDistanceToNow(new Date(detailData.createdAt), { addSuffix: true })
                        : '-'}
                    </div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.aiProcessed}</div>
                    <div className="text-gray-900 dark:text-gray-100">
                      <span className={detailData.isFormatted ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                        {detailData.isFormatted ? COPY.status.yes : COPY.status.no}
                      </span>
                    </div>

                    {detailData.formattingModel && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{COPY.detail.formattingModel}</div>
                        <div className="text-gray-900 dark:text-gray-100">{detailData.formattingModel}</div>
                      </>
                    )}

                    {detailData.formattedAt && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{COPY.detail.formattedAt}</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          {formatDistanceToNow(new Date(detailData.formattedAt), { addSuffix: true })}
                        </div>
                      </>
                    )}

                    {detailData.storagePath && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{COPY.detail.storagePath}</div>
                        <div className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                          {detailData.storagePath}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Word Explanation Progress */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {COPY.modals.wordProgress}
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.wordStatus}</div>
                    <div><WordStatusBadge status={detailData.wordStatus} /></div>

                    <div className="text-gray-500 dark:text-gray-400">{COPY.detail.wordCount}</div>
                    <div className="text-gray-900 dark:text-gray-100">{detailData.wordCount}</div>

                    {detailData.precomputeChunkTotal !== null && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{COPY.detail.chunksCompleted}</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          {detailData.precomputeChunkCompleted ?? 0} / {detailData.precomputeChunkTotal}
                        </div>
                      </>
                    )}

                    {detailData.wordStartedAt && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{COPY.detail.startedAt}</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          {formatDistanceToNow(new Date(detailData.wordStartedAt), { addSuffix: true })}
                        </div>
                      </>
                    )}

                    {detailData.wordCompletedAt && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{COPY.detail.completedAt}</div>
                        <div className="text-gray-900 dark:text-gray-100">
                          {formatDistanceToNow(new Date(detailData.wordCompletedAt), { addSuffix: true })}
                        </div>
                      </>
                    )}
                  </div>

                  {(detailData.wordStatus === 'failed' || detailData.wordStatus === 'generating') && (
                    <button
                      onClick={() => handleResetWordGeneration(detailData.videoId)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {COPY.actions.resetWordGeneration}
                    </button>
                  )}
                </div>

                {/* Segment Preview */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {COPY.modals.segmentPreview}
                  </h3>
                  {detailData.segments.length > 0 ? (
                    <div className="space-y-1 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 p-3">
                      {detailData.segments.map((seg, i) => (
                        <div key={i} className="flex gap-3 text-sm py-1">
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-xs shrink-0 pt-0.5">
                            {formatTime(seg.startTime)}
                          </span>
                          <div>
                            <p className="text-gray-900 dark:text-gray-100">{seg.text}</p>
                            {seg.translation && (
                              <p className="text-gray-500 dark:text-gray-400 text-xs">{seg.translation}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">{COPY.modals.noSegments}</p>
                  )}
                </div>

                {/* Detail Actions */}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-dark-700">
                  <a
                    href={`https://www.youtube.com/watch?v=${detailData.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {COPY.actions.openOnYouTube}
                  </a>
                  <button
                    onClick={() => {
                      setDetailVideoId(null)
                      setDetailData(null)
                      setDeleteTarget({
                        videoIds: [detailData.videoId],
                        label: COPY.modals.deleteMessage,
                      })
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {COPY.actions.delete}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {deleteTarget.videoIds.length === 1
                  ? COPY.modals.deleteTitle
                  : COPY.modals.bulkDeleteTitle}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {deleteTarget.label}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors disabled:opacity-50"
              >
                {COPY.modals.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {COPY.modals.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
