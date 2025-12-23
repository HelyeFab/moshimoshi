/**
 * Cleanup Script: Remove correctIndex field from migrated quizzes
 *
 * The migration added correctAnswer and _legacyCorrectIndex correctly,
 * but didn't remove the old correctIndex field. This script removes it.
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

// Initialize Firebase Admin
function initializeFirebaseForScript() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json')

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found at: ${serviceAccountPath}`)
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })

    console.log('✅ Firebase Admin initialized')
  }

  return admin.firestore()
}

async function cleanupCorrectIndex(dryRun = true) {
  const db = initializeFirebaseForScript()

  console.log('\n=== Cleanup correctIndex Field ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  const batch = db.batch()
  let batchOps = 0
  let totalCleaned = 0

  // Process stories
  const stories = await db.collection('stories').where('_migrated', '==', true).get()

  for (const doc of stories.docs) {
    const data = doc.data()
    const cleanedQuiz = data.quiz.map((q: any) => {
      const { correctIndex, ...rest } = q
      return rest
    })

    if (!dryRun) {
      batch.update(doc.ref, { quiz: cleanedQuiz })
      batchOps++

      if (batchOps >= 450) {
        await batch.commit()
        batchOps = 0
      }
    }

    totalCleaned++
    console.log(`✅ Cleaned story ${doc.id}`)
  }

  // Process drafts
  const drafts = await db.collection('ai_story_drafts').where('_migrated', '==', true).get()

  for (const doc of drafts.docs) {
    const data = doc.data()
    const cleanedQuiz = data.quiz.map((q: any) => {
      const { correctIndex, ...rest } = q
      return rest
    })

    if (!dryRun) {
      batch.update(doc.ref, { quiz: cleanedQuiz })
      batchOps++

      if (batchOps >= 450) {
        await batch.commit()
        batchOps = 0
      }
    }

    totalCleaned++
    console.log(`✅ Cleaned draft ${doc.id}`)
  }

  // Commit remaining
  if (!dryRun && batchOps > 0) {
    await batch.commit()
  }

  console.log(`\nTotal documents cleaned: ${totalCleaned}`)
  console.log(dryRun ? '\n⚠️  This was a DRY RUN' : '\n✅ Cleanup completed!')

  process.exit(0)
}

const isDryRun = process.argv.includes('--dry-run')
cleanupCorrectIndex(isDryRun).catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
