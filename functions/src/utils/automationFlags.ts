import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'

export type AutomationFlag = 'STORY_AUTOMATION' | 'NEWS_AUTOMATION' | 'COMICS_AUTOMATION'

const db = admin.firestore()

/**
 * Reads automation toggle from config/featureFlags.
 * Defaults to enabled on missing/invalid data to avoid accidental outages.
 */
export async function isAutomationEnabled(
  flag: AutomationFlag,
  defaultEnabled: boolean = true
): Promise<boolean> {
  try {
    const flagsDoc = await db.collection('config').doc('featureFlags').get()
    if (!flagsDoc.exists) {
      return defaultEnabled
    }

    const value = flagsDoc.get(flag)
    return typeof value === 'boolean' ? value : defaultEnabled
  } catch (error) {
    logger.warn('[AutomationFlags] Failed to read automation flag, using default', {
      flag,
      defaultEnabled,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return defaultEnabled
  }
}
