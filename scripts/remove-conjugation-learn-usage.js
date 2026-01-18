#!/usr/bin/env node

const admin = require('firebase-admin')
const path = require('path')

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json')
const serviceAccount = require(serviceAccountPath)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

async function deleteConjugationLearnUsage() {
  const usersSnapshot = await db.collection('users').get()
  let deletedCount = 0

  for (const userDoc of usersSnapshot.docs) {
    const usageRef = userDoc.ref.collection('usage')
    const usageSnapshot = await usageRef.get()
    const targetDocs = usageSnapshot.docs.filter(doc => doc.id.startsWith('conjugation_learn_'))

    if (targetDocs.length === 0) {
      continue
    }

    const batch = db.batch()
    targetDocs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
    deletedCount += targetDocs.length
    console.log(`[remove-conjugation-learn-usage] Deleted ${targetDocs.length} docs for user ${userDoc.id}`)
  }

  console.log(`[remove-conjugation-learn-usage] Done. Deleted ${deletedCount} total docs.`)
}

deleteConjugationLearnUsage()
  .catch(error => {
    console.error('[remove-conjugation-learn-usage] Failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await admin.app().delete()
  })
