import type { FeatureId } from '@/types/FeatureId'
import type { PlanType } from '@/types/entitlements'
import { getLimit, isUnlimited, POLICY_VERSION } from '@/lib/entitlements/policy'
import featuresConfig from '../../../config/features.v1.json'

type SnapshotTier = 'premium' | 'free' | 'guest'

export interface EntitlementsSnapshotPayload {
  userId: string
  tier: SnapshotTier
  issuedAt: string
  expiresAt: string
  policyVersion: number
}

const SNAPSHOT_STORAGE_KEY = 'entitlementsSnapshot'

const FEATURE_LIMIT_TYPES = featuresConfig.features.reduce(
  (acc, feature) => {
    acc[feature.id as FeatureId] = feature.limitType as 'daily' | 'monthly'
    return acc
  },
  {} as Record<FeatureId, 'daily' | 'monthly'>
)

let cachedSnapshot: EntitlementsSnapshotPayload | null = null
let cachedSnapshotExpiresAt = 0

export function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false
  return !navigator.onLine
}

export function getCachedEntitlementsTier(): SnapshotTier | null {
  if (!cachedSnapshot) return null
  if (cachedSnapshotExpiresAt <= Date.now()) {
    cachedSnapshot = null
    cachedSnapshotExpiresAt = 0
    return null
  }
  return cachedSnapshot.tier
}

export function mapSnapshotTierToPlan(tier: SnapshotTier): PlanType {
  if (tier === 'premium') return 'premium_monthly'
  return tier
}

export function isFeatureUnlimitedForPlan(featureId: FeatureId, plan: PlanType): boolean {
  const limitType = FEATURE_LIMIT_TYPES[featureId]
  if (!limitType) return false
  const limit = getLimit(plan, limitType, featureId)
  return isUnlimited(limit)
}

function getPublicKeyPem(): string | null {
  if (typeof window === 'undefined') return null
  const key = process.env.NEXT_PUBLIC_ENTITLEMENTS_PUBLIC_KEY
  if (!key) return null
  return key.replace(/\\n/g, '\n')
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}

function decodeJwtPayload(token: string): EntitlementsSnapshotPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payloadBytes = base64UrlToUint8Array(parts[1])
    const payloadJson = new TextDecoder().decode(payloadBytes)
    return JSON.parse(payloadJson) as EntitlementsSnapshotPayload
  } catch {
    return null
  }
}

async function importPublicKey(pem: string): Promise<CryptoKey | null> {
  try {
    const body = pem.replace(/-----BEGIN PUBLIC KEY-----/, '').replace(/-----END PUBLIC KEY-----/, '').replace(/\s+/g, '')
    const binary = atob(body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return await crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )
  } catch {
    return null
  }
}

async function verifyJwtSignature(token: string, publicKeyPem: string): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64UrlToUint8Array(parts[2]).buffer as ArrayBuffer
  const key = await importPublicKey(publicKeyPem)
  if (!key) return false
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)
}

export async function validateEntitlementsSnapshot(token: string): Promise<EntitlementsSnapshotPayload | null> {
  if (!token) return null
  if (typeof window === 'undefined') return null
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const publicKeyPem = getPublicKeyPem()
  if (!publicKeyPem) return null
  const payload = decodeJwtPayload(token)
  if (!payload?.expiresAt || !payload.tier) return null
  const expiresAtMs = Date.parse(payload.expiresAt)
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) return null
  const valid = await verifyJwtSignature(token, publicKeyPem)
  if (!valid) return null
  cachedSnapshot = payload
  cachedSnapshotExpiresAt = expiresAtMs
  return payload
}

export async function getValidatedEntitlementsSnapshot(): Promise<EntitlementsSnapshotPayload | null> {
  if (cachedSnapshot && cachedSnapshotExpiresAt > Date.now()) {
    return cachedSnapshot
  }
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(SNAPSHOT_STORAGE_KEY)
  if (!token) return null
  return validateEntitlementsSnapshot(token)
}

export async function storeEntitlementsSnapshotToken(token: string): Promise<EntitlementsSnapshotPayload | null> {
  if (typeof window === 'undefined') return null
  const payload = await validateEntitlementsSnapshot(token)
  if (!payload) {
    localStorage.removeItem(SNAPSHOT_STORAGE_KEY)
    return null
  }
  localStorage.setItem(SNAPSHOT_STORAGE_KEY, token)
  return payload
}

export function getSnapshotPolicyVersion(payload: EntitlementsSnapshotPayload | null): number {
  return payload?.policyVersion ?? POLICY_VERSION
}
