'use strict'

/**
 * Quick Firestore inspector for kana progress.
 * Usage: node scripts/check-kana-progress.js <userId> [serviceAccountPath]
 */

const path = require('path')
const admin = require('firebase-admin')

async function main() {
  const userId = process.argv[2] || '8onZzlQg3tQxkw8pinSF9ow4Q6j2'
  const serviceAccountPath =
    process.argv[3] || path.resolve(__dirname, '..', 'moshimoshi-service-account.json')

  // Initialize Firebase Admin using the provided service account
  const serviceAccount = require(serviceAccountPath)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }

  const db = admin.firestore()
  const scripts = ['hiragana', 'katakana', 'kanji']

  console.log(`Checking kana progress for user: ${userId}\n`)

  for (const script of scripts) {
    const docRef = db.doc(`users/${userId}/progress/${script}`)
    const snap = await docRef.get()

    if (!snap.exists) {
      console.log(`[${script}] No document found.`)
      continue
    }

    const data = snap.data()
    const items = data.items || data.characters || {}
    const learnedCount = Object.values(items).filter(c => c?.status === 'learned').length
    const learningCount = Object.values(items).filter(c => c?.status === 'learning').length
    const total = Object.keys(items).length

    console.log(`[${script}]`)
    console.log(`- total characters stored: ${total}`)
    console.log(`- learned: ${learnedCount}`)
    console.log(`- learning: ${learningCount}`)
    const ts = data.updatedAt || data.lastUpdated
    console.log(`- last updated: ${ts?.toDate ? ts.toDate() : ts}`)
    console.log('')
  }

  await admin.app().delete()
}

main().catch(err => {
  console.error('Error while checking progress:', err)
  process.exit(1)
})
