/**
 * Check Comic Episodes Script
 * Quick script to see what's in the comic_episodes collection
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

const db = initializeFirebaseForScript()

async function checkEpisodes() {
  console.log('\n=== Checking Comic Episodes ===\n')

  // Get all episodes
  const snapshot = await db.collection('comic_episodes').get()

  console.log(`Total episodes: ${snapshot.size}\n`)

  snapshot.docs.forEach(doc => {
    const data = doc.data()
    console.log(`Episode ID: ${doc.id}`)
    console.log(`  Episode Number: ${data.episodeNumber}`)
    console.log(`  Title: ${data.title}`)
    console.log(`  Panels: ${data.panels?.length || 0}`)
    console.log(`  Status: ${data.status}`)
    console.log('')
  })
}

checkEpisodes()
  .then(() => {
    console.log('✅ Done')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
