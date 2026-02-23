#!/usr/bin/env node

/**
 * Check flashcard "due now" counts per deck for a user.
 *
 * Usage:
 *   node scripts/check-flashcard-due-now.js <email-or-uid>
 *   node scripts/check-flashcard-due-now.js emmanuelfabiani23@gmail.com
 *   node scripts/check-flashcard-due-now.js 8onZzlQg3tQxkw8pinSF9ow4Q6j2
 *
 * Notes:
 * - "due now" counts cards where metadata.nextReview <= now
 * - Cards with no metadata.nextReview are also counted as due (matches local SRS helper behavior)
 */

const admin = require('firebase-admin')
const path = require('path')

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json')
const serviceAccount = require(serviceAccountPath)

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
}

const db = admin.firestore()
const auth = admin.auth()

function isEmail(value) {
  return typeof value === 'string' && value.includes('@')
}

async function resolveUser(input) {
  if (!input) {
    throw new Error('Missing email or UID.\nUsage: node scripts/check-flashcard-due-now.js <email-or-uid>')
  }

  if (isEmail(input)) {
    const userRecord = await auth.getUserByEmail(input)
    return {
      uid: userRecord.uid,
      email: userRecord.email || input,
      displayName: userRecord.displayName || null,
    }
  }

  const userRecord = await auth.getUser(input)
  return {
    uid: userRecord.uid,
    email: userRecord.email || null,
    displayName: userRecord.displayName || null,
  }
}

function formatDate(ts) {
  if (typeof ts !== 'number') return 'N/A'
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toISOString()
}

async function main() {
  const input = process.argv[2]
  const now = Date.now()

  try {
    const user = await resolveUser(input)

    console.log('🧮 Flashcard Due-Now Check')
    console.log('━'.repeat(60))
    console.log(`UID:   ${user.uid}`)
    if (user.email) console.log(`Email: ${user.email}`)
    if (user.displayName) console.log(`Name:  ${user.displayName}`)
    console.log(`As of: ${new Date(now).toISOString()}`)
    console.log('━'.repeat(60))

    const snap = await db.collection('flashcardDecks').where('userId', '==', user.uid).get()

    if (snap.empty) {
      console.log('\nNo flashcard decks found for this user.')
      return
    }

    const rows = snap.docs.map((doc) => {
      const d = doc.data() || {}
      const cards = Array.isArray(d.cards) ? d.cards : []
      let dueNow = 0
      let overdueNow = 0
      let noNextReviewCount = 0

      for (const card of cards) {
        const nextReview = card?.metadata?.nextReview
        if (typeof nextReview === 'number') {
          if (nextReview <= now) {
            dueNow += 1
            if (nextReview < now) overdueNow += 1
          }
        } else {
          dueNow += 1
          noNextReviewCount += 1
        }
      }

      return {
        deckId: doc.id,
        name: d.name || '(unnamed)',
        source: d.source || 'unknown',
        cardCount: typeof d.cardCount === 'number' ? d.cardCount : cards.length,
        dueNow,
        overdueNow,
        noNextReviewCount,
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : null,
      }
    })

    rows.sort((a, b) => b.dueNow - a.dueNow || b.cardCount - a.cardCount)

    let totalCards = 0
    let totalDue = 0
    let totalOverdue = 0
    let totalNoNext = 0

    console.log('')
    for (const row of rows) {
      totalCards += row.cardCount
      totalDue += row.dueNow
      totalOverdue += row.overdueNow
      totalNoNext += row.noNextReviewCount

      console.log(`• ${row.name}`)
      console.log(`  Deck ID: ${row.deckId}`)
      console.log(`  Source: ${row.source}`)
      console.log(`  Cards: ${row.cardCount}`)
      console.log(`  Due now: ${row.dueNow}`)
      console.log(`  Overdue now: ${row.overdueNow}`)
      console.log(`  No nextReview (counted due): ${row.noNextReviewCount}`)
      console.log(`  Updated: ${formatDate(row.updatedAt)}`)
      console.log('')
    }

    console.log('Summary')
    console.log('─'.repeat(60))
    console.log(`Decks: ${rows.length}`)
    console.log(`Total cards: ${totalCards}`)
    console.log(`Total due now: ${totalDue}`)
    console.log(`Total overdue now: ${totalOverdue}`)
    console.log(`Total no-nextReview (counted due): ${totalNoNext}`)
  } finally {
    await admin.app().delete()
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message || error)
  process.exit(1)
})
