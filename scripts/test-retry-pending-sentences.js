/**
 * Test script to manually retry sentence generation for a pending draft
 * This simulates what the dailyStoryRetryScheduler would do
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  })
}

const db = admin.firestore()

async function testRetryPendingSentences() {
  const draftId = 'draft_1766341034625_scheduler-system'

  console.log(`\n=== Testing Sentence Retry for ${draftId} ===\n`)

  // 1. Get the draft
  const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get()

  if (!draftDoc.exists) {
    console.log('Draft not found!')
    return
  }

  const draft = draftDoc.data()
  console.log('Draft status:', draft.status)
  console.log('Draft checkpoint:', JSON.stringify(draft.checkpoint, null, 2))
  console.log('Pages count:', draft.pages?.length || 0)

  if (draft.status !== 'pending_sentences') {
    console.log('Draft is not in pending_sentences status, skipping')
    return
  }

  // 2. Get the pages
  const pages = draft.pages || []
  if (pages.length === 0) {
    console.log('No pages found in draft!')
    return
  }

  console.log(`\nFound ${pages.length} pages. Testing sentence pre-generation...\n`)

  // 3. Call the sentence pre-generation API directly via HTTP
  // The API is at /api/admin/generate-story with step: 'pregen_sentences'
  // But actually we need to call the sentencePreGenerator function directly

  // Since the function is in Firebase Functions, let's just test by updating the draft
  // and seeing if the sentence data can be created without FieldValue errors

  // For now, let's just check what sentence data already exists
  const storyId = draftId.replace('draft_', 'story_')
  const sentenceDoc = await db.collection('story_sentence_data').doc(storyId).get()

  console.log('Sentence data exists:', sentenceDoc.exists)
  if (sentenceDoc.exists) {
    const data = sentenceDoc.data()
    console.log('Pages with sentence data:', data.pages?.length || 0)
    console.log('Story ID in doc:', data.storyId)
  }

  // 4. Try to manually trigger the API
  console.log('\n--- Attempting to trigger sentence generation via API ---\n')

  const BASE_URL = 'https://moshimoshi.day'
  const adminKey = 'story-scheduler-2025'

  try {
    const response = await fetch(`${BASE_URL}/api/admin/generate-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify({
        step: 'pregen_sentences',
        draftId: draftId,
      }),
    })

    const result = await response.json()
    console.log('API Response status:', response.status)
    console.log('API Response:', JSON.stringify(result, null, 2))

    if (result.success) {
      console.log('\n✅ Sentence generation succeeded!')

      // Update draft status
      await db.collection('ai_story_drafts').doc(draftId).update({
        status: 'draft',
        'checkpoint.lastCompletedStep': 'sentences',
        'checkpoint.lastError': null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log('Updated draft status to "draft" (ready for publishing)')

      // Now try to publish
      console.log('\n--- Attempting to publish draft ---\n')

      const publishResponse = await fetch(`${BASE_URL}/api/admin/stories/publish-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          draftId: draftId,
        }),
      })

      const publishResult = await publishResponse.json()
      console.log('Publish Response status:', publishResponse.status)
      console.log('Publish Response:', JSON.stringify(publishResult, null, 2))

      if (publishResult.success) {
        console.log('\n🎉 Story published successfully!')
        console.log('Story ID:', publishResult.storyId)
      }
    } else {
      console.log('\n❌ Sentence generation failed:', result.error)
    }
  } catch (error) {
    console.error('Error calling API:', error.message)
  }

  console.log('\n=== Test Complete ===\n')
}

testRetryPendingSentences().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
