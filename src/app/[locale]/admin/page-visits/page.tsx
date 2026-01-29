'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/DatePicker'

type PageVisitItem = {
  id: string
  visitId: string
  path: string | null
  locale: string | null
  visitorType: 'user' | 'guest' | null
  visitorId: string | null
  userId: string | null
  anonId: string | null
  referrer: string | null
  durationMs: number | null
  startedAt: string | null
  endedAt: string | null
}

type PageVisitSummary = {
  id: string
  path: string | null
  totalViews: number
  lastViewAt: string | null
  displayName?: string | null
}

type VisitorFilter = 'all' | 'user' | 'guest'
type IdFilterField = 'userId' | 'visitorId' | 'anonId'

const DEFAULT_LIMIT = 200
const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#F43F5E']

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDuration(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const seconds = Math.max(0, Math.round(value / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

function shortenId(value: string | null, prefix = 8) {
  if (!value) return '—'
  if (value.length <= prefix * 2) return value
  return `${value.slice(0, prefix)}…${value.slice(-prefix)}`
}

function humanizePath(path: string | null): string {
  if (!path) return '—'
  const withoutQuery = path.split('?')[0] || ''
  const segments = withoutQuery.split('/').filter(Boolean)
  if (segments.length === 0) return 'Home'
  const [first, ...rest] = segments
  const locale = first.length === 2 ? first : null
  const pathSegments = locale ? rest : segments
  if (pathSegments.length === 0) return 'Home'
  const [section, ...tail] = pathSegments
  const decode = (value: string) => decodeURIComponent(value).replace(/-/g, ' ')
  const titleCase = (value: string) =>
    decode(value).replace(/\b\w/g, (char) => char.toUpperCase())

  if (section === 'dashboard') return 'Dashboard'
  if (section === 'comics') {
    if (tail.length === 0) return 'Comics'
    const last = tail[tail.length - 1] || ''
    const match = last.match(/ep(\d+)/i)
    if (match) return `Comics: EP${match[1]}`
    return `Comics: ${titleCase(last)}`
  }
  if (section === 'stories') {
    if (tail.length === 0) return 'Stories'
    const last = tail[tail.length - 1] || ''
    return `Stories: ${titleCase(last)}`
  }
  if (section === 'books') return 'Books'
  if (section === 'resources') return 'Resources'
  if (section === 'youtube-shadowing') return 'YouTube Shadowing'
  if (section === 'learn') return 'Learn'
  if (section === 'games') return 'Games'

  return titleCase(section)
}

export default function PageVisitsAdminPage() {
  const [items, setItems] = useState<PageVisitItem[]>([])
  const [summaryItems, setSummaryItems] = useState<PageVisitSummary[]>([])
  const [contentItems, setContentItems] = useState<PageVisitSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [visitorFilter, setVisitorFilter] = useState<VisitorFilter>('all')
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [filterField, setFilterField] = useState<IdFilterField>('userId')
  const [filterValue, setFilterValue] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [contentStartDate, setContentStartDate] = useState('')
  const [contentEndDate, setContentEndDate] = useState('')
  const [includeMarketing, setIncludeMarketing] = useState(false)
  const [visitorTypeSummary, setVisitorTypeSummary] = useState<Array<{ name: string; value: number }>>([])
  const [visitorSummaryDate, setVisitorSummaryDate] = useState<string | null>(null)
  const [visitorSummaryError, setVisitorSummaryError] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date()
    const end = today.toISOString().slice(0, 10)
    const startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
    const start = startDate.toISOString().slice(0, 10)
    setContentStartDate(start)
    setContentEndDate(end)
  }, [])

  const fetchVisits = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      if (filterValue.trim()) {
        params.set('filterField', filterField)
        params.set('filterValue', filterValue.trim())
      }
      if (dateFilter) {
        params.set('date', dateFilter)
      }
      const response = await fetch(`/api/admin/analytics/page-visits?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Failed to load page visits')
      }
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page visits')
    } finally {
      setLoading(false)
    }
  }

  const fetchSummaries = async () => {
    try {
      setSummaryError(null)
      const response = await fetch('/api/admin/analytics/page-visit-summaries?limit=50', {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Failed to load page summary')
      }
      setSummaryItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load page summary')
    }
  }

  const fetchContentSummary = async () => {
    if (!contentStartDate || !contentEndDate) return
    try {
      setContentLoading(true)
      setContentError(null)
      const params = new URLSearchParams({
        start: contentStartDate,
        end: contentEndDate,
        limit: '50',
      })
      const response = await fetch(`/api/admin/analytics/page-visit-content?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Failed to load content summary')
      }
      setContentItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'Failed to load content summary')
    } finally {
      setContentLoading(false)
    }
  }

  const fetchVisitorSummary = async (dateOverride?: string) => {
    try {
      setVisitorSummaryError(null)
      const dateParam = dateOverride || dateFilter || new Date().toISOString().slice(0, 10)
      const params = new URLSearchParams({
        date: dateParam,
        includeMarketing: includeMarketing ? 'true' : 'false',
      })
      const response = await fetch(`/api/admin/analytics/page-visits-summary?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Failed to load visitor summary')
      }
      setVisitorTypeSummary(Array.isArray(data.uniqueVisitors) ? data.uniqueVisitors : [])
      setVisitorSummaryDate(data.date || dateParam)
    } catch (err) {
      setVisitorSummaryError(err instanceof Error ? err.message : 'Failed to load visitor summary')
      setVisitorTypeSummary([])
    }
  }

  useEffect(() => {
    fetchVisits()
  }, [limit, filterField, filterValue, dateFilter])

  useEffect(() => {
    fetchSummaries()
  }, [])

  useEffect(() => {
    if (!contentStartDate || !contentEndDate) return
    fetchContentSummary()
  }, [contentStartDate, contentEndDate])

  useEffect(() => {
    fetchVisitorSummary()
  }, [dateFilter, includeMarketing])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (visitorFilter !== 'all' && item.visitorType !== visitorFilter) return false
      if (showActiveOnly && item.endedAt) return false
      if (!query) return true
      const haystack = [
        item.path,
        item.visitorId,
        item.userId,
        item.anonId,
        item.referrer,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [items, search, visitorFilter, showActiveOnly])

  const summary = useMemo(() => {
    if (filteredItems.length === 0) {
      return { total: 0, completed: 0, avgDuration: '—' }
    }
    const completed = filteredItems.filter((item) => item.endedAt && item.durationMs !== null)
    const totalDuration = completed.reduce((sum, item) => sum + (item.durationMs || 0), 0)
    const avgDurationMs = completed.length > 0 ? totalDuration / completed.length : null
    return {
      total: filteredItems.length,
      completed: completed.length,
      avgDuration: avgDurationMs === null ? '—' : formatDuration(avgDurationMs),
    }
  }, [filteredItems])

  const visitsByDay = useMemo(() => {
    const counts = new Map<string, { date: string; visits: number; completed: number }>()
    for (const item of filteredItems) {
      if (!item.startedAt) continue
      const date = new Date(item.startedAt)
      if (Number.isNaN(date.getTime())) continue
      const key = date.toISOString().slice(0, 10)
      const entry = counts.get(key) || { date: key, visits: 0, completed: 0 }
      entry.visits += 1
      if (item.endedAt && item.durationMs !== null) entry.completed += 1
      counts.set(key, entry)
    }
    return Array.from(counts.values()).sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [filteredItems])

  const visitorTypeBreakdown = useMemo(() => {
    if (visitorTypeSummary.length > 0) {
      return visitorTypeSummary
    }
    const buckets = new Map<string, Set<string>>()
    for (const item of filteredItems) {
      const key = item.visitorType || 'unknown'
      const visitorId = item.visitorId || ''
      if (!visitorId) continue
      if (!buckets.has(key)) {
        buckets.set(key, new Set())
      }
      buckets.get(key)!.add(visitorId)
    }
    return Array.from(buckets.entries()).map(([name, set]) => ({ name, value: set.size }))
  }, [filteredItems, visitorTypeSummary])

  return (
    <AdminErrorBoundary componentName="Page Visits">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full space-y-6"
      >
        <Card className="border-primary-200 dark:border-primary-900/50">
          <CardHeader>
            <CardTitle className="text-3xl">🧭 Page Visits</CardTitle>
            <CardDescription>
              Raw visit logs with per-visit duration and visitor identity
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by path, visitor, referrer"
                className="flex-1"
              />
            <div className="flex flex-wrap gap-2">
              {(['all', 'user', 'guest'] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  onClick={() => setVisitorFilter(value)}
                  variant={visitorFilter === value ? 'default' : 'outline'}
                  size="sm"
                >
                  {value === 'all' ? 'All Visitors' : value === 'user' ? 'Users' : 'Guests'}
                </Button>
              ))}
              <Button
                type="button"
                onClick={() => setShowActiveOnly((prev) => !prev)}
                variant={showActiveOnly ? 'default' : 'outline'}
                size="sm"
              >
                {showActiveOnly ? 'Active Only' : 'Include Active'}
              </Button>
              <Button
                type="button"
                onClick={fetchVisits}
                variant="secondary"
                size="sm"
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Select
                value={filterField}
                onChange={(value) => setFilterField(value as IdFilterField)}
                options={[
                  { value: 'userId', label: 'User ID' },
                  { value: 'visitorId', label: 'Visitor ID' },
                  { value: 'anonId', label: 'Anon ID' },
                ]}
                size="sm"
                className="w-40"
              />
              <Input
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder="Exact ID match"
                className="w-64"
                inputSize="sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <DatePicker
                value={dateFilter}
                onChange={setDateFilter}
                label="Day (UTC)"
                size="sm"
                placeholder="Select date"
                className="w-48"
              />
              {dateFilter && (
                <Button
                  type="button"
                  onClick={() => setDateFilter('')}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Total: <strong className="text-foreground">{summary.total}</strong></span>
              <span>Completed: <strong className="text-foreground">{summary.completed}</strong></span>
              <span>Avg duration: <strong className="text-foreground">{summary.avgDuration}</strong></span>
            </div>
            <Input
              type="number"
              value={limit}
              min={50}
              max={500}
              onChange={(e) => setLimit(Math.min(500, Math.max(50, Number(e.target.value) || DEFAULT_LIMIT)))}
              label="Limit"
              inputSize="sm"
              className="w-24"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Visits per Day</h3>
                <Badge variant="secondary">UTC</Badge>
              </div>
              {visitsByDay.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data for chart</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visitsByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F9FAFB',
                        }}
                        labelStyle={{ color: '#F9FAFB', fontWeight: 600 }}
                        itemStyle={{ color: '#F9FAFB' }}
                      />
                      <Legend />
                      <Bar dataKey="visits" name="Visits" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Visitor Type</h3>
              <Badge variant="secondary">
                Breakdown {visitorSummaryDate ? `(UTC ${visitorSummaryDate})` : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Button
                type="button"
                onClick={() => setIncludeMarketing(false)}
                variant={!includeMarketing ? 'default' : 'outline'}
                size="sm"
              >
                In-app only
              </Button>
              <Button
                type="button"
                onClick={() => setIncludeMarketing(true)}
                variant={includeMarketing ? 'default' : 'outline'}
                size="sm"
              >
                All traffic
              </Button>
            </div>
            {visitorSummaryError ? (
              <p className="text-destructive text-sm">❌ {visitorSummaryError}</p>
            ) : visitorTypeBreakdown.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data for chart</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={visitorTypeBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {visitorTypeBreakdown.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F9FAFB',
                        }}
                        labelStyle={{ color: '#F9FAFB', fontWeight: 600 }}
                        itemStyle={{ color: '#F9FAFB' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Top Content (All Time)</h3>
              <Button variant="ghost" size="sm" onClick={fetchSummaries}>
                Refresh
              </Button>
            </div>
            {summaryError ? (
              <p className="text-destructive text-sm">❌ {summaryError}</p>
            ) : summaryItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">No summary data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Page</th>
                      <th className="py-2 pr-4 font-medium">Path</th>
                      <th className="py-2 pr-4 font-medium">Views</th>
                      <th className="py-2 font-medium">Last View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryItems.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="py-2 pr-4 text-foreground">
                          {item.displayName || humanizePath(item.path)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {item.path || '—'}
                        </td>
                        <td className="py-2 pr-4 text-foreground font-medium">
                          {item.totalViews}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {formatDate(item.lastViewAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                Top Content (Content Only)
              </h3>
              <div className="flex flex-wrap items-end gap-2">
                <DatePicker
                  value={contentStartDate}
                  onChange={setContentStartDate}
                  label="Start (UTC)"
                  size="sm"
                  placeholder="Start date"
                  className="w-40"
                />
                <DatePicker
                  value={contentEndDate}
                  onChange={setContentEndDate}
                  label="End (UTC)"
                  size="sm"
                  placeholder="End date"
                  className="w-40"
                />
                <Button variant="ghost" size="sm" onClick={fetchContentSummary} disabled={contentLoading}>
                  {contentLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>
            {contentError ? (
              <p className="text-destructive text-sm">❌ {contentError}</p>
            ) : contentItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">No content data for this range</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Content</th>
                      <th className="py-2 pr-4 font-medium">Path</th>
                      <th className="py-2 pr-4 font-medium">Views</th>
                      <th className="py-2 font-medium">Last View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentItems.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="py-2 pr-4 text-foreground">
                          {item.displayName || humanizePath(item.path)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {item.path || '—'}
                        </td>
                        <td className="py-2 pr-4 text-foreground font-medium">
                          {item.totalViews}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {formatDate(item.lastViewAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">❌ {error}</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No visit data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-3 pr-4 font-medium">Started</th>
                    <th className="py-3 pr-4 font-medium">Page</th>
                    <th className="py-3 pr-4 font-medium">Path</th>
                    <th className="py-3 pr-4 font-medium">Visitor</th>
                    <th className="py-3 pr-4 font-medium">Duration</th>
                    <th className="py-3 pr-4 font-medium">Ended</th>
                    <th className="py-3 pr-4 font-medium">Locale</th>
                    <th className="py-3 font-medium">Referrer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-t border-border align-top hover:bg-muted/50 transition-colors">
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDate(item.startedAt)}
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {humanizePath(item.path)}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{item.path || '—'}</div>
                        {!item.endedAt && (
                          <Badge variant="default" className="mt-1 bg-amber-500 hover:bg-amber-600">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="capitalize text-foreground">{item.visitorType || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {shortenId(item.visitorId)}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {formatDuration(item.durationMs)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDate(item.endedAt)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {item.locale || '—'}
                      </td>
                      <td className="py-3 text-muted-foreground max-w-xs">
                        <div className="truncate" title={item.referrer || undefined}>
                          {item.referrer || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </CardContent>
        </Card>
      </motion.div>
    </AdminErrorBoundary>
  )
}
