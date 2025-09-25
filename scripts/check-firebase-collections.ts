/**
 * Direct Firebase Check for Flashcard Collections
 */

import * as admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const serviceAccountPath = resolve(__dirname, '../moshimoshi-service-account.json')
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  })
}

const db = admin.firestore()

async function checkFlashcards() {
  console.log('🔍 Checking Firebase for Beano\'s flashcards...\n')

  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1' // Beano's user ID

  // Check multiple possible collection names
  const collectionNames = [
    'flashcardDecks',
    'flashcard_decks',
    'decks',
    'flashcards',
    'anki_decks',
    'ankiDecks'
  ]

  for (const collName of collectionNames) {
    try {
      const snapshot = await db
        .collection('users')
        .doc(userId)
        .collection(collName)
        .get()

      if (!snapshot.empty) {
        console.log(`✅ Found ${snapshot.size} deck(s) in collection: ${collName}`)
        snapshot.forEach(doc => {
          const data = doc.data()
          console.log(`   - ${data.name || doc.id}: ${data.stats?.totalCards || data.cards?.length || 0} cards`)
        })
      } else {
        console.log(`❌ No decks in collection: ${collName}`)
      }
    } catch (error) {
      console.log(`⚠️ Error checking ${collName}:`, error.message)
    }
  }

  // Also check root-level collections
  console.log('\n🔍 Checking root-level collections...')

  const rootSnapshot = await db
    .collection('flashcardDecks')
    .where('userId', '==', userId)
    .get()

  if (!rootSnapshot.empty) {
    console.log(`✅ Found ${rootSnapshot.size} deck(s) in root flashcardDecks`)
    rootSnapshot.forEach(doc => {
      const data = doc.data()
      console.log(`   - ${data.name}: ${data.stats?.totalCards || data.cards?.length || 0} cards`)
    })
  } else {
    console.log('❌ No decks in root flashcardDecks collection')
  }
}

checkFlashcards()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })