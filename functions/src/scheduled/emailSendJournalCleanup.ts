import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'

const COLLECTION = 'email_send_journal'
const RETENTION_DAYS = 180
const DELETE_BATCH_SIZE = 400

/**
 * Deletes old email send journal entries to enforce data minimization retention.
 */
export const cleanupEmailSendJournal = onSchedule(
  {
    schedule: '15 2 * * *',
    timeZone: 'UTC',
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 540,
    retryCount: 1,
  },
  async () => {
    const db = admin.firestore()
    const cutoffDate = new Date()
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - RETENTION_DAYS)
    const cutoff = admin.firestore.Timestamp.fromDate(cutoffDate)

    let deleted = 0

    while (true) {
      const snapshot = await db
        .collection(COLLECTION)
        .where('sentAt', '<', cutoff)
        .orderBy('sentAt', 'asc')
        .limit(DELETE_BATCH_SIZE)
        .get()

      if (snapshot.empty) {
        break
      }

      const batch = db.batch()
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref)
      }
      await batch.commit()
      deleted += snapshot.size

      if (snapshot.size < DELETE_BATCH_SIZE) {
        break
      }
    }

    logger.info('[EmailSendJournalCleanup] Completed', {
      collection: COLLECTION,
      retentionDays: RETENTION_DAYS,
      deleted,
    })
  }
)
