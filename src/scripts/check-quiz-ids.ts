/**
 * Check Quiz Question IDs
 *
 * Verifies that all quiz questions have unique IDs
 */

import admin from 'firebase-admin'
import * as path from 'path'

// Initialize Firebase Admin
const serviceAccountPath = path.join(
  process.cwd(),
  'moshimoshi-service-account.json'
)

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

async function checkQuizIds() {
  console.log('🔍 Checking quiz question IDs...\n')

  const collections = [
    { name: 'stories', type: 'story' },
    { name: 'comic_episodes', type: 'comic' },
  ]

  let totalIssues = 0

  for (const collection of collections) {
    console.log(`\n📚 Checking ${collection.name}...`)

    const snapshot = await db.collection(collection.name).get()
    let collectionIssues = 0

    for (const doc of snapshot.docs) {
      const data = doc.data()

      if (!data.quiz?.questions) continue

      const questions = Array.isArray(data.quiz.questions)
        ? data.quiz.questions
        : data.quiz

      if (!Array.isArray(questions)) continue

      // Check for missing IDs
      const missingIds = questions.filter((q: any) => !q.id)
      if (missingIds.length > 0) {
        console.log(`  ❌ ${doc.id}: ${missingIds.length} questions without ID`)
        collectionIssues++
      }

      // Check for duplicate IDs
      const ids = questions.map((q: any) => q.id).filter(Boolean)
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)

      if (duplicates.length > 0) {
        console.log(`  ❌ ${doc.id}: Duplicate IDs found:`, duplicates)
        collectionIssues++
      }

      // Check for undefined/null IDs
      const undefinedIds = questions.filter((q: any) => q.id === undefined || q.id === null)
      if (undefinedIds.length > 0) {
        console.log(`  ❌ ${doc.id}: ${undefinedIds.length} questions with undefined/null ID`)
        collectionIssues++
      }

      // Log successful check
      if (missingIds.length === 0 && duplicates.length === 0 && undefinedIds.length === 0) {
        console.log(`  ✓ ${doc.id}: ${questions.length} questions, all IDs unique`)
      }
    }

    console.log(`\n  ${collectionIssues === 0 ? '✅' : '⚠️'} ${collection.name}: ${collectionIssues} documents with issues`)
    totalIssues += collectionIssues
  }

  console.log(`\n${totalIssues === 0 ? '✅' : '⚠️'} Total issues: ${totalIssues}`)

  process.exit(totalIssues === 0 ? 0 : 1)
}

checkQuizIds().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
