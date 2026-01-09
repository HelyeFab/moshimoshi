/**
 * Verify Comic Character IDs in Firestore
 *
 * Checks that the expected characters exist with correct IDs
 * Run: node scripts/verify-character-ids.js
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json')
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'moshimoshi-de237',
  })
}

const db = admin.firestore()

// Expected character IDs based on setup scripts
const EXPECTED_CHARACTERS = [
  { id: 'moshi-master', name: 'Moshi' },
  { id: 'sensei-panda', name: 'Sensei' },
  { id: 'yuki-sloth', name: 'Yuki' },
  { id: 'koa-koala', name: 'Koa' },
]

async function verifyCharacters() {
  console.log('='.repeat(60))
  console.log('Verifying Comic Character IDs in Firestore')
  console.log('='.repeat(60))
  console.log()

  let allFound = true

  for (const expected of EXPECTED_CHARACTERS) {
    try {
      const doc = await db.collection('saved_characters').doc(expected.id).get()

      if (doc.exists) {
        const data = doc.data()
        console.log(`✅ ${expected.id}`)
        console.log(`   Name: ${data.name} (${data.nameJa})`)
        console.log(`   Role: ${data.role}`)
        console.log(`   Has Image: ${data.referenceImageUrl ? 'Yes' : 'No'}`)
        if (data.referenceImageUrl) {
          console.log(`   Image URL: ${data.referenceImageUrl}`)
        }
        console.log()
      } else {
        console.log(`❌ ${expected.id} - NOT FOUND`)
        console.log(`   Expected name: ${expected.name}`)
        console.log()
        allFound = false
      }
    } catch (error) {
      console.log(`❌ ${expected.id} - ERROR: ${error.message}`)
      console.log()
      allFound = false
    }
  }

  console.log('='.repeat(60))
  if (allFound) {
    console.log('✅ All expected characters found!')
    console.log()
    console.log('Character IDs for regenerate-panel:')
    console.log(`  const availableChars = [${EXPECTED_CHARACTERS.map(c => `'${c.id}'`).join(', ')}]`)
  } else {
    console.log('⚠️  Some characters missing - check setup scripts')
    console.log()
    console.log('Run these scripts to create missing characters:')
    console.log('  node scripts/setup-moshi-character.js')
    console.log('  node scripts/setup-supporting-characters.js')
  }
  console.log('='.repeat(60))

  process.exit(allFound ? 0 : 1)
}

verifyCharacters().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
