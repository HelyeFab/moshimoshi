// Test the Firestore API endpoint with real Gemini data

const apiKey = 'AIzaSyC9RVm99ZtRtjyh6Hn6L3uPw3JG8qpxoM4'
const model = 'gemini-3-pro-image-preview'
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

async function test() {
  console.log('1. Generating image from Gemini...')

  const geminiResponse = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'A simple red circle on white background' }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  })

  const data = await geminiResponse.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find(p => p.inlineData)

  if (!imagePart) {
    console.log('No image from Gemini')
    process.exit(1)
  }

  const base64Data = imagePart.inlineData.data
  console.log('2. Got image, base64 length:', base64Data.length)

  console.log('3. Testing Firestore API with real Gemini data...')
  const testResponse = await fetch('http://localhost:3000/api/admin/test-firestore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': 'integrity-checker-2025',
    },
    body: JSON.stringify({
      storyId: 'story-1765058257096-cw3ym907v',
      testData: base64Data,
    }),
  })

  const result = await testResponse.json()
  console.log('4. Result:', JSON.stringify(result, null, 2))

  process.exit(result.success ? 0 : 1)
}

test().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
