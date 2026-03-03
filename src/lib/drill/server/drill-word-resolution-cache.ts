import crypto from 'crypto'
import { adminDb, FieldValue, Timestamp } from '@/lib/firebase/admin'
import type { Firestore } from 'firebase-admin/firestore'
import type { WordType } from '@/types/drill'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = 'drill_word_resolutions'
const CACHE_VERSION = 1

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolutionStatus = 'resolved' | 'unresolved'
export type Confidence = 'high' | 'medium' | 'low'
export type ResolutionSource = 'ollama' | 'openai'

export type PartOfSpeech =
  | 'verb'
  | 'i-adjective'
  | 'na-adjective'
  | 'noun'
  | 'adverb'
  | 'particle'
  | 'expression'
  | 'counter'
  | 'prefix'
  | 'suffix'
  | 'conjunction'
  | 'interjection'
  | 'pronoun'
  | 'other'

/** The AI-produced drill metadata stored in the cache. */
export interface DrillWordResolutionResult {
  surface: string
  lemma: string
  reading: string
  meaning?: string
  partOfSpeech: PartOfSpeech
  conjugationType: WordType
  confidence: Confidence
  alternatives?: string[]
  notes?: string
}

/** Full Firestore document shape for a cached resolution. */
export interface DrillWordResolutionDoc {
  key: string
  query: string
  result: DrillWordResolutionResult | null
  source: ResolutionSource
  status: ResolutionStatus
  cacheVersion: number
  hitCount: number
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
  lastUsedAt: FirebaseFirestore.Timestamp
}

// ---------------------------------------------------------------------------
// Key normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise and hash a query string into a deterministic Firestore document ID.
 *
 * Steps:
 *  1. Trim leading/trailing whitespace.
 *  2. Apply Unicode NFKC normalisation (collapses fullwidth → halfwidth, etc.).
 *  3. Lowercase.
 *  4. SHA-256 hex digest.
 *
 * The resulting key is safe for use as a Firestore document ID and is
 * identical for semantically equivalent inputs (e.g. "食べる " and "食べる").
 */
export function normalizeKey(query: string): string {
  let normalized = query.trim()
  try {
    normalized = normalized.normalize('NFKC')
  } catch {
    // Fallback: keep as-is if normalize is unavailable
  }
  normalized = normalized.toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

// ---------------------------------------------------------------------------
// Sanitisation helper
// ---------------------------------------------------------------------------

/** Remove `undefined` values so Firestore doesn't reject the write. */
function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj } as Record<string, unknown>
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) {
      delete clean[key]
    } else if (clean[key] !== null && typeof clean[key] === 'object' && !Array.isArray(clean[key])) {
      clean[key] = sanitizeForFirestore(clean[key] as Record<string, unknown>)
    }
  }
  return clean as T
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a cached drill word resolution.
 *
 * Returns the full document on cache hit, or `null` on miss.
 * Does **not** mutate hitCount — call `touchHit` separately if you consume the
 * result so that the read remains side-effect-free for callers that only peek.
 */
export async function get(
  query: string,
  dbOverride?: Firestore,
): Promise<DrillWordResolutionDoc | null> {
  const db = dbOverride || adminDb
  if (!db) return null

  try {
    const key = normalizeKey(query)
    const doc = await db.collection(COLLECTION).doc(key).get()

    if (!doc.exists) {
      return null
    }

    return doc.data() as DrillWordResolutionDoc
  } catch (error) {
    console.error('[DrillResolutionCache] Failed to read cache:', error)
    return null
  }
}

/**
 * Store a successfully resolved drill word result.
 *
 * If the document already exists (refresh write), `createdAt` and `hitCount`
 * are preserved so analytics stay accurate.
 */
export async function setResolved(
  query: string,
  result: DrillWordResolutionResult,
  source: ResolutionSource,
  dbOverride?: Firestore,
): Promise<void> {
  const db = dbOverride || adminDb
  if (!db) return

  try {
    const key = normalizeKey(query)
    const ref = db.collection(COLLECTION).doc(key)
    const now = Timestamp.now()

    // Preserve createdAt and hitCount from any existing entry
    const existing = await ref.get()
    const prev = existing.exists ? existing.data() as DrillWordResolutionDoc : null

    const entry: DrillWordResolutionDoc = {
      key,
      query,
      result: sanitizeForFirestore(result as unknown as Record<string, unknown>) as unknown as DrillWordResolutionResult,
      source,
      status: 'resolved',
      cacheVersion: CACHE_VERSION,
      hitCount: prev?.hitCount ?? 1,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: now,
    }

    await ref.set(entry, { merge: true })
  } catch (error) {
    console.error('[DrillResolutionCache] Failed to write resolved entry:', error)
  }
}

/**
 * Store a record indicating the query could not be resolved.
 * Prevents repeated AI calls for permanently unresolvable inputs.
 *
 * Preserves `createdAt` and `hitCount` if the document already exists.
 */
export async function setUnresolved(
  query: string,
  source: ResolutionSource,
  dbOverride?: Firestore,
): Promise<void> {
  const db = dbOverride || adminDb
  if (!db) return

  try {
    const key = normalizeKey(query)
    const ref = db.collection(COLLECTION).doc(key)
    const now = Timestamp.now()

    const existing = await ref.get()
    const prev = existing.exists ? existing.data() as DrillWordResolutionDoc : null

    const entry: DrillWordResolutionDoc = {
      key,
      query,
      result: null,
      source,
      status: 'unresolved',
      cacheVersion: CACHE_VERSION,
      hitCount: prev?.hitCount ?? 1,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: now,
    }

    await ref.set(entry, { merge: true })
  } catch (error) {
    console.error('[DrillResolutionCache] Failed to write unresolved entry:', error)
  }
}

/**
 * Bump `hitCount` and `lastUsedAt` for an existing cache entry.
 * Uses merge-safe `FieldValue.increment` so concurrent calls are safe.
 */
export async function touchHit(
  query: string,
  dbOverride?: Firestore,
): Promise<void> {
  const db = dbOverride || adminDb
  if (!db) return

  try {
    const key = normalizeKey(query)
    const ref = db.collection(COLLECTION).doc(key)

    await ref.update({
      hitCount: FieldValue.increment(1),
      lastUsedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    // Swallow — non-critical. The entry may have been deleted between get and touch.
    console.warn('[DrillResolutionCache] Failed to touch hit:', error)
  }
}
