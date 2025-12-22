/**
 * Trigger a test story generation to verify improvements
 */

require('dotenv').config({ path: '.env.local' })

const ADMIN_KEY = process.env.ADMIN_API_KEY

async function triggerTestStory() {
  console.log('🚀 Triggering Test Story Generation')
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
  console.log('Testing:')
  console.log('  ✓ JLPT level cycling (expecting', jlptLevel + ')')
  console.log('  ✓ Character name variety (should NOT be "Hana")')
  console.log('  ✓ Gender diversity')
  console.log()

  if (!ADMIN_KEY) {
    console.log('❌ ADMIN_API_KEY not found in .env.local')
    process.exit(1)
  }

  console.log('Triggering story generation via API...')
  console.log()

  try {
    const response = await fetch('https://moshimoshi.app/api/admin/generate-story', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        step: 'trigger_manual',
        theme: theme,
        jlptLevel: jlptLevel,
        pageCount: 4
      })
    })

    if (!response.ok) {
      console.log('❌ Request failed:', response.status, response.statusText)
      const text = await response.text()
      console.log('Response:', text)
      process.exit(1)
    }

    const result = await response.json()
    console.log('✅ Generation triggered!')
    console.log()
    console.log('Response:', JSON.stringify(result, null, 2))
    console.log()

    if (result.draftId) {
      console.log('Draft ID:', result.draftId)
      console.log()
      console.log('You can monitor progress in the admin dashboard:')
      console.log('  https://moshimoshi.app/en/admin/integrity-monitor')
      console.log()
      console.log('Or check the draft directly in Firestore:')
      console.log('  Collection: story_drafts')
      console.log('  Document ID:', result.draftId)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

triggerTestStory()
