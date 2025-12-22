/**
 * Test audio generation in isolation
 */

require('dotenv').config({ path: '.env.local' })

const adminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'

async function testAudioGeneration() {
  console.log('🧪 Testing Audio Generation in Isolation')
  console.log('═'.repeat(80))
  console.log()

  // Check env vars
  console.log('Environment:')
  console.log('  MODAL_API_KEY:', process.env.MODAL_API_KEY ? '✓ Set' : '✗ MISSING')
  console.log('  Admin Key:', adminKey ? '✓ Set' : '✗ MISSING')
  console.log()

  if (!process.env.MODAL_API_KEY) {
    console.log('❌ MODAL_API_KEY is required for audio generation')
    process.exit(1)
  }

  // Test data
  const testPages = [
    {
      pageNumber: 1,
      text: 'これはテストです。'
    },
    {
      pageNumber: 2,
      text: '音声生成のテストをしています。'
    }
  ]

  console.log('Test data:')
  console.log('  Pages:', testPages.length)
  testPages.forEach(p => console.log(`    Page ${p.pageNumber}: ${p.text}`))
  console.log()

  console.log('Calling /api/admin/generate-story-audio...')
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
          storyId: 'test-audio-' + Date.now(),
          pages: testPages,
          voice: '23',
          generateFullAudio: true,
          generatePageAudio: true,
        }),
      }
    )

    console.log('Response status:', response.status)
    console.log()

    const result = await response.json()

    if (!response.ok) {
      console.log('❌ API Error:')
      console.log(JSON.stringify(result, null, 2))
      process.exit(1)
    }

    console.log('✅ Audio generation successful!')
    console.log()
    console.log('Result:')
    console.log('  Full audio URL:', result.fullAudioUrl || 'N/A')
    console.log('  Page audio count:', result.pageAudioCount || 0)
    console.log('  Provider:', result.provider)
    console.log('  Voice:', result.voice)
    console.log('  Errors:', result.errors?.length || 0)

    if (result.errors && result.errors.length > 0) {
      console.log()
      console.log('Errors:')
      result.errors.forEach(err => console.log('  -', err))
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testAudioGeneration()
