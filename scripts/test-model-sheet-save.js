const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json')
    ),
    projectId: 'moshimoshi-de237',
  })
}

const db = admin.firestore()
const apiKey = 'AIzaSyC9RVm99ZtRtjyh6Hn6L3uPw3JG8qpxoM4'
const model = 'gemini-3-pro-image-preview'
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

async function test() {
  console.log('1. Generating image from Gemini...')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'A simple red circle on white background' }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  })

  const data = await response.json()

  if (data.error) {
    console.log('Gemini error:', data.error.message)
    process.exit(1)
  }

  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find(p => p.inlineData)

  if (!imagePart) {
    console.log('No image in response')
    process.exit(1)
  }

  const base64Data = imagePart.inlineData.data
  console.log('2. Got image, size:', base64Data.length, 'chars')

  console.log('3. Saving to Firestore...')
  const storyId = 'story_1765152027413_scheduler-system'

  try {
    await db
      .collection('stories')
      .doc(storyId)
      .update({
        modelSheet: {
          imageUrl: 'https://example.com/test.png',
          referenceImageData: base64Data,
        },
        updatedAt: new Date(),
      })
    console.log('4. SUCCESS - Real image saved to Firestore!')
  } catch (e) {
    console.log('4. FAILED:', e.code, e.message)
  }

  // Clean up
  await db.collection('stories').doc(storyId).update({
    modelSheet: admin.firestore.FieldValue.delete(),
  })
  console.log('5. Cleaned up')

  process.exit(0)
}

test()
