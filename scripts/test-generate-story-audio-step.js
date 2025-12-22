/**
 * Test the generate-story endpoint with step=generate_audio
 */

require('dotenv').config({ path: '.env.local' })

const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

async function testGenerateStoryAudioStep() {
  console.log('🧪 Testing generate-story Endpoint (Audio Step)')
  console.log('═'.repeat(80))
  console.log()

  const draftId = 'draft_1766399089965_scheduler-system'

  console.log('Test data:')
  console.log('  Draft ID:', draftId)
  console.log('  Voice: 23')
  console.log()

  console.log('Calling /api/admin/generate-story (step=generate_audio)...')
  console.log()

  try {
    const response = await fetch(
      'https://moshimoshi.app/api/admin/generate-story',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          step: 'generate_audio',
          draftId: draftId,
          voice: '23'
        }),
      }
    )

    console.log('Response status:', response.status)
    console.log()

    const result = await response.json()

    console.log('Response:')
    console.log(JSON.stringify(result, null, 2))
    console.log()

    if (!response.ok) {
      console.log('❌ Request failed')
      process.exit(1)
    }

    if (!result.success) {
      console.log('❌ Audio generation failed')
      console.log('Error:', result.error || result.warning)
      process.exit(1)
    }

    console.log('✅ Audio generation successful!')
    console.log('  Full audio URL:', result.data?.fullAudioUrl || 'N/A')
    console.log('  Page audio count:', result.data?.pageAudioCount || 0)

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testGenerateStoryAudioStep()
