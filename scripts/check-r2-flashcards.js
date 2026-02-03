#!/usr/bin/env node

/**
 * Check Flashcards Script (R2 + Firebase)
 *
 * Lists all flashcard/Anki deck data stored in R2 and Firebase for a user.
 *
 * Usage:
 *   node scripts/check-r2-flashcards.js <email>
 *
 * Example:
 *   node scripts/check-r2-flashcards.js emmanuelfabiani23@gmail.com
 *
 * NOTE: emailVerified field location
 * ----------------------------------
 * The authoritative `emailVerified` field is in FIRESTORE `users` collection,
 * NOT in Firebase Auth. To update it:
 *   db.collection('users').doc(uid).update({ emailVerified: true })
 *
 * Firebase Auth also has an emailVerified field, but the app uses Firestore.
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const admin = require('firebase-admin')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237',
})

const db = admin.firestore()

// Get email from command line
const email = process.argv[2]

if (!email) {
  console.error('\n❌ Error: Missing email argument\n')
  console.log('Usage:')
  console.log('  node scripts/check-r2-flashcards.js <email>\n')
  console.log('Example:')
  console.log('  node scripts/check-r2-flashcards.js emmanuelfabiani23@gmail.com\n')
  process.exit(1)
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A'
  if (timestamp.toDate) return timestamp.toDate().toISOString()
  if (timestamp instanceof Date) return timestamp.toISOString()
  return String(timestamp)
}

async function checkFlashcards() {
  console.log('='.repeat(80))
  console.log(`FLASHCARD DATA FOR: ${email}`)
  console.log('='.repeat(80))
  console.log()

  // Step 1: Get userId from Firebase Auth
  console.log('📧 Looking up user in Firebase Auth...')
  let userId
  let userRecord
  try {
    userRecord = await admin.auth().getUserByEmail(email)
    userId = userRecord.uid
    console.log(`✅ Found user: ${userId}`)
    console.log(`   Display Name: ${userRecord.displayName || 'Not set'}`)
    console.log()
  } catch (error) {
    console.error('❌ User not found:', error.message)
    process.exit(1)
  }

  // ============================================================================
  // FIREBASE SECTION
  // ============================================================================
  console.log('='.repeat(80))
  console.log('🔥 FIREBASE DATA')
  console.log('='.repeat(80))
  console.log()

  // Check flashcardDecks collection
  console.log('📚 Checking flashcardDecks collection...')
  const firebaseDecks = []
  try {
    const decksSnapshot = await db.collection('flashcardDecks').where('userId', '==', userId).get()

    if (decksSnapshot.empty) {
      console.log('   No flashcard decks found in Firebase.')
    } else {
      console.log(`   Found ${decksSnapshot.size} deck(s):\n`)

      decksSnapshot.forEach((doc) => {
        const data = doc.data()
        firebaseDecks.push({ id: doc.id, ...data })

        console.log(`   📦 Deck: ${data.name || 'Unnamed'}`)
        console.log(`      ID: ${doc.id}`)
        console.log(`      Cards: ${data.cardCount || data.cards?.length || 0}`)
        console.log(`      Source: ${data.source || 'user'}`)
        console.log(`      Created: ${formatDate(data.createdAt)}`)
        console.log(`      Updated: ${formatDate(data.updatedAt)}`)
        if (data.r2BackedUp !== undefined) {
          console.log(`      R2 Backed Up: ${data.r2BackedUp ? '✅' : '❌'}`)
        }
        console.log()
      })
    }
  } catch (error) {
    console.log(`   ❌ Error querying flashcardDecks: ${error.message}`)
  }
  console.log()

  // Check flashcardSessions collection
  console.log('📊 Checking flashcardSessions collection...')
  try {
    const sessionsSnapshot = await db
      .collection('flashcardSessions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    if (sessionsSnapshot.empty) {
      console.log('   No flashcard sessions found in Firebase.')
    } else {
      console.log(`   Found ${sessionsSnapshot.size} recent session(s):\n`)

      sessionsSnapshot.forEach((doc) => {
        const data = doc.data()
        console.log(`   📝 Session: ${doc.id.substring(0, 20)}...`)
        console.log(`      Deck: ${data.deckName || data.deckId || 'Unknown'}`)
        console.log(`      Cards Reviewed: ${data.cardsReviewed || 0}`)
        console.log(`      Duration: ${data.duration ? Math.round(data.duration / 1000) + 's' : 'N/A'}`)
        console.log(`      Date: ${formatDate(data.createdAt)}`)
        console.log()
      })
    }
  } catch (error) {
    // Index might not exist, try without orderBy
    try {
      const sessionsSnapshot = await db
        .collection('flashcardSessions')
        .where('userId', '==', userId)
        .limit(10)
        .get()

      if (sessionsSnapshot.empty) {
        console.log('   No flashcard sessions found in Firebase.')
      } else {
        console.log(`   Found ${sessionsSnapshot.size} session(s) (unordered):\n`)
        sessionsSnapshot.forEach((doc) => {
          const data = doc.data()
          console.log(`   📝 Session: ${doc.id.substring(0, 20)}...`)
          console.log(`      Deck: ${data.deckName || data.deckId || 'Unknown'}`)
          console.log(`      Cards Reviewed: ${data.cardsReviewed || 0}`)
          console.log()
        })
      }
    } catch (innerError) {
      console.log(`   ❌ Error querying flashcardSessions: ${innerError.message}`)
    }
  }
  console.log()

  // ============================================================================
  // R2 SECTION
  // ============================================================================
  console.log('='.repeat(80))
  console.log('☁️  R2 CLOUD STORAGE')
  console.log('='.repeat(80))
  console.log()

  // Initialize R2 client
  console.log('Connecting to R2...')
  const client = new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  })

  const bucket = process.env.R2_BUCKET

  if (!bucket) {
    console.error('❌ R2_BUCKET not found in environment variables')
    process.exit(1)
  }

  console.log(`✅ Bucket: ${bucket}`)
  console.log()

  // List all objects for user
  const userPrefix = `users/${userId}/`
  console.log(`🔍 Scanning R2 prefix: ${userPrefix}`)
  console.log()

  let allObjects = []
  let continuationToken = undefined

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: userPrefix,
      ContinuationToken: continuationToken,
    })

    const listResponse = await client.send(listCommand)
    const objects = listResponse.Contents || []
    allObjects.push(...objects)
    continuationToken = listResponse.NextContinuationToken
  } while (continuationToken)

  if (allObjects.length === 0) {
    console.log('📭 No R2 data found for this user.')
  } else {
    console.log(`📦 Found ${allObjects.length} total objects in R2`)
    console.log()

    // Group by deck type and deck ID
    const ankiDecks = {} // users/{userId}/decks/{deckId}/
    const userDecksR2 = {} // users/{userId}/flashcards/{deckId}/
    const otherFiles = []

    for (const obj of allObjects) {
      const key = obj.Key
      const relativePath = key.replace(userPrefix, '')

      // Anki decks: decks/{deckId}/...
      const ankiMatch = relativePath.match(/^decks\/([^/]+)\/(.+)$/)
      if (ankiMatch) {
        const deckId = ankiMatch[1]
        const fileName = ankiMatch[2]
        if (!ankiDecks[deckId]) {
          ankiDecks[deckId] = { files: [], totalSize: 0, mediaCount: 0 }
        }
        ankiDecks[deckId].files.push({ name: fileName, size: obj.Size, lastModified: obj.LastModified })
        ankiDecks[deckId].totalSize += obj.Size || 0
        if (fileName.startsWith('media/')) {
          ankiDecks[deckId].mediaCount++
        }
        continue
      }

      // User decks: flashcards/{deckId}/...
      const userMatch = relativePath.match(/^flashcards\/([^/]+)\/(.+)$/)
      if (userMatch) {
        const deckId = userMatch[1]
        const fileName = userMatch[2]
        if (!userDecksR2[deckId]) {
          userDecksR2[deckId] = { files: [], totalSize: 0, mediaCount: 0 }
        }
        userDecksR2[deckId].files.push({ name: fileName, size: obj.Size, lastModified: obj.LastModified })
        userDecksR2[deckId].totalSize += obj.Size || 0
        if (fileName.startsWith('media/')) {
          userDecksR2[deckId].mediaCount++
        }
        continue
      }

      // Other files
      otherFiles.push({ key: relativePath, size: obj.Size, lastModified: obj.LastModified })
    }

    const ankiDeckIds = Object.keys(ankiDecks)
    const userDeckR2Ids = Object.keys(userDecksR2)

    // Anki Decks Summary
    console.log('-'.repeat(80))
    console.log('📚 ANKI DECKS (R2 Backups)')
    console.log('-'.repeat(80))

    if (ankiDeckIds.length === 0) {
      console.log('   No Anki deck backups found.')
    } else {
      let totalAnkiSize = 0
      for (const deckId of ankiDeckIds) {
        const deck = ankiDecks[deckId]
        totalAnkiSize += deck.totalSize
        const hasPackage = deck.files.some((f) => f.name === 'package.apkg')
        const hasManifest = deck.files.some((f) => f.name === 'manifest.json')

        console.log()
        console.log(`   📦 Deck ID: ${deckId}`)
        console.log(`      Total Size: ${formatBytes(deck.totalSize)}`)
        console.log(`      Files: ${deck.files.length} (${deck.mediaCount} media)`)
        console.log(`      Has package.apkg: ${hasPackage ? '✅' : '❌'}`)
        console.log(`      Has manifest.json: ${hasManifest ? '✅' : '❌'}`)

        if (hasManifest) {
          const manifestFile = deck.files.find((f) => f.name === 'manifest.json')
          console.log(`      Manifest last modified: ${manifestFile.lastModified.toISOString()}`)
        }
      }
      console.log()
      console.log(`   📊 Total Anki storage: ${formatBytes(totalAnkiSize)} across ${ankiDeckIds.length} deck(s)`)
    }
    console.log()

    // User Decks R2 Summary
    console.log('-'.repeat(80))
    console.log('🗂️  USER FLASHCARD DECKS (R2 Backups)')
    console.log('-'.repeat(80))

    if (userDeckR2Ids.length === 0) {
      console.log('   No user flashcard backups found in R2.')
    } else {
      let totalUserSize = 0
      for (const deckId of userDeckR2Ids) {
        const deck = userDecksR2[deckId]
        totalUserSize += deck.totalSize
        const hasCards = deck.files.some((f) => f.name === 'cards.json')
        const hasManifest = deck.files.some((f) => f.name === 'manifest.json')

        // Check if this deck exists in Firebase
        const firebaseDeck = firebaseDecks.find((d) => d.id === deckId)

        console.log()
        console.log(`   📦 Deck ID: ${deckId}`)
        console.log(`      Name: ${firebaseDeck?.name || 'Unknown (not in Firebase)'}`)
        console.log(`      Total Size: ${formatBytes(deck.totalSize)}`)
        console.log(`      Files: ${deck.files.length} (${deck.mediaCount} media)`)
        console.log(`      Has cards.json: ${hasCards ? '✅' : '❌'}`)
        console.log(`      Has manifest.json: ${hasManifest ? '✅' : '❌'}`)
        console.log(`      In Firebase: ${firebaseDeck ? '✅' : '❌'}`)

        if (hasManifest) {
          const manifestFile = deck.files.find((f) => f.name === 'manifest.json')
          console.log(`      Manifest last modified: ${manifestFile.lastModified.toISOString()}`)
        }
      }
      console.log()
      console.log(`   📊 Total User Deck storage: ${formatBytes(totalUserSize)} across ${userDeckR2Ids.length} deck(s)`)
    }
    console.log()

    // Other files
    if (otherFiles.length > 0) {
      console.log('-'.repeat(80))
      console.log('❓ OTHER R2 FILES')
      console.log('-'.repeat(80))
      for (const file of otherFiles) {
        console.log(`   ${file.key} (${formatBytes(file.size)})`)
      }
      console.log()
    }

    // Grand total R2
    const grandTotal = allObjects.reduce((sum, obj) => sum + (obj.Size || 0), 0)

    // ============================================================================
    // SYNC STATUS
    // ============================================================================
    console.log('='.repeat(80))
    console.log('🔄 SYNC STATUS')
    console.log('='.repeat(80))
    console.log()

    // Check which Firebase decks are backed up to R2
    const firebaseUserDecks = firebaseDecks.filter((d) => d.source !== 'anki')
    const decksInFirebaseOnly = firebaseUserDecks.filter((d) => !userDecksR2[d.id])
    const decksInR2Only = userDeckR2Ids.filter((id) => !firebaseDecks.find((d) => d.id === id))

    if (decksInFirebaseOnly.length > 0) {
      console.log('   ⚠️  Decks in Firebase but NOT backed up to R2:')
      for (const deck of decksInFirebaseOnly) {
        console.log(`      - ${deck.name || deck.id} (${deck.cardCount || 0} cards)`)
      }
      console.log()
    }

    if (decksInR2Only.length > 0) {
      console.log('   ⚠️  Decks in R2 but NOT in Firebase:')
      for (const deckId of decksInR2Only) {
        console.log(`      - ${deckId}`)
      }
      console.log()
    }

    if (decksInFirebaseOnly.length === 0 && decksInR2Only.length === 0 && firebaseUserDecks.length > 0) {
      console.log('   ✅ All Firebase user decks are backed up to R2!')
      console.log()
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('='.repeat(80))
    console.log('📊 STORAGE SUMMARY')
    console.log('='.repeat(80))
    console.log(`   Firebase User Decks: ${firebaseUserDecks.length}`)
    console.log(`   R2 Anki Deck Backups: ${ankiDeckIds.length}`)
    console.log(`   R2 User Deck Backups: ${userDeckR2Ids.length}`)
    console.log(`   R2 Total Objects: ${allObjects.length}`)
    console.log(`   R2 Total Storage: ${formatBytes(grandTotal)}`)
    console.log(`   R2 Limit: 300 MB per user`)
    console.log(`   R2 Usage: ${((grandTotal / (300 * 1024 * 1024)) * 100).toFixed(2)}%`)
    console.log()
  }

  process.exit(0)
}

checkFlashcards().catch((error) => {
  console.error('\n❌ Script failed:', error.message)
  process.exit(1)
})
