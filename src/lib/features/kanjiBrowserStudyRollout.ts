import { isFeatureEnabled } from '@/lib/features/featureFlags'

const INTERNAL_ALLOWLIST = new Set([
  'emmanuelfabiani23@gmail.com',
])

export function isKanjiBrowserStudyEnabledForEmail(email?: string | null): boolean {
  if (isFeatureEnabled('KANJI_BROWSER_STUDY')) {
    return true
  }

  if (!email) {
    return false
  }

  return INTERNAL_ALLOWLIST.has(email.trim().toLowerCase())
}
