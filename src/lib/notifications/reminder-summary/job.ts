import { CampaignService } from '@/lib/email/campaigns/service'
import { adminAuth, getAdminDb, Timestamp } from '@/lib/firebase/admin'
import {
  computeEligibleFeaturesForUser,
  getFeatureForPath,
  type FeatureUsageSnapshot,
  type PageVisitRecord,
} from '@/lib/notifications/reminder-summary/eligibility'

const DEFAULT_APP_URL = 'https://moshimoshi.app'
const DEFAULT_CTA_PATH = '/review'
const DEFAULT_SUBJECT = 'Continue your Japanese learning today'
const PAGE_VISIT_SCAN_WINDOW_HOURS = 72
const PAGE_VISIT_SCAN_PAGE_SIZE = 1000
const MAX_PAGE_VISITS_SCANNED = 100000

export interface EligibleReminderUser {
  uid: string
  email: string
  timezone: string
  localDateKey: string
  features: FeatureUsageSnapshot[]
}

export interface ReminderSummaryJobResult {
  startedAt: string
  completedAt: string
  scannedVisits: number
  candidateUsers: number
  eligibleUsers: number
  campaignsCreated: number
  campaignsSent: number
  duplicatesSkipped: number
  skippedWithoutEmail: number
  warnings: string[]
  sampleEligibleUsers: Array<{
    uid: string
    localDateKey: string
    timezone: string
    features: string[]
  }>
}

function resolveTimezone(preferences: Record<string, any> | undefined): string {
  const timezone = preferences?.quiet_hours?.timezone
  if (typeof timezone === 'string' && timezone.trim().length > 0) {
    return timezone.trim()
  }
  return 'UTC'
}

function buildFeatureListHtml(features: FeatureUsageSnapshot[], appUrl: string): string {
  const escaped = features
    .map((feature) => {
      const url = new URL(feature.featureUrl, appUrl).toString()
      return `<li><a href="${url}" style="color:#2563eb;text-decoration:none;">${feature.featureName}</a></li>`
    })
    .join('')

  return `<ul>${escaped}</ul>`
}

function buildFeatureListText(features: FeatureUsageSnapshot[], appUrl: string): string {
  return features
    .map((feature) => {
      const url = new URL(feature.featureUrl, appUrl).toString()
      return `- ${feature.featureName}: ${url}`
    })
    .join('\n')
}

async function fetchPreferencesMap(
  userIds: string[]
): Promise<Map<string, Record<string, any> | undefined>> {
  const db = getAdminDb()
  const result = new Map<string, Record<string, any> | undefined>()
  const batchSize = 500

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    const refs = batch.map((uid) => db.collection('notifications_preferences').doc(uid))
    const snapshots = await db.getAll(...refs)
    snapshots.forEach((snapshot, index) => {
      result.set(batch[index], snapshot.exists ? (snapshot.data() as Record<string, any>) : undefined)
    })
  }

  return result
}

async function fetchUserEmails(userIds: string[]): Promise<Map<string, string>> {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth is not initialized')
  }

  const result = new Map<string, string>()
  const batchSize = 100

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    const response = await adminAuth.getUsers(batch.map((uid) => ({ uid })))
    for (const user of response.users) {
      if (user.email) {
        result.set(user.uid, user.email)
      }
    }
  }

  return result
}

async function scanRecentPageVisits(now: Date): Promise<{
  scannedVisits: number
  visitsByUser: Map<string, PageVisitRecord[]>
}> {
  const db = getAdminDb()
  const lowerBound = new Date(now.getTime() - PAGE_VISIT_SCAN_WINDOW_HOURS * 60 * 60 * 1000)
  const lowerBoundTimestamp = Timestamp.fromDate(lowerBound)

  let scannedVisits = 0
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null
  const visitsByUser = new Map<string, PageVisitRecord[]>()

  while (scannedVisits < MAX_PAGE_VISITS_SCANNED) {
    let query = db
      .collection('page_visits')
      .where('startedAt', '>=', lowerBoundTimestamp)
      .orderBy('startedAt', 'desc')
      .limit(PAGE_VISIT_SCAN_PAGE_SIZE)

    if (cursor) {
      query = query.startAfter(cursor)
    }

    const snapshot = await query.get()
    if (snapshot.empty) {
      break
    }

    for (const doc of snapshot.docs) {
      if (scannedVisits >= MAX_PAGE_VISITS_SCANNED) {
        break
      }

      scannedVisits++
      const data = doc.data() as Record<string, any>
      const userId = data.userId
      const path = data.path
      const startedAt = data.startedAt

      if (typeof userId !== 'string' || !userId.trim()) {
        continue
      }
      if (typeof path !== 'string' || !path.trim()) {
        continue
      }
      if (!startedAt || typeof startedAt.toDate !== 'function') {
        continue
      }
      if (!getFeatureForPath(path)) {
        continue
      }

      const userVisits = visitsByUser.get(userId) || []
      userVisits.push({
        userId,
        path,
        startedAt: startedAt.toDate(),
      })
      visitsByUser.set(userId, userVisits)
    }

    cursor = snapshot.docs[snapshot.docs.length - 1]
    if (snapshot.size < PAGE_VISIT_SCAN_PAGE_SIZE) {
      break
    }
  }

  return { scannedVisits, visitsByUser }
}

function campaignDocId(localDateKey: string, uid: string): string {
  return `reminder_summary_${localDateKey}_${uid}`
}

function campaignName(localDateKey: string, uid: string): string {
  return `Daily Reminder Summary ${localDateKey} (${uid.slice(0, 8)})`
}

function emailDisplayName(email: string): string {
  const prefix = email.split('@')[0] || ''
  if (!prefix) return 'Learner'
  return prefix
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function resolveServerAppUrl(): string {
  return process.env.APP_URL || process.env.SERVER_APP_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL
}

function isRunningWithFirebaseEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
}

export async function runReminderSummaryDailyJob(params?: {
  now?: Date
  dryRun?: boolean
  maxUsers?: number
}): Promise<ReminderSummaryJobResult> {
  const startedAt = new Date()
  const now = params?.now || startedAt
  const dryRun = params?.dryRun === true
  const maxUsers = params?.maxUsers
  const appUrl = resolveServerAppUrl()
  const ctaUrl = new URL(DEFAULT_CTA_PATH, appUrl).toString()
  const templateId = process.env.REMINDER_SUMMARY_TEMPLATE_ID
  const emulatorMode = isRunningWithFirebaseEmulator()
  const allowEmailSendInEmulator = process.env.ALLOW_EMAIL_SEND_IN_EMULATOR === 'true'

  const warnings: string[] = []
  if (!templateId) {
    warnings.push(
      'REMINDER_SUMMARY_TEMPLATE_ID is not set. Campaign dispatch is disabled until the template is configured.'
    )
  }
  if (emulatorMode && !allowEmailSendInEmulator) {
    warnings.push(
      'Firebase emulator detected. Skipping campaign send; set ALLOW_EMAIL_SEND_IN_EMULATOR=true to override.'
    )
  }

  const { scannedVisits, visitsByUser } = await scanRecentPageVisits(now)
  const candidateUserIds = Array.from(visitsByUser.keys())
  const prefsMap = await fetchPreferencesMap(candidateUserIds)

  const eligibleByUid = new Map<string, { timezone: string; localDateKey: string; features: FeatureUsageSnapshot[] }>()

  for (const uid of candidateUserIds) {
    const visits = visitsByUser.get(uid) || []
    const preferences = prefsMap.get(uid)
    const timezone = resolveTimezone(preferences)

    const computed = computeEligibleFeaturesForUser({
      now,
      timezone,
      visits,
      preferences,
    })

    if (computed.features.length > 0) {
      eligibleByUid.set(uid, {
        timezone,
        localDateKey: computed.localDateKey,
        features: computed.features,
      })
    }
  }

  let eligibleUserIds = Array.from(eligibleByUid.keys())
  if (typeof maxUsers === 'number' && maxUsers > 0) {
    eligibleUserIds = eligibleUserIds.slice(0, maxUsers)
  }

  const emailMap = await fetchUserEmails(eligibleUserIds)
  const users: EligibleReminderUser[] = []
  let skippedWithoutEmail = 0

  for (const uid of eligibleUserIds) {
    const email = emailMap.get(uid)
    if (!email) {
      skippedWithoutEmail++
      continue
    }
    const data = eligibleByUid.get(uid)
    if (!data) continue
    users.push({
      uid,
      email,
      timezone: data.timezone,
      localDateKey: data.localDateKey,
      features: data.features,
    })
  }

  const db = getAdminDb()
  const campaignService = new CampaignService()
  let campaignsCreated = 0
  let campaignsSent = 0
  let duplicatesSkipped = 0

  for (const user of users) {
    const id = campaignDocId(user.localDateKey, user.uid)
    const campaignRef = db.collection('email_campaigns').doc(id)
    const existing = await campaignRef.get()

    if (existing.exists) {
      duplicatesSkipped++
      continue
    }

    const topFeatures = user.features.map((feature) => ({
      key: feature.featureKey,
      name: feature.featureName,
      url: new URL(feature.featureUrl, appUrl).toString(),
    }))

    const variables: Record<string, string> = {
      userName: emailDisplayName(user.email),
      topFeatures: JSON.stringify(topFeatures),
      topFeaturesHtml: buildFeatureListHtml(user.features, appUrl),
      topFeaturesText: buildFeatureListText(user.features, appUrl),
      ctaUrl,
      summaryDate: user.localDateKey,
    }

    const campaignPayload: Record<string, any> = {
      name: campaignName(user.localDateKey, user.uid),
      template: 'custom',
      subject: DEFAULT_SUBJECT,
      segment: {
        type: 'custom_emails',
        respectMarketingPrefs: false,
        emailVerifiedOnly: false,
        customEmails: [user.email],
      },
      status: 'draft',
      stats: {
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
      },
      createdBy: 'system:reminder-summary-job',
      createdAt: Timestamp.now(),
      errors: [],
      templateVariables: variables,
      metadata: {
        type: 'reminder_summary_daily',
        userId: user.uid,
        localDateKey: user.localDateKey,
        timezone: user.timezone,
      },
    }

    if (templateId) {
      campaignPayload.templateId = templateId
    }

    if (!dryRun) {
      await campaignRef.set(campaignPayload)
      campaignsCreated++
      if (templateId && (!emulatorMode || allowEmailSendInEmulator)) {
        await campaignService.sendCampaign(id)
        campaignsSent++
      }
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    scannedVisits,
    candidateUsers: candidateUserIds.length,
    eligibleUsers: users.length,
    campaignsCreated,
    campaignsSent,
    duplicatesSkipped,
    skippedWithoutEmail,
    warnings,
    sampleEligibleUsers: users.slice(0, 10).map((user) => ({
      uid: user.uid,
      localDateKey: user.localDateKey,
      timezone: user.timezone,
      features: user.features.map((f) => f.featureKey),
    })),
  }
}
