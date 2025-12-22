/**
 * Trigger manual story generation via Firebase Functions
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

async function triggerManualStory() {
  console.log('🚀 Triggering Manual Story Generation (Firebase Functions)')
  console.log('═'.repeat(80))
  console.log()

  // Calculate expected values based on day-of-year rotation
  const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N5', 'N4', 'N2']
  const STORY_THEMES = [
    'A Day at School',
    'Shopping at the Convenience Store',
    'Visiting a Temple',
    'Making Friends',
    'A Trip to the Park',
    'Cooking Japanese Food',
    'At the Train Station',
    'A Rainy Day',
    'Cherry Blossom Viewing',
    'Summer Festival',
    'New Year Celebration',
    'Going to the Beach',
    'A Visit to the Doctor',
    'At the Library',
    'Playing Sports',
  ]

  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now - start
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))

  const jlptLevel = JLPT_LEVELS[dayOfYear % JLPT_LEVELS.length]
  const theme = STORY_THEMES[dayOfYear % STORY_THEMES.length]

  console.log('Expected Configuration:')
  console.log('  Day of Year:', dayOfYear)
  console.log('  Theme:', theme)
  console.log('  JLPT Level:', jlptLevel)
  console.log()
  console.log('This will verify:')
  console.log('  ✓ JLPT level cycling (expecting', jlptLevel + ')')
  console.log('  ✓ Character name variety (should NOT be "Hana")')
  console.log('  ✓ Gender diversity in character selection')
  console.log()

  try {
    console.log('Calling manualStoryGeneratorFunction...')
    console.log()

    // Call the Firebase callable function
    const url = 'https://manualstorygeneratorfunction-yxlyfxl7eq-uc.a.run.app'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          adminKey: 'story-scheduler-2025'
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ Request failed:', response.status, response.statusText)
      console.log('Response:', errorText)
      process.exit(1)
    }

    const result = await response.json()

    console.log('✅ Story generation triggered!')
    console.log()
    console.log('Result:', JSON.stringify(result, null, 2))
    console.log()

    if (result.result?.draftId) {
      console.log('Draft ID:', result.result.draftId)
      console.log()
      console.log('Monitor progress:')
      console.log('  Admin Dashboard: https://moshimoshi.app/en/admin/integrity-monitor')
      console.log('  Firestore Collection: story_drafts')
      console.log('  Document ID:', result.result.draftId)
      console.log()
      console.log('The story will take several minutes to generate.')
      console.log('You can check back in 5-10 minutes.')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }

  process.exit(0)
}

triggerManualStory()
