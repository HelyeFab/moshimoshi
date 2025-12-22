/**
 * Test audio error handling - verify the bug
 */

require('dotenv').config({ path: '.env.local' })

async function testAudioErrorHandling() {
  console.log('🧪 Testing Audio Error Handling')
  console.log('═'.repeat(80))
  console.log()

  // Call with intentionally bad data to trigger error
  const testPages = [
    {
      pageNumber: 1,
      text: '' // Empty text should trigger an error or skip
    }
  ]

  const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

  console.log('Test: Calling generate-story-audio with empty text...')
  console.log()

  try {
    const response = await fetch(
      'https://moshimoshi.app/api/admin/generate-story-audio',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          storyId: 'test-error-' + Date.now(),
          pages: testPages,
          voice: '23',
          generateFullAudio: true,
          generatePageAudio: true,
        }),
      }
    )

    console.log('Response status:', response.status)
    console.log('Response OK:', response.ok)
    console.log()

    const result = await response.json()

    console.log('Result:')
    console.log(JSON.stringify(result, null, 2))
    console.log()

    console.log('Analysis:')
    console.log('  success:', result.success)
    console.log('  fullAudioUrl:', result.fullAudioUrl || 'NOT SET')
    console.log('  pageAudioCount:', result.pageAudioCount)
    console.log('  errors:', result.errors?.length || 0)
    console.log()

    if (result.success && (!result.fullAudioUrl || result.pageAudioCount === 0)) {
      console.log('❌ BUG CONFIRMED: Returns success:true without generating audio!')
      console.log()
      console.log('Expected: success: false when audio not generated')
      console.log('Actual: success: true with no audio URLs')
    } else if (!result.success) {
      console.log('✅ Correctly returns success: false')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testAudioErrorHandling()
