/**
 * Delete specified stories from Firestore
 * CAUTION: This permanently deletes story documents
 *
 * Usage: node scripts/delete-stories.js storyId1 storyId2 storyId3...
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

// Story IDs to delete (can be passed as command line args or hardcoded)
const STORY_IDS_TO_DELETE = [
  'story_1766341034625_scheduler-system',
  'story_1766339207051_scheduler-system',
  'story_1766338413098_scheduler-system',
  'story_1766337845010_scheduler-system',
  'story_1766275217842_scheduler-system',
]

async function deleteStories() {
  // Get story IDs from command line args or use hardcoded list
  const storyIds = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : STORY_IDS_TO_DELETE

  console.log('🗑️  Story Deletion Script\n')
  console.log('═'.repeat(80))
  console.log(`⚠️  WARNING: This will PERMANENTLY DELETE ${storyIds.length} stories`)
  console.log('═'.repeat(80))
  console.log()

  if (storyIds.length === 0) {
    console.log('❌ No story IDs provided')
    console.log('Usage: node scripts/delete-stories.js storyId1 storyId2 ...')
    process.exit(1)
  }

  // First, fetch and display the stories that will be deleted
  console.log('📋 Stories to be deleted:\n')
  const storiesToDelete = []

  for (const storyId of storyIds) {
    try {
      const doc = await db.collection('stories').doc(storyId).get()

      if (!doc.exists) {
        console.log(`  ❌ NOT FOUND: ${storyId}`)
        continue
      }

      const data = doc.data()
      const story = {
        id: storyId,
        title: data.titleJa || data.title,
        titleEn: data.title,
        created: data.createdAt?.toDate?.()?.toISOString() || 'unknown',
        pages: (data.pages || []).length,
      }

      storiesToDelete.push(story)

      console.log(`  • ${story.title}`)
      console.log(`    EN: ${story.titleEn}`)
      console.log(`    ID: ${story.id}`)
      console.log(`    Created: ${story.created}`)
      console.log(`    Pages: ${story.pages}`)
      console.log()
    } catch (error) {
      console.log(`  ❌ ERROR fetching ${storyId}:`, error.message)
    }
  }

  if (storiesToDelete.length === 0) {
    console.log('\n❌ No valid stories found to delete')
    process.exit(1)
  }

  console.log('═'.repeat(80))
  console.log(`📊 Summary: ${storiesToDelete.length} stories will be PERMANENTLY DELETED`)
  console.log('═'.repeat(80))
  console.log()

  // Confirmation prompt (in Node.js, we'll use a simple timeout)
  console.log('⏳ Starting deletion in 5 seconds...')
  console.log('   Press Ctrl+C to cancel')
  console.log()

  await new Promise(resolve => setTimeout(resolve, 5000))

  console.log('🔥 Deleting stories...\n')

  const batch = db.batch()
  let deleteCount = 0

  for (const story of storiesToDelete) {
    const docRef = db.collection('stories').doc(story.id)
    batch.delete(docRef)
    deleteCount++
    console.log(`  ✓ Queued for deletion: ${story.title} (${story.id})`)
  }

  try {
    await batch.commit()
    console.log()
    console.log('═'.repeat(80))
    console.log(`✅ Successfully deleted ${deleteCount} stories`)
    console.log('═'.repeat(80))
    console.log()

    // Show summary
    console.log('Deleted stories:')
    storiesToDelete.forEach((story, index) => {
      console.log(`  ${index + 1}. ${story.title} (${story.titleEn})`)
    })

  } catch (error) {
    console.error('\n❌ Error during deletion:', error)
    console.error('Some stories may not have been deleted')
    process.exit(1)
  }

  process.exit(0)
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n❌ Deletion cancelled by user')
  process.exit(0)
})

deleteStories()
