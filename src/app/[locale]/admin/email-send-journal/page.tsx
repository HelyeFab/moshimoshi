'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'

type JournalStatus = 'all' | 'sent' | 'failed'

interface JournalItem {
  id: string
  campaignId: string | null
  template: string | null
  templateId: string | null
  notificationType: string
  status: 'sent' | 'failed'
  sentAt: string | null
  sentDateKey: string | null
  retentionDays: number | null
  source: string | null
  recipient: {
    uid: string | null
    emailHash: string | null
    emailMasked: string | null
    emailDomain: string | null
  }
  content: {
    summaryDate: string | null
    topFeatureCount: number
    topFeatureNames: string[]
  }
  errorMessage: string | null
}

interface JournalSummary {
  total: number
  sent: number
  failed: number
  uniqueRecipients: number
  byNotificationType: Record<string, number>
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function shorten(value: string | null, length = 20): string {
  if (!value) return '—'
  if (value.length <= length) return value
  return `${value.slice(0, length)}…`
}

export default function EmailSendJournalPage() {
  const [items, setItems] = useState<JournalItem[]>([])
  const [summary, setSummary] = useState<JournalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<JournalStatus>('all')
  const [notificationType, setNotificationType] = useState('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [limit, setLimit] = useState(200)

  const fetchJournal = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: String(limit),
        status,
      })
      if (notificationType.trim()) params.set('notificationType', notificationType.trim())
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/analytics/email-send-journal?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Failed to load email send journal')
      }

      setItems(Array.isArray(data.items) ? data.items : [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email send journal')
      setItems([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [endDate, limit, notificationType, startDate, status])

  useEffect(() => {
    fetchJournal()
  }, [fetchJournal])

  const notificationTypes = useMemo(() => {
    const set = new Set(items.map((item) => item.notificationType).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All Status' },
      { value: 'sent', label: 'Sent' },
      { value: 'failed', label: 'Failed' },
    ],
    []
  )

  const notificationTypeOptions = useMemo(
    () => [
      { value: '', label: 'All Types' },
      ...notificationTypes.map((type) => ({ value: type, label: type })),
    ],
    [notificationTypes]
  )

  const limitOptions = useMemo(
    () => [
      { value: '100', label: '100' },
      { value: '200', label: '200' },
      { value: '300', label: '300' },
      { value: '500', label: '500' },
    ],
    []
  )

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items

    return items.filter((item) => {
      const haystack = [
        item.campaignId,
        item.notificationType,
        item.recipient.uid,
        item.recipient.emailMasked,
        item.recipient.emailDomain,
        item.errorMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [items, search])

  return (
    <AdminErrorBoundary componentName="Email Send Journal">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-transparent dark:from-primary-900/20 dark:via-primary-800/10 dark:to-transparent rounded-2xl p-6 shadow-sm">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
            📬 Email Send Journal
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Privacy-minimized audit trail for campaign sends (status, recipient hash, type, and date).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Events</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.total ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Sent</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary?.sent ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary?.failed ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Unique Recipients</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary?.uniqueRecipients ?? 0}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputSize="md"
              placeholder="Search campaign, recipient, error"
              className="xl:col-span-2"
            />

            <Select
              value={status}
              options={statusOptions}
              onChange={(value) => setStatus(value as JournalStatus)}
              className="w-full"
            />

            <Select
              value={notificationType}
              options={notificationTypeOptions}
              onChange={setNotificationType}
              className="w-full"
            />

            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Start date"
              className="w-full"
            />

            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="End date"
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400">Limit</label>
            <Select
              value={String(limit)}
              options={limitOptions}
              onChange={(value) => setLimit(Number(value))}
              className="w-28"
            />
            <button
              onClick={() => fetchJournal()}
              className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-dark-850 text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="text-left px-3 py-2">Sent At</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Campaign</th>
                  <th className="text-left px-3 py-2">Recipient</th>
                  <th className="text-left px-3 py-2">Content</th>
                  <th className="text-left px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      Loading journal entries...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      No journal entries found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100 dark:border-dark-700">
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDateTime(item.sentAt)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'sent'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.notificationType}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        <div>{shorten(item.campaignId, 26)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.template}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        <div>{item.recipient.emailMasked || '—'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          uid: {shorten(item.recipient.uid, 12)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          date: {item.content.summaryDate || '—'}
                        </div>
                        <div className="mt-1">{item.content.topFeatureNames.join(', ') || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-red-700 dark:text-red-300">
                        {item.errorMessage ? shorten(item.errorMessage, 64) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </AdminErrorBoundary>
  )
}
