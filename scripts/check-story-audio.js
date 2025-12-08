/**
 * Check which stories need per-page audio regeneration
 * Run with: node scripts/check-story-audio.js
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkStoryAudio() {
  console.log('Checking stories for per-page audio...\n')

  try {
    // Get all published stories
    const storiesSnapshot = await db.collection('stories').where('status', '==', 'published').get()

    console.log(`Found ${storiesSnapshot.size} published stories\n`)

    const needsRegeneration = []
    const hasPerPageAudio = []
    const noAudioAtAll = []

    for (const doc of storiesSnapshot.docs) {
      const story = doc.data()
      const storyId = doc.id
      const title = story.titleJa || story.title || 'Untitled'
      const pages = story.pages || []

      // Check audio status
      const hasFullAudio = !!story.fullAudioUrl
      const pagesWithAudio = pages.filter(p => !!p.audioUrl).length
      const totalPages = pages.length

      if (!hasFullAudio && pagesWithAudio === 0) {
        noAudioAtAll.push({
          id: storyId,
          title,
          totalPages,
        })
      } else if (pagesWithAudio < totalPages) {
        needsRegeneration.push({
          id: storyId,
          title,
          hasFullAudio,
          pagesWithAudio,
          totalPages,
          audioStatus: story.audioStatus,
        })
      } else {
        hasPerPageAudio.push({
          id: storyId,
          title,
          pagesWithAudio,
          totalPages,
        })
      }
    }

    // Report results
    console.log('='.repeat(60))
    console.log('STORIES WITH COMPLETE PER-PAGE AUDIO')
    console.log('='.repeat(60))
    if (hasPerPageAudio.length === 0) {
      console.log('None\n')
    } else {
      hasPerPageAudio.forEach(s => {
        console.log(`  [OK] ${s.title}`)
        console.log(`       ID: ${s.id}`)
        console.log(`       Pages with audio: ${s.pagesWithAudio}/${s.totalPages}\n`)
      })
    }

    console.log('='.repeat(60))
    console.log('STORIES NEEDING PER-PAGE AUDIO REGENERATION')
    console.log('='.repeat(60))
    if (needsRegeneration.length === 0) {
      console.log('None\n')
    } else {
      needsRegeneration.forEach(s => {
        console.log(`  [REGEN] ${s.title}`)
        console.log(`          ID: ${s.id}`)
        console.log(`          Has full audio: ${s.hasFullAudio ? 'Yes' : 'No'}`)
        console.log(`          Pages with audio: ${s.pagesWithAudio}/${s.totalPages}`)
        console.log(`          Status: ${s.audioStatus || 'unknown'}\n`)
      })
    }

    console.log('='.repeat(60))
    console.log('STORIES WITH NO AUDIO AT ALL')
    console.log('='.repeat(60))
    if (noAudioAtAll.length === 0) {
      console.log('None\n')
    } else {
      noAudioAtAll.forEach(s => {
        console.log(`  [NO AUDIO] ${s.title}`)
        console.log(`             ID: ${s.id}`)
        console.log(`             Total pages: ${s.totalPages}\n`)
      })
    }

    // Summary
    console.log('='.repeat(60))
    console.log('SUMMARY')
    console.log('='.repeat(60))
    console.log(`  Complete per-page audio: ${hasPerPageAudio.length}`)
    console.log(`  Needs regeneration:      ${needsRegeneration.length}`)
    console.log(`  No audio at all:         ${noAudioAtAll.length}`)
    console.log(`  Total published:         ${storiesSnapshot.size}`)

    // Return IDs for regeneration
    if (needsRegeneration.length > 0 || noAudioAtAll.length > 0) {
      console.log('\n' + '='.repeat(60))
      console.log('STORY IDs TO REGENERATE')
      console.log('='.repeat(60))
      const allIds = [...needsRegeneration.map(s => s.id), ...noAudioAtAll.map(s => s.id)]
      console.log(JSON.stringify(allIds, null, 2))
    }
  } catch (error) {
    console.error('Error checking stories:', error)
  }

  process.exit(0)
}

checkStoryAudio()
