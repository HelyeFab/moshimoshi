import type { FeatureId } from '@/types/FeatureId'

export interface UsageSnapshotEntry {
  used: number
  limit: number
  resetAtUtc: string
}

export type UsageSnapshot = Partial<Record<FeatureId, UsageSnapshotEntry>>
export type OfflineUsageDelta = Partial<Record<FeatureId, number>>

const USAGE_SNAPSHOT_KEY = 'usageSnapshot'
const OFFLINE_USAGE_DELTA_KEY = 'offlineUsageDelta'

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

export function readUsageSnapshot(): UsageSnapshot {
  return readJson<UsageSnapshot>(USAGE_SNAPSHOT_KEY) || {}
}

export function writeUsageSnapshot(snapshot: UsageSnapshot): void {
  writeJson(USAGE_SNAPSHOT_KEY, snapshot)
}

export function getUsageSnapshotEntry(featureId: FeatureId): UsageSnapshotEntry | null {
  const snapshot = readUsageSnapshot()
  return snapshot[featureId] || null
}

export function updateUsageSnapshotEntry(featureId: FeatureId, entry: UsageSnapshotEntry): void {
  const snapshot = readUsageSnapshot()
  snapshot[featureId] = entry
  writeUsageSnapshot(snapshot)
}

export function readOfflineUsageDelta(): OfflineUsageDelta {
  return readJson<OfflineUsageDelta>(OFFLINE_USAGE_DELTA_KEY) || {}
}

export function getOfflineUsageDelta(featureId: FeatureId): number {
  const delta = readOfflineUsageDelta()
  return delta[featureId] || 0
}

export function incrementOfflineUsageDelta(featureId: FeatureId, amount: number = 1): number {
  const delta = readOfflineUsageDelta()
  const next = (delta[featureId] || 0) + amount
  delta[featureId] = next
  writeJson(OFFLINE_USAGE_DELTA_KEY, delta)
  return next
}

export function clearOfflineUsageDelta(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(OFFLINE_USAGE_DELTA_KEY)
}

export function updateUsageSnapshotFromDecision(
  featureId: FeatureId,
  decision: { limit?: number; resetAtUtc?: string; usageBefore?: number; allow?: boolean },
  incremented: boolean
): void {
  if (typeof decision.limit !== 'number' || !decision.resetAtUtc) return
  if (decision.limit < 0) return
  const usageBefore = decision.usageBefore ?? 0
  const used = incremented && decision.allow ? usageBefore + 1 : usageBefore
  updateUsageSnapshotEntry(featureId, {
    used,
    limit: decision.limit,
    resetAtUtc: decision.resetAtUtc
  })
}

let syncPromise: Promise<void> | null = null

export async function syncOfflineUsageDelta(): Promise<void> {
  if (typeof window === 'undefined') return
  if (syncPromise) return syncPromise
  const deltas = readOfflineUsageDelta()
  const entries = Object.entries(deltas).filter(([, value]) => typeof value === 'number' && value > 0)
  if (entries.length === 0) return

  const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  syncPromise = fetch('/api/usage/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      deltas,
      clientTimestamp: new Date().toISOString(),
      idempotencyKey
    })
  }).then(async response => {
    if (!response.ok) {
      throw new Error('Failed to sync offline usage')
    }
    const payload = await response.json()
    if (payload?.snapshots) {
      const snapshot = readUsageSnapshot()
      for (const [featureId, entry] of Object.entries(payload.snapshots)) {
        snapshot[featureId as FeatureId] = entry as UsageSnapshotEntry
      }
      writeUsageSnapshot(snapshot)
    }
    clearOfflineUsageDelta()
  }).finally(() => {
    syncPromise = null
  })

  return syncPromise
}
