'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DOMPurify from 'isomorphic-dompurify'
import {
  Download,
  FileText,
  Package,
  Calendar,
  Tag,
  Globe,
  Layers,
  Clock,
  Sparkles,
  FileDown,
  ChevronDown,
  Plus,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Share2,
  Check,
  Volume2,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import StructuredData from '@/components/StructuredData'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import type { DeckMarketDeck, DeckMarketVersion } from '@/types/deckmarket'
import { cn } from '@/lib/utils'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import AudioButton from '@/components/ui/AudioButton'
import { useToast } from '@/components/ui/Toast/ToastContext'

const PREVIEW_LIMIT = 10

/* ── Gradient & Animation Helpers ─────────────────────────────────── */

const DECK_GRADIENTS = [
  'bg-gradient-to-br from-violet-400 to-purple-700',
  'bg-gradient-to-br from-sky-400 to-cyan-600',
  'bg-gradient-to-br from-rose-400 to-pink-600',
  'bg-gradient-to-br from-teal-400 to-emerald-600',
  'bg-gradient-to-br from-amber-400 to-orange-600',
  'bg-gradient-to-br from-fuchsia-400 to-pink-700',
  'bg-gradient-to-br from-indigo-400 to-blue-700',
  'bg-gradient-to-br from-lime-400 to-green-600',
  'bg-gradient-to-br from-cyan-400 to-teal-600',
  'bg-gradient-to-br from-orange-400 to-rose-600',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function deckGradient(jlpt: string | null, deckId: string): string {
  switch (jlpt) {
    case 'N5':
      return 'bg-gradient-to-br from-green-400 to-emerald-600'
    case 'N4':
      return 'bg-gradient-to-br from-blue-400 to-indigo-600'
    case 'N3':
      return 'bg-gradient-to-br from-yellow-400 to-amber-600'
    case 'N2':
      return 'bg-gradient-to-br from-orange-400 to-red-600'
    case 'N1':
      return 'bg-gradient-to-br from-red-400 to-rose-700'
    default:
      return DECK_GRADIENTS[hashString(deckId) % DECK_GRADIENTS.length]
  }
}

function jlptAccentColor(jlpt: string | null): string {
  switch (jlpt) {
    case 'N5': return 'border-green-400'
    case 'N4': return 'border-blue-400'
    case 'N3': return 'border-yellow-400'
    case 'N2': return 'border-orange-400'
    case 'N1': return 'border-red-400'
    default: return 'border-primary-400'
  }
}

function jlptBadgeBg(jlpt: string | null): string {
  switch (jlpt) {
    case 'N5': return 'bg-green-500/20 text-green-700 dark:text-green-300'
    case 'N4': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
    case 'N3': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
    case 'N2': return 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
    case 'N1': return 'bg-red-500/20 text-red-700 dark:text-red-300'
    default: return 'bg-primary-500/20 text-primary-700 dark:text-primary-300'
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
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

/* ── Types & Utility Helpers ──────────────────────────────────────── */

interface PreviewCard {
  frontHtml: string
  backHtml: string
  audioUrl?: string | null
}

const ANKI_MEDIA_KEY_SEPARATOR = '::'

const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, '')

const normalizePreviewText = (value: string) =>
  stripHtmlTags(value).replace(/\s+/g, ' ').trim()

const formatCsvRichHtml = (value: string) => {
  const withBreaks = value.replace(/\r?\n/g, '<br>')
  return DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: ['ruby', 'rt', 'rp', 'br'],
    ALLOWED_ATTR: [],
  })
}

const applyMediaToHtml = (html: string, mediaMap: Map<string, string>) => {
  if (!html) return ''

  const replaceSrc = (input: string) =>
    input.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/gi, (match, before, src, after) => {
      if (src.startsWith('http') || src.startsWith('blob:') || src.startsWith('data:')) {
        return match
      }
      const url = mediaMap.get(src)
      if (!url) return match
      return `<img${before}src="${url}"${after}>`
    })

  const replaceDataKey = (input: string) =>
    input.replace(/data-anki-media="([^"]+)"/gi, (match, key) => {
      const separatorIndex = key.indexOf(ANKI_MEDIA_KEY_SEPARATOR)
      if (separatorIndex === -1) return match
      const filename = key.slice(separatorIndex + ANKI_MEDIA_KEY_SEPARATOR.length)
      const url = mediaMap.get(filename)
      if (!url) return match
      return `data-anki-media="${key}" data-anki-media-url="${url}"`
    })

  const withSrc = replaceSrc(html)
  return replaceDataKey(withSrc)
}

const isAudioFilename = (value: string) => {
  const lower = value.toLowerCase()
  return (
    lower.endsWith('.mp3') ||
    lower.endsWith('.m4a') ||
    lower.endsWith('.wav') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.aac') ||
    lower.endsWith('.flac')
  )
}

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (char === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      continue
    }

    if (char === '\r') {
      continue
    }

    field += char
  }

  row.push(field)
  const hasMeaningfulData = row.some((value) => value.trim().length > 0)
  if (hasMeaningfulData) {
    rows.push(row)
  }

  return rows
}

const parseCsvPreview = (text: string): PreviewCard[] => {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return []

  const firstRow = rows[0].map((value) => value.trim().toLowerCase())
  const frontIndex = firstRow.indexOf('front')
  const backIndex = firstRow.indexOf('back')
  const hasHeader = frontIndex !== -1 && backIndex !== -1
  const startIndex = hasHeader ? 1 : 0
  const resolvedFrontIndex = hasHeader ? frontIndex : 0
  const resolvedBackIndex = hasHeader ? backIndex : 1
  const cards: PreviewCard[] = []

  for (let i = startIndex; i < rows.length; i++) {
    if (cards.length >= PREVIEW_LIMIT) break
    const row = rows[i]
    if (!row) continue

    const front = (row[resolvedFrontIndex] || '').trim()
    const back = (row[resolvedBackIndex] || '').trim()
    if (!front && !back) continue

    cards.push({
      frontHtml: formatCsvRichHtml(front),
      backHtml: formatCsvRichHtml(back),
    })
  }

  return cards
}

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
  const { showToast } = useToast()
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
  const [previewCards, setPreviewCards] = useState<PreviewCard[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const previewUrlsRef = useRef<string[]>([])

  // "Add to Flashcards" state
  const { isPremium } = useSubscription()
  type AddState = 'idle' | 'downloading' | 'parsing' | 'saving' | 'success' | 'already-added'
  const [addState, setAddState] = useState<AddState>('idle')
  const [addError, setAddError] = useState<string | null>(null)
  const [freeSlotDeckId, setFreeSlotDeckId] = useState<string | null>(null)

  const isFreeSlotTaken = !isPremium && freeSlotDeckId !== null && freeSlotDeckId !== deckId

  // Share state
  const [shareCopied, setShareCopied] = useState(false)
  const handleShare = async () => {
    const shareUrl = `https://moshimoshi.app/${locale}/deckmarket/${deckId}`
    const shareData = {
      title: deck?.title ?? 'DeckMarket',
      text: deck?.description ?? '',
      url: shareUrl,
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

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

  // Fetch DeckMarket state for free users (cross-device slot enforcement)
  useEffect(() => {
    if (!user || isPremium) return
    let cancelled = false
    fetch('/api/deckmarket/state', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (!cancelled) setFreeSlotDeckId(data.deckId ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, isPremium])

  useEffect(() => {
    if (!deckId || !user || !latestVersion) return
    let isActive = true

    const clearPreviewUrls = () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current = []
    }

    const loadPreview = async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      clearPreviewUrls()
      try {
        const res = await fetch(`/api/deckmarket/decks/${deckId}/preview`)
        if (!res.ok) throw new Error('Preview unavailable')
        const data = await res.json()

        if (data.format === 'csv') {
          const csvRes = await fetch(data.downloadUrl)
          if (!csvRes.ok) throw new Error('Preview unavailable')
          const text = await csvRes.text()
          const cards = parseCsvPreview(text)
          if (isActive) setPreviewCards(cards)
          return
        }

        const apkgRes = await fetch(data.downloadUrl)
        if (!apkgRes.ok) throw new Error('Preview unavailable')
        const blob = await apkgRes.blob()
        const file = new File([blob], data.filename || 'deck.apkg', {
          type: 'application/octet-stream',
        })

        const { AnkiImporter } = await import('@/lib/anki/importer')
        const parsed = await AnkiImporter.parsePackage(file)
        const mediaUrlMap = new Map<string, string>()
        parsed.media.forEach((blob, filename) => {
          const url = URL.createObjectURL(blob)
          previewUrlsRef.current.push(url)
          mediaUrlMap.set(filename, url)
        })

        const previewDeck =
          parsed.decks.find((deckItem) => deckItem.cards.length > 0) || parsed.decks[0]
        if (previewDeck) {
          parsed.media.forEach((_, filename) => {
            mediaUrlMap.set(`${previewDeck.id}${ANKI_MEDIA_KEY_SEPARATOR}${filename}`, mediaUrlMap.get(filename) as string)
          })
        }
        const resolveMediaUrl = (key?: string | null) => {
          if (!key) return null
          const direct = mediaUrlMap.get(key)
          if (direct) return direct
          const separatorIndex = key.indexOf(ANKI_MEDIA_KEY_SEPARATOR)
          if (separatorIndex >= 0) {
            const filename = key.slice(separatorIndex + ANKI_MEDIA_KEY_SEPARATOR.length)
            return mediaUrlMap.get(filename) || null
          }
          return null
        }
        const cards = previewDeck
          ? previewDeck.cards.slice(0, PREVIEW_LIMIT).map((card) => {
              const frontHtml = applyMediaToHtml(card.front || '', mediaUrlMap)
              const backHtml = applyMediaToHtml(card.back || '', mediaUrlMap)
              const mediaAudio = card.media?.find((entry) => isAudioFilename(entry))
              const audioUrl =
                resolveMediaUrl(card.audioFilename) || resolveMediaUrl(mediaAudio || null)
              return {
                frontHtml,
                backHtml,
                audioUrl,
              }
            })
          : []

        if (isActive) setPreviewCards(cards)
      } catch (error) {
        console.error('Preview load error:', error)
        if (isActive) {
          setPreviewCards([])
          setPreviewError(strings.deckmarket.preview.unavailable)
        }
      } finally {
        if (isActive) setPreviewLoading(false)
      }
    }

    void loadPreview()
    return () => {
      isActive = false
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current = []
    }
  }, [deckId, user, latestVersion?.id, strings.deckmarket.preview.unavailable])

  // Detect "already added" state by matching deck name + deckmarket origin
  useEffect(() => {
    if (!deckId || !user || !deck) return
    let cancelled = false
    const check = async () => {
      try {
        const { ankiDeckManager } = await import('@/lib/anki/AnkiDeckManager')
        const decks = await ankiDeckManager.getDecks(user.uid, isPremium ?? false)
        if (cancelled) return
        const found = decks.some(d => d.origin === 'deckmarket' && d.name === deck.title)
        if (found) setAddState('already-added')
      } catch {
        // ignore — detection is best-effort
      }
    }
    void check()
    return () => { cancelled = true }
  }, [deckId, user, deck, isPremium])

  // "Add to Flashcards" handler
  const handleAddToFlashcards = async () => {
    if (!deckId || !user || !deck) return
    setAddState('downloading')
    setAddError(null)

    try {
      // 1. Get presigned download URL
      const dlRes = await fetch(`/api/deckmarket/decks/${deckId}/download?format=apkg`)
      if (!dlRes.ok) throw new Error('Download failed')
      const dlData = await dlRes.json()

      // 2. Download the .apkg blob
      const blobRes = await fetch(dlData.downloadUrl)
      if (!blobRes.ok) throw new Error('Download failed')
      const blob = await blobRes.blob()
      const filename = dlData.filename || `${deck.title}.apkg`
      const file = new File([blob], filename, { type: 'application/zip' })

      // 3. Parse the .apkg
      setAddState('parsing')
      const { AnkiImporter } = await import('@/lib/anki/importer')
      const parsed = await AnkiImporter.parsePackage(file)

      const parsedDeck = parsed.decks.find(d => d.cards.length > 0) || parsed.decks[0]
      if (!parsedDeck) throw new Error('No cards found')

      // 4. Store media
      setAddState('saving')
      const { AnkiMediaStore, buildAnkiMediaKey } = await import('@/lib/anki/mediaStore')
      const mediaStore = AnkiMediaStore.getInstance()

      for (const [mediaFilename, mediaBlob] of parsed.media) {
        const key = buildAnkiMediaKey(parsedDeck.id, mediaFilename)
        await mediaStore.storeMedia(key, mediaBlob, {
          userId: user.uid,
          deckId: parsedDeck.id,
        })
      }

      // 5. Override deck name with DeckMarket title for user-friendliness
      parsedDeck.name = deck.title
      parsedDeck.origin = 'deckmarket'

      // 6. Save deck — premium users get R2 backup
      const { ankiDeckManager } = await import('@/lib/anki/AnkiDeckManager')
      await ankiDeckManager.saveDeck(parsedDeck, user.uid, isPremium ?? false, filename, isPremium ?? false)

      setAddState('success')

      // Record state for free-user cross-device slot enforcement
      if (!(isPremium ?? false)) {
        fetch('/api/deckmarket/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ deckId }),
        }).catch(() => {})
      }
    } catch (err: any) {
      const code = err?.code || err?.message
      const reason = typeof err?.reason === 'string' && err.reason.trim().length > 0
        ? err.reason
        : null

      console.error('[DeckMarket] Add to Flashcards failed', {
        code,
        reason,
        message: err?.message,
      })

      if (code === 'DUPLICATE_DECK_NAME') {
        setAddError(strings.deckmarket.deck.addDuplicateName)
      } else if (code === 'DECKMARKET_LIMIT_REACHED' || code === 'FREE_DECKMARKET_ONLY') {
        setAddError(strings.deckmarket.deck.addLimitReached)
      } else if (
        code === 'ANKI_IMPORT_LIMIT_REACHED' ||
        code === 'DECK_LIMIT_REACHED' ||
        reason === 'limit_reached'
      ) {
        setAddError(null)
        showToast(strings.deckmarket.deck.monthlyLimitReached, 'warning')
      } else if (code === 'Failed to check anki_imports entitlement') {
        setAddError(reason || strings.deckmarket.deck.addFailed)
      } else if (code === 'Download failed') {
        setAddError('Failed to download deck package. Please try again.')
      } else if (code === 'No cards found') {
        setAddError('This deck has no importable cards.')
      } else {
        setAddError(reason || strings.deckmarket.deck.addFailed)
      }
      setAddState('idle')
    }
  }

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

  const gradient = deck ? deckGradient(deck.jlpt, deck.id) : ''
  const hasGuaranteedNativeAudio = useMemo(() => {
    if (!deck) return false
    if (deck.hasNativeAudio === true) return true

    // Backward-compatible fallback for legacy decks until metadata is backfilled.
    const normalizedId = deck.id.toLowerCase()
    if (normalizedId.startsWith('kuchiguse500-')) return true

    return deck.tags.some((tag) => tag.toLowerCase() === 'kuchiguse500')
  }, [deck])
  const normalizedDeckDescription = useMemo(() => {
    const raw = deck?.description || ''
    return raw.replace(/\s+/g, ' ').trim()
  }, [deck?.description])

  const shortHeroDescription = useMemo(() => {
    const normalized = normalizedDeckDescription
    if (!normalized) return ''

    const sentenceParts = normalized.split(/(?<=[.!?])\s+/).filter(Boolean)
    if (sentenceParts.length >= 2) {
      return `${sentenceParts[0]} ${sentenceParts[1]}`
    }
    if (normalized.length > 240) {
      return `${normalized.slice(0, 237).trimEnd()}…`
    }
    return normalized
  }, [normalizedDeckDescription])

  const shouldCollapseDescription =
    normalizedDeckDescription.length > 0 && normalizedDeckDescription !== shortHeroDescription
  const heroDescription = showFullDescription ? normalizedDeckDescription : shortHeroDescription

  useEffect(() => {
    setShowFullDescription(false)
  }, [deck?.id])

  return (
    <>
      {deck && (
        <>
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
              datePublished: deck.createdAt,
              dateModified: deck.updatedAt,
              provider: {
                '@type': 'Organization',
                name: 'Moshimoshi',
                url: 'https://moshimoshi.app',
              },
            }}
          />
          <StructuredData
            data={{
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Moshimoshi',
                  item: 'https://moshimoshi.app',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'DeckMarket',
                  item: `https://moshimoshi.app/${locale}/deckmarket`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: deck.title,
                  item: `https://moshimoshi.app/${locale}/deckmarket/${deck.id}`,
                },
              ],
            }}
          />
        </>
      )}
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={deck?.title || strings.deckmarket.title}
        description={strings.deckmarket.subtitle}
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

        {!authLoading && user && !loading && !deck && (
          <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
            {strings.deckmarket.deck.notFound}
          </div>
        )}

        {!authLoading && user && !loading && deck && (
          <motion.div
            className="space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* ── Section 1: Hero Banner ─────────────────────────── */}
            <motion.div variants={itemVariants} className="rounded-2xl overflow-hidden shadow-lg">
              <div className={cn('relative px-6 py-10 sm:px-10 sm:py-14', gradient)}>
                {/* dot pattern overlay */}
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
                    className="text-3xl sm:text-4xl font-bold text-white mb-3 truncate max-w-2xl"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
                    title={deck.title}
                  >
                    {deck.title}
                  </h1>
                  {heroDescription && (
                    <div className="max-w-2xl mb-6">
                      <p className="text-white/85 text-sm sm:text-base leading-relaxed">
                        {heroDescription}
                      </p>
                      {hasGuaranteedNativeAudio && (
                        <div className="mt-3">
                          <div className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm sm:text-sm">
                            <Volume2 className="h-4 w-4" />
                            {strings.deckmarket.deck.audioIncludedDescription}
                          </div>
                        </div>
                      )}
                      <div className="mt-2">
                        {shouldCollapseDescription && (
                          <button
                            type="button"
                            onClick={() => setShowFullDescription((prev) => !prev)}
                            className="text-sm font-medium text-white underline underline-offset-4 decoration-white/60 hover:decoration-white"
                          >
                            {showFullDescription ? 'Show less' : 'Read full description'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* frosted badges */}
                  <div className="flex flex-wrap gap-2">
                    {deck.jlpt && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm text-white border border-white/30">
                        <Layers className="h-3.5 w-3.5" />
                        {deck.jlpt}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/20 backdrop-blur-sm text-white border border-white/20">
                      <Globe className="h-3.5 w-3.5" />
                      {deck.language.toUpperCase()}
                    </span>
                    {latestVersion?.sizeBytes ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/20 backdrop-blur-sm text-white border border-white/20">
                        <Package className="h-3.5 w-3.5" />
                        {formatBytes(latestVersion.sizeBytes)}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/20 backdrop-blur-sm text-white border border-white/20">
                      <Download className="h-3.5 w-3.5" />
                      {deck.downloadCount} {strings.deckmarket.deck.downloads.toLowerCase()}
                    </span>
                    {hasGuaranteedNativeAudio && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/25 backdrop-blur-sm text-white border border-emerald-200/50">
                        <Volume2 className="h-3.5 w-3.5" />
                        {strings.deckmarket.deck.audioIncludedBadge}
                      </span>
                    )}
                  </div>

                  {/* tags */}
                  {deck.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {deck.tags.map((tag) => (
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

              <div className="space-y-5">
                {/* Info row: icon + text */}
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md',
                      gradient
                    )}
                  >
                    <Package className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {strings.deckmarket.deck.downloadLatest}
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
                    {hasGuaranteedNativeAudio && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <Volume2 className="h-3.5 w-3.5" />
                        {strings.deckmarket.deck.audioIncludedDownload}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleDownload(undefined, 'apkg')}
                    disabled={downloadingId !== null || !latestVersion}
                    aria-label={`Download ${deck.title} Anki deck`}
                    className={cn(
                      'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white shadow-md transition-colors',
                      downloadingId !== null || !latestVersion
                        ? 'bg-gray-400 cursor-not-allowed'
                        : cn(gradient, 'hover:shadow-lg')
                    )}
                  >
                    <Download className="h-4 w-4" />
                    {downloadingId === 'latest-apkg'
                      ? strings.deckmarket.deck.downloading
                      : strings.deckmarket.deck.downloadAnki}
                  </motion.button>

                  {latestVersion?.csvR2Key && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleDownload(undefined, 'csv')}
                      disabled={downloadingId !== null || !latestVersion}
                      aria-label={`Download ${deck.title} CSV`}
                      className={cn(
                        'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors border',
                        downloadingId !== null || !latestVersion
                          ? 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-dark-700'
                          : 'bg-white/80 dark:bg-dark-800/80 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
                      )}
                    >
                      <FileDown className="h-4 w-4" />
                      {downloadingId === 'latest-csv'
                        ? strings.deckmarket.deck.downloading
                        : strings.deckmarket.deck.downloadCsv}
                    </motion.button>
                  )}

                  {/* Add to Flashcards button */}
                  {latestVersion && (
                    <motion.button
                      whileHover={addState === 'idle' ? { scale: 1.03 } : undefined}
                      whileTap={addState === 'idle' ? { scale: 0.97 } : undefined}
                      onClick={handleAddToFlashcards}
                      disabled={addState !== 'idle' || isFreeSlotTaken}
                      aria-label={strings.deckmarket.deck.addToFlashcards}
                      className={cn(
                        'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium shadow-md transition-colors',
                        isFreeSlotTaken
                          ? 'bg-gray-400 text-white cursor-not-allowed opacity-80'
                          : addState === 'idle'
                            ? cn(gradient, 'text-white hover:shadow-lg')
                            : addState === 'success' || addState === 'already-added'
                              ? 'bg-green-500 text-white cursor-default'
                              : 'bg-gray-400 text-white cursor-not-allowed'
                      )}
                    >
                      {addState === 'idle' && <Plus className="h-4 w-4" />}
                      {(addState === 'downloading' || addState === 'parsing' || addState === 'saving') && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {(addState === 'success' || addState === 'already-added') && (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {addState === 'idle' && strings.deckmarket.deck.addToFlashcards}
                      {(addState === 'downloading' || addState === 'parsing' || addState === 'saving') &&
                        strings.deckmarket.deck.adding}
                      {addState === 'success' && strings.deckmarket.deck.added}
                      {addState === 'already-added' && strings.deckmarket.deck.alreadyAdded}
                    </motion.button>
                  )}

                  {/* Share button */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleShare}
                    aria-label={strings.deckmarket.deck.share}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors border bg-white/80 dark:bg-dark-800/80 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500"
                  >
                    {shareCopied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
                    <span className="w-[5.5rem] text-left">{shareCopied ? strings.deckmarket.deck.linkCopied : strings.deckmarket.deck.share}</span>
                  </motion.button>
                </div>
              </div>

              {/* Add error display */}
              {addError && (
                <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm mt-4">
                  {addError}
                </div>
              )}

              {/* Free-user slot limit warning */}
              {isFreeSlotTaken && addState === 'idle' && (
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
                  {strings.deckmarket.deck.addLimitReached}
                </p>
              )}

              {/* "Go to Flashcards" link after success */}
              {(addState === 'success' || addState === 'already-added') && (
                <div className="mt-4">
                  <Link
                    href={`/${locale}/flashcards`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {strings.deckmarket.deck.goToFlashcards}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {!latestVersion && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  {strings.deckmarket.admin.noVersions}
                </p>
              )}
            </motion.div>

            {/* ── Section 3: Card Preview ────────────────────────── */}
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
                    {strings.deckmarket.preview.title}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                    {strings.deckmarket.preview.subtitle}
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
                          {strings.deckmarket.preview.loading}
                        </div>
                      )}

                      {!previewLoading && previewError && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{previewError}</div>
                      )}

                      {!previewLoading && !previewError && previewCards.length === 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {strings.deckmarket.preview.unavailable}
                        </div>
                      )}

                      {!previewLoading && previewCards.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {previewCards.map((card, index) => (
                            <motion.div
                              key={`${card.frontHtml}-${card.backHtml}-${index}`}
                              custom={index}
                              variants={cardVariants}
                              initial="hidden"
                              animate="visible"
                              className={cn(
                                'rounded-xl bg-white/80 dark:bg-dark-700/60 border border-gray-100 dark:border-dark-600 p-4',
                                `border-l-4 ${jlptAccentColor(deck.jlpt)}`
                              )}
                            >
                              {/* header row: badge + audio */}
                              <div className="flex items-center justify-between mb-2">
                                <span
                                  className={cn(
                                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                                    jlptBadgeBg(deck.jlpt)
                                  )}
                                >
                                  {index + 1}
                                </span>
                                {card.audioUrl && (
                                  <AudioButton
                                    size="sm"
                                    onPlay={() => {
                                      const audio = new Audio(card.audioUrl!)
                                      return audio.play()
                                    }}
                                  />
                                )}
                              </div>

                              {/* front */}
                              <div className="mb-3">
                                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                                  {strings.deckmarket.preview.front}
                                </div>
                                <div
                                  className="text-sm text-gray-900 dark:text-white anki-card-content"
                                  dangerouslySetInnerHTML={{ __html: card.frontHtml || '—' }}
                                />
                              </div>

                              {/* divider */}
                              <div className="border-t border-gray-100 dark:border-dark-600 mb-3" />

                              {/* back */}
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                                  {strings.deckmarket.preview.back}
                                </div>
                                <div
                                  className="text-sm text-gray-900 dark:text-white anki-card-content"
                                  dangerouslySetInnerHTML={{ __html: card.backHtml || '—' }}
                                />
                              </div>
                            </motion.div>
                          ))}
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
                  {strings.deckmarket.admin.noVersions}
                </p>
              )}

              {versions.length > 0 && (
                <div className="relative">
                  {/* timeline line */}
                  <div className={cn('absolute left-[11px] top-3 bottom-3 w-0.5', gradient)} />

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
                          {/* timeline dot */}
                          <div className="absolute left-0 top-4">
                            {isLatest ? (
                              <span className="flex h-6 w-6 items-center justify-center">
                                <span className={cn('h-4 w-4 rounded-full shadow-md', gradient)} />
                                <span
                                  className={cn(
                                    'absolute h-6 w-6 rounded-full opacity-25 animate-ping',
                                    gradient
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
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div className="flex-1">
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
                                    {formatBytes(version.sizeBytes)}
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

                              <div className="flex items-center gap-2 shrink-0">
                                <motion.button
                                  whileHover={{ scale: 1.04 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => handleDownload(version.id, 'apkg')}
                                  disabled={downloadingId !== null}
                                  aria-label={`Download version ${version.versionLabel || version.id} Anki`}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
                                    downloadingId !== null
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : cn(gradient, 'hover:shadow-md')
                                  )}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  {downloadingId === `${version.id}-apkg`
                                    ? strings.deckmarket.deck.downloading
                                    : strings.deckmarket.deck.downloadAnki}
                                </motion.button>
                                {version.csvR2Key && (
                                  <motion.button
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => handleDownload(version.id, 'csv')}
                                    disabled={downloadingId !== null}
                                    aria-label={`Download version ${version.versionLabel || version.id} CSV`}
                                    className={cn(
                                      'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                                      downloadingId !== null
                                        ? 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-dark-700'
                                        : 'bg-white/80 dark:bg-dark-800/80 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
                                    )}
                                  >
                                    <FileDown className="h-3.5 w-3.5" />
                                    {downloadingId === `${version.id}-csv`
                                      ? strings.deckmarket.deck.downloading
                                      : strings.deckmarket.deck.downloadCsv}
                                  </motion.button>
                                )}
                              </div>
                            </div>
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
    </>
  )
}
