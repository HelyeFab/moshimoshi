#!/usr/bin/env node

/**
 * Comprehensive Deck Checker
 *
 * Checks ALL storage locations for a user's flashcard and Anki decks:
 *
 *   FIREBASE:
 *     - flashcardDecks          (user-created decks synced to Firebase)
 *     - anki_r2_backups         (Anki deck R2 backup metadata)
 *     - userFlashcardDecks      (user deck R2 backup metadata)
 *     - r2Usage                 (per-user R2 storage usage)
 *     - users/{uid}/deletedAnkiDecks       (Anki deletion tombstones)
 *     - users/{uid}/deletedFlashcardDecks  (user deck deletion tombstones)
 *
 *   R2 (CLOUDFLARE):
 *     - users/{uid}/decks/{deckId}/        (Anki deck backups)
 *     - users/{uid}/flashcards/{deckId}/   (user deck backups)
 *
 * Usage:
 *   node scripts/check-all-decks.js <email-or-uid>
 *
 * Examples:
 *   node scripts/check-all-decks.js emmanuelfabiani23@gmail.com
 *   node scripts/check-all-decks.js 8onZzlQg3tQxkw8pinSF9ow4Q6j2
 */

const admin = require('firebase-admin')
const path = require('path')
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

// ── Firebase init ──────────────────────────────────────────────────────────────
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
}
const db = admin.firestore()
const auth = admin.auth()

// ── R2 init ────────────────────────────────────────────────────────────────────
const r2Client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})
const R2_BUCKET = process.env.R2_BUCKET

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(ts) {
  if (!ts) return 'N/A'
  if (ts._seconds) return new Date(ts._seconds * 1000).toISOString()
  if (ts.toDate) return ts.toDate().toISOString()
  if (typeof ts === 'number') return new Date(ts).toISOString()
  if (ts instanceof Date) return ts.toISOString()
  return String(ts)
}

function header(title) {
  console.log('')
  console.log('═'.repeat(80))
  console.log(`  ${title}`)
  console.log('═'.repeat(80))
}

function subheader(title) {
  console.log('')
  console.log(`  ── ${title} ${'─'.repeat(Math.max(0, 72 - title.length))}`)
}

async function resolveUser(input) {
  if (!input) {
    console.error('Usage: node scripts/check-all-decks.js <email-or-uid>')
    process.exit(1)
  }
  const isEmail = input.includes('@')
  const userRecord = isEmail
    ? await auth.getUserByEmail(input)
    : await auth.getUser(input)
  return {
    uid: userRecord.uid,
    email: userRecord.email || null,
    displayName: userRecord.displayName || null,
  }
}

async function listR2Objects(prefix) {
  const objects = []
  let continuationToken
  do {
    const res = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    )
    if (res.Contents) objects.push(...res.Contents)
    continuationToken = res.NextContinuationToken
  } while (continuationToken)
  return objects
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const input = process.argv[2]
  const user = await resolveUser(input)

  console.log('')
  console.log('╔' + '═'.repeat(78) + '╗')
  console.log('║  COMPREHENSIVE DECK CHECK' + ' '.repeat(52) + '║')
  console.log('╚' + '═'.repeat(78) + '╝')
  console.log(`  UID:   ${user.uid}`)
  if (user.email) console.log(`  Email: ${user.email}`)
  if (user.displayName) console.log(`  Name:  ${user.displayName}`)
  console.log(`  Time:  ${new Date().toISOString()}`)

  // Collect all deck IDs across all sources for the summary
  const allDecks = new Map() // deckId -> { name, locations: [] }

  function track(deckId, name, location, details) {
    if (!allDecks.has(deckId)) {
      allDecks.set(deckId, { name: name || '(unknown)', locations: [] })
    }
    const entry = allDecks.get(deckId)
    if (name && entry.name === '(unknown)') entry.name = name
    entry.locations.push({ location, ...details })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. FIREBASE: flashcardDecks
  // ════════════════════════════════════════════════════════════════════════════
  header('1. FIREBASE: flashcardDecks (user-created decks)')

  const fcSnap = await db.collection('flashcardDecks').where('userId', '==', user.uid).get()
  if (fcSnap.empty) {
    console.log('  (none)')
  } else {
    console.log(`  Found ${fcSnap.size} deck(s)`)
    fcSnap.forEach((doc) => {
      const d = doc.data()
      const cards = d.cardCount || d.cards?.length || 0
      console.log(`  • ${d.name || '(unnamed)'}`)
      console.log(`    ID: ${doc.id}  |  Cards: ${cards}  |  Source: ${d.source || 'user'}`)
      console.log(`    Created: ${formatDate(d.createdAt)}  |  Updated: ${formatDate(d.updatedAt)}`)
      track(doc.id, d.name, 'flashcardDecks', { cards, source: d.source || 'user' })
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. FIREBASE: anki_r2_backups
  // ════════════════════════════════════════════════════════════════════════════
  header('2. FIREBASE: anki_r2_backups (Anki R2 backup metadata)')

  const ankiBackupSnap = await db.collection('anki_r2_backups').where('userId', '==', user.uid).get()
  if (ankiBackupSnap.empty) {
    console.log('  (none)')
  } else {
    console.log(`  Found ${ankiBackupSnap.size} backup(s)`)
    ankiBackupSnap.forEach((doc) => {
      const d = doc.data()
      console.log(`  • ${d.name || '(unnamed)'}`)
      console.log(`    ID: ${doc.id}  |  Cards: ${d.cardCount || 'N/A'}  |  Size: ${formatBytes(d.totalBytes)}`)
      console.log(`    Has media: ${d.hasMedia}  |  Origin: ${d.origin || 'import'}`)
      console.log(`    Updated: ${formatDate(d.updatedAt)}`)
      track(doc.id, d.name, 'anki_r2_backups', { cards: d.cardCount, bytes: d.totalBytes })
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. FIREBASE: userFlashcardDecks
  // ════════════════════════════════════════════════════════════════════════════
  header('3. FIREBASE: userFlashcardDecks (user deck R2 backup metadata)')

  const ufdSnap = await db.collection('userFlashcardDecks').where('userId', '==', user.uid).get()
  if (ufdSnap.empty) {
    console.log('  (none)')
  } else {
    console.log(`  Found ${ufdSnap.size} backup(s)`)
    ufdSnap.forEach((doc) => {
      const d = doc.data()
      console.log(`  • ${d.name || '(unnamed)'}`)
      console.log(`    ID: ${doc.id}  |  Cards: ${d.cardCount || 'N/A'}  |  Size: ${formatBytes(d.totalBytes)}`)
      console.log(`    Updated: ${formatDate(d.updatedAt)}`)
      track(doc.id, d.name, 'userFlashcardDecks', { cards: d.cardCount, bytes: d.totalBytes })
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 4. FIREBASE: deletedAnkiDecks tombstones
  // ════════════════════════════════════════════════════════════════════════════
  header('4. FIREBASE: users/{uid}/deletedAnkiDecks (tombstones)')

  const delAnkiSnap = await db.collection('users').doc(user.uid).collection('deletedAnkiDecks').get()
  if (delAnkiSnap.empty) {
    console.log('  (none)')
  } else {
    console.log(`  Found ${delAnkiSnap.size} tombstone(s)`)
    delAnkiSnap.forEach((doc) => {
      const d = doc.data()
      console.log(`  • ID: ${doc.id}  |  Deleted: ${formatDate(d.deletedAt)}  |  Origin: ${d.origin || 'import'}`)
      track(doc.id, null, 'deletedAnkiDecks (tombstone)', { deletedAt: d.deletedAt })
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. FIREBASE: deletedFlashcardDecks tombstones
  // ════════════════════════════════════════════════════════════════════════════
  header('5. FIREBASE: users/{uid}/deletedFlashcardDecks (tombstones)')

  const delFcSnap = await db.collection('users').doc(user.uid).collection('deletedFlashcardDecks').get()
  if (delFcSnap.empty) {
    console.log('  (none)')
  } else {
    console.log(`  Found ${delFcSnap.size} tombstone(s)`)
    delFcSnap.forEach((doc) => {
      const d = doc.data()
      console.log(`  • ID: ${doc.id}  |  Deleted: ${formatDate(d.deletedAt)}`)
      track(doc.id, null, 'deletedFlashcardDecks (tombstone)', { deletedAt: d.deletedAt })
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. FIREBASE: r2Usage
  // ════════════════════════════════════════════════════════════════════════════
  header('6. FIREBASE: r2Usage (storage quota)')

  const r2UsageDoc = await db.collection('r2Usage').doc(user.uid).get()
  if (!r2UsageDoc.exists) {
    console.log('  (no r2Usage record)')
  } else {
    const d = r2UsageDoc.data()
    console.log(`  Total bytes: ${formatBytes(d.totalBytes)}`)
    console.log(`  Last updated: ${formatDate(d.lastUpdated)}`)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. R2: Anki deck backups (users/{uid}/decks/)
  // ════════════════════════════════════════════════════════════════════════════
  header('7. R2: Anki deck backups (users/{uid}/decks/)')

  if (!R2_BUCKET) {
    console.log('  ⚠️  R2_BUCKET not configured, skipping R2 checks')
  } else {
    const ankiR2Prefix = `users/${user.uid}/decks/`
    const ankiR2Objects = await listR2Objects(ankiR2Prefix)

    if (ankiR2Objects.length === 0) {
      console.log('  (none)')
    } else {
      const ankiR2Decks = {}
      for (const obj of ankiR2Objects) {
        const rel = obj.Key.replace(ankiR2Prefix, '')
        const match = rel.match(/^([^/]+)\/(.+)$/)
        if (match) {
          const [, deckId, fileName] = match
          if (!ankiR2Decks[deckId]) ankiR2Decks[deckId] = { files: [], totalSize: 0, mediaCount: 0 }
          ankiR2Decks[deckId].files.push({ name: fileName, size: obj.Size, lastModified: obj.LastModified })
          ankiR2Decks[deckId].totalSize += obj.Size || 0
          if (fileName.startsWith('media/')) ankiR2Decks[deckId].mediaCount++
        }
      }

      const deckIds = Object.keys(ankiR2Decks)
      console.log(`  Found ${deckIds.length} deck(s) (${ankiR2Objects.length} total objects)`)
      for (const deckId of deckIds) {
        const deck = ankiR2Decks[deckId]
        const hasApkg = deck.files.some((f) => f.name === 'package.apkg')
        const hasManifest = deck.files.some((f) => f.name === 'manifest.json')
        console.log(`  • Deck ID: ${deckId}`)
        console.log(`    Size: ${formatBytes(deck.totalSize)}  |  Files: ${deck.files.length}  |  Media: ${deck.mediaCount}`)
        console.log(`    Has package.apkg: ${hasApkg ? '✅' : '❌'}  |  Has manifest.json: ${hasManifest ? '✅' : '❌'}`)
        track(deckId, null, 'R2 anki backup', { bytes: deck.totalSize, files: deck.files.length, media: deck.mediaCount })
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. R2: User deck backups (users/{uid}/flashcards/)
  // ════════════════════════════════════════════════════════════════════════════
  header('8. R2: User deck backups (users/{uid}/flashcards/)')

  if (!R2_BUCKET) {
    console.log('  ⚠️  R2_BUCKET not configured, skipping')
  } else {
    const userR2Prefix = `users/${user.uid}/flashcards/`
    const userR2Objects = await listR2Objects(userR2Prefix)

    if (userR2Objects.length === 0) {
      console.log('  (none)')
    } else {
      const userR2Decks = {}
      for (const obj of userR2Objects) {
        const rel = obj.Key.replace(userR2Prefix, '')
        const match = rel.match(/^([^/]+)\/(.+)$/)
        if (match) {
          const [, deckId, fileName] = match
          if (!userR2Decks[deckId]) userR2Decks[deckId] = { files: [], totalSize: 0, mediaCount: 0 }
          userR2Decks[deckId].files.push({ name: fileName, size: obj.Size, lastModified: obj.LastModified })
          userR2Decks[deckId].totalSize += obj.Size || 0
          if (fileName.startsWith('media/')) userR2Decks[deckId].mediaCount++
        }
      }

      const deckIds = Object.keys(userR2Decks)
      console.log(`  Found ${deckIds.length} deck(s) (${userR2Objects.length} total objects)`)
      for (const deckId of deckIds) {
        const deck = userR2Decks[deckId]
        const hasCards = deck.files.some((f) => f.name === 'cards.json')
        const hasManifest = deck.files.some((f) => f.name === 'manifest.json')
        console.log(`  • Deck ID: ${deckId}`)
        console.log(`    Size: ${formatBytes(deck.totalSize)}  |  Files: ${deck.files.length}  |  Media: ${deck.mediaCount}`)
        console.log(`    Has cards.json: ${hasCards ? '✅' : '❌'}  |  Has manifest.json: ${hasManifest ? '✅' : '❌'}`)
        track(deckId, null, 'R2 user backup', { bytes: deck.totalSize, files: deck.files.length, media: deck.mediaCount })
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 9. DUE CARDS: Check active decks in Firebase for due/overdue cards
  // ════════════════════════════════════════════════════════════════════════════
  header('9. DUE CARDS (active decks in flashcardDecks)')

  const now = Date.now()
  if (fcSnap.empty) {
    console.log('  (no active decks in Firebase)')
  } else {
    let totalDue = 0
    let totalOverdue = 0
    let totalCards = 0

    const dueRows = fcSnap.docs.map((doc) => {
      const d = doc.data()
      const cards = Array.isArray(d.cards) ? d.cards : []
      let dueNow = 0
      let overdueNow = 0
      let noNextReview = 0

      for (const card of cards) {
        const nextReview = card?.metadata?.nextReview
        if (typeof nextReview === 'number') {
          if (nextReview <= now) {
            dueNow++
            if (nextReview < now) overdueNow++
          }
        } else {
          dueNow++
          noNextReview++
        }
      }

      return {
        name: d.name || '(unnamed)',
        deckId: doc.id,
        cardCount: cards.length,
        dueNow,
        overdueNow,
        noNextReview,
      }
    })

    dueRows.sort((a, b) => b.dueNow - a.dueNow)

    for (const row of dueRows) {
      totalCards += row.cardCount
      totalDue += row.dueNow
      totalOverdue += row.overdueNow

      const dueLabel = row.dueNow > 0 ? `⏰ ${row.dueNow} due` : '✅ 0 due'
      const overdueLabel = row.overdueNow > 0 ? ` (${row.overdueNow} overdue)` : ''
      const noReviewLabel = row.noNextReview > 0 ? ` [${row.noNextReview} never reviewed]` : ''
      console.log(`  • ${row.name}  —  ${row.cardCount} cards  |  ${dueLabel}${overdueLabel}${noReviewLabel}`)
    }

    console.log('')
    console.log(`  Total: ${totalCards} cards, ${totalDue} due, ${totalOverdue} overdue`)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY: Cross-reference all sources
  // ════════════════════════════════════════════════════════════════════════════
  header('SUMMARY: All decks across all storage locations')

  const sortedDecks = [...allDecks.entries()].sort((a, b) => {
    const aLocs = a[1].locations.length
    const bLocs = b[1].locations.length
    if (aLocs !== bLocs) return bLocs - aLocs
    return a[0].localeCompare(b[0])
  })

  console.log(`  Total unique deck IDs: ${sortedDecks.length}`)
  console.log('')

  for (const [deckId, info] of sortedDecks) {
    const hasTombstone = info.locations.some((l) => l.location.includes('tombstone'))
    const isActive = info.locations.some(
      (l) => !l.location.includes('tombstone') && !l.location.includes('deleted')
    )
    const status = hasTombstone && !isActive ? '🪦' : isActive ? '✅' : '❓'

    console.log(`  ${status} ${info.name}  (${deckId})`)
    for (const loc of info.locations) {
      const extras = []
      if (loc.cards) extras.push(`${loc.cards} cards`)
      if (loc.bytes) extras.push(formatBytes(loc.bytes))
      if (loc.files) extras.push(`${loc.files} files`)
      if (loc.media) extras.push(`${loc.media} media`)
      if (loc.source) extras.push(`source: ${loc.source}`)
      if (loc.deletedAt) extras.push(`deleted: ${formatDate(loc.deletedAt)}`)
      console.log(`     └─ ${loc.location}${extras.length ? '  (' + extras.join(', ') + ')' : ''}`)
    }
    console.log('')
  }

  // ── Sync issues ──────────────────────────────────────────────────────────
  subheader('Potential issues')

  let issueCount = 0

  for (const [deckId, info] of sortedDecks) {
    const locs = info.locations.map((l) => l.location)
    const hasTombstone = locs.some((l) => l.includes('tombstone'))
    const hasActiveBackup = locs.some((l) => l.includes('r2_backups') || l.includes('R2'))
    const hasFirebase = locs.includes('flashcardDecks')

    // Tombstone + active backup = bug (delete-reimport issue)
    if (hasTombstone && hasActiveBackup) {
      console.log(`  ⚠️  ${info.name} (${deckId}): has BOTH a tombstone and an active backup — backup may be hidden`)
      issueCount++
    }

    // In Firebase but no R2 backup (user decks)
    if (hasFirebase && !locs.some((l) => l.includes('R2 user backup'))) {
      console.log(`  ℹ️  ${info.name} (${deckId}): in Firebase but no R2 user backup`)
      issueCount++
    }
  }

  if (issueCount === 0) {
    console.log('  ✅ No issues detected')
  }

  // ── R2 totals ────────────────────────────────────────────────────────────
  subheader('R2 storage totals')

  let totalR2Bytes = 0
  for (const [, info] of sortedDecks) {
    for (const loc of info.locations) {
      if (loc.location.startsWith('R2') && loc.bytes) {
        totalR2Bytes += loc.bytes
      }
    }
  }

  const limitBytes = 300 * 1024 * 1024
  console.log(`  Used: ${formatBytes(totalR2Bytes)} / ${formatBytes(limitBytes)} (${((totalR2Bytes / limitBytes) * 100).toFixed(1)}%)`)

  console.log('')
  process.exit(0)
}

main().catch((error) => {
  console.error('❌ Error:', error.message || error)
  process.exit(1)
})
