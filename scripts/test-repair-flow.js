/**
 * Test script that mimics the exact flow of repair-story-images endpoint
 * to isolate where the Firestore error occurs
 */

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
const storage = admin.storage()

const apiKey = 'AIzaSyC9RVm99ZtRtjyh6Hn6L3uPw3JG8qpxoM4'
const model = 'gemini-3-pro-image-preview'
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

const storyId = 'story-1765058257096-cw3ym907v'

async function test() {
  console.log('=== Testing Repair Flow ===\n')

  // Step 1: Generate model sheet image (like generateModelSheet does)
  console.log('1. Generating model sheet image from Gemini...')

  const modelSheetPrompt = `Create a detailed character model sheet for: Aiko

Character Description: Aiko is a curious and adventurous girl who loves nature and Pokémon.
Visual Details: Aiko has long black hair tied in a ponytail, bright brown eyes, and wears a green T-shirt with a cute Pokémon design, denim shorts, and sneakers.
Art Style: Bright and colorful, with a focus on nature and Pokémon. The characters and environment are illustrated in a cute, cartoonish style.

IMPORTANT: Show the character in multiple poses and expressions:
- Front view (full body)
- Side view (profile)
- 3/4 view
- Close-up face with different expressions (happy, sad, surprised, determined)

This is a professional character design reference sheet for maintaining consistency across multiple illustrations. Clear, detailed, white background.`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: modelSheetPrompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '2K',
        },
      },
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

  // Step 2: Create data URL (like GeminiImageProcessor does)
  const imageData = imagePart.inlineData.data
  const dataUrl = `data:image/png;base64,${imageData}`
  console.log('2. Got image, data URL length:', dataUrl.length)
  console.log('   Raw base64 length:', imageData.length)

  // Step 3: Extract base64 with regex (like repair endpoint does)
  console.log('3. Extracting base64 with regex...')
  const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/)
  if (!base64Match) {
    console.log('   ERROR: Regex failed to match')
    process.exit(1)
  }
  console.log('   Match[1] length:', base64Match[1].length)
  console.log('   Match[1] === imageData:', base64Match[1] === imageData)

  // Step 4: Save to Firebase Storage (like repair endpoint does)
  console.log('4. Saving to Firebase Storage...')
  const imgBuffer = Buffer.from(base64Match[1], 'base64')
  console.log('   Buffer size:', imgBuffer.length)

  const fileName = `ai-stories/${storyId}/test-model-sheet.png`
  const bucket = storage.bucket('moshimoshi-de237.firebasestorage.app')
  const file = bucket.file(fileName)

  await file.save(imgBuffer, {
    metadata: {
      contentType: 'image/png',
      metadata: {
        generatedBy: 'test-repair-flow',
        testRun: 'true',
      },
    },
  })
  console.log('   Saved to Storage')

  await file.makePublic()
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`
  console.log('   Public URL:', publicUrl)

  // Step 5: Update Firestore (exactly like repair endpoint does)
  console.log('5. Updating Firestore with modelSheet...')
  console.log('   imageUrl:', publicUrl)
  console.log('   referenceImageData length:', base64Match[1].length)
  console.log('   referenceImageData first 100 chars:', base64Match[1].substring(0, 100))
  console.log(
    '   referenceImageData last 100 chars:',
    base64Match[1].substring(base64Match[1].length - 100)
  )

  try {
    await db
      .collection('stories')
      .doc(storyId)
      .update({
        modelSheet: {
          imageUrl: publicUrl,
          referenceImageData: base64Match[1],
        },
        updatedAt: new Date(),
      })
    console.log('   SUCCESS!')
  } catch (e) {
    console.log('   FAILED:', e.code, e.message)
    console.log('   Full error:', e)

    // Try with just a portion to see if size is the issue
    console.log('\n6. Trying with truncated data (100KB)...')
    try {
      await db
        .collection('stories')
        .doc(storyId)
        .update({
          modelSheet: {
            imageUrl: publicUrl,
            referenceImageData: base64Match[1].substring(0, 100000),
          },
          updatedAt: new Date(),
        })
      console.log('   SUCCESS with truncated data!')
    } catch (e2) {
      console.log('   Still failed:', e2.message)
    }
  }

  // Clean up
  console.log('\n7. Cleaning up...')
  await db.collection('stories').doc(storyId).update({
    modelSheet: admin.firestore.FieldValue.delete(),
  })
  await file.delete()
  console.log('   Done')

  process.exit(0)
}

test().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
