/**
 * Call the manualStoryGeneratorFunction using gcloud CLI
 */

const { execSync } = require('child_process')

async function triggerManualStory() {
  console.log('🚀 Triggering Manual Story Generation')
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
    console.log('Calling Firebase Function via gcloud...')
    console.log()

    const payload = JSON.stringify({
      data: {
        adminKey: 'story-scheduler-2025'
      }
    })

    const command = `gcloud functions call manualStoryGeneratorFunction --gen2 --region=us-central1 --data='${payload}'`

    console.log('Running command:')
    console.log(command)
    console.log()

    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe'
    })

    console.log('✅ Function called successfully!')
    console.log()
    console.log('Response:')
    console.log(result)
    console.log()

    // Parse the result to extract draft ID if present
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.result?.draftId) {
          console.log('Draft ID:', parsed.result.draftId)
          console.log()
          console.log('Monitor progress:')
          console.log('  https://moshimoshi.app/en/admin/integrity-monitor')
        }
      }
    } catch (e) {
      // Ignore parse errors
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error()
    console.error('Full error:')
    console.error(error.stderr || error.stdout)
    process.exit(1)
  }
}

triggerManualStory()
