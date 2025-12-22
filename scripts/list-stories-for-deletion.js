/**
 * List all stories sorted by date to identify duplicates/unwanted stories
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function listStories() {
  console.log('📚 Listing all published stories sorted by creation date\n')

  try {
    // Get all published stories (no orderBy to avoid index requirement)
    const snapshot = await db
      .collection('stories')
      .where('status', '==', 'published')
      .get()

    console.log(`Found ${snapshot.size} published stories\n`)

    const stories = []
    snapshot.forEach(doc => {
      const data = doc.data()
      stories.push({
        id: doc.id,
        title: data.titleJa || data.title || 'Untitled',
        titleEn: data.title,
        createdAt: data.createdAt?.toDate?.() || new Date(0),
        theme: data.theme || 'unknown',
        pages: (data.pages || []).length,
      })
    })

    // Sort by createdAt descending (most recent first)
    stories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // Group by theme to identify duplicates
    console.log('═'.repeat(100))
    console.log('ALL STORIES (Most Recent First)')
    console.log('═'.repeat(100))

    stories.forEach((story, index) => {
      const dateStr = story.createdAt.toISOString().split('T')[0]
      const timeStr = story.createdAt.toISOString().split('T')[1].substring(0, 8)

      console.log(`${index + 1}. ${story.title}`)
      console.log(`   EN: ${story.titleEn}`)
      console.log(`   ID: ${story.id}`)
      console.log(`   Created: ${dateStr} ${timeStr}`)
      console.log(`   Theme: ${story.theme} | Pages: ${story.pages}`)
      console.log()
    })

    // Find Mika's Cooking Adventure
    const mikaIndex = stories.findIndex(s =>
      s.title.includes('みかの料理') || s.titleEn?.includes('Mika\'s Cooking')
    )

    // Find last New Year Celebration
    const newYearIndices = stories
      .map((s, i) => ({ index: i, story: s }))
      .filter(({ story }) =>
        story.title.includes('新年') ||
        story.titleEn?.includes('New Year')
      )

    console.log('═'.repeat(100))
    console.log('🎯 KEY STORIES IDENTIFIED')
    console.log('═'.repeat(100))

    if (mikaIndex !== -1) {
      console.log(`\n✅ Mika's Cooking Adventure found at position ${mikaIndex + 1}`)
      console.log(`   ID: ${stories[mikaIndex].id}`)
      console.log(`   Created: ${stories[mikaIndex].createdAt.toISOString()}`)
    }

    if (newYearIndices.length > 0) {
      console.log(`\n✅ Found ${newYearIndices.length} New Year Celebration stories:`)
      newYearIndices.forEach(({ index, story }) => {
        console.log(`   ${index + 1}. ${story.title} (${story.titleEn})`)
        console.log(`      ID: ${story.id}`)
        console.log(`      Created: ${story.createdAt.toISOString()}`)
      })
    }

    // Stories between Mika and newest New Year
    if (mikaIndex !== -1 && newYearIndices.length > 0) {
      const newestNewYearIndex = newYearIndices[0].index // First one is newest

      console.log('\n═'.repeat(100))
      console.log('🗑️  STORIES TO DELETE (Between newest New Year and Mika\'s Cooking)')
      console.log('═'.repeat(100))

      if (newestNewYearIndex < mikaIndex) {
        const toDelete = stories.slice(newestNewYearIndex + 1, mikaIndex)

        if (toDelete.length === 0) {
          console.log('\n✅ No stories to delete - they are adjacent!')
        } else {
          console.log(`\n⚠️  Found ${toDelete.length} stories to delete:\n`)
          toDelete.forEach((story, index) => {
            console.log(`${index + 1}. ${story.title}`)
            console.log(`   ID: ${story.id}`)
            console.log(`   Created: ${story.createdAt.toISOString()}`)
            console.log()
          })

          // Output deletion command
          console.log('═'.repeat(100))
          console.log('💻 DELETION COMMAND')
          console.log('═'.repeat(100))
          console.log('\nTo delete these stories, run:')
          console.log('node scripts/delete-stories.js \\')
          toDelete.forEach(story => {
            console.log(`  ${story.id} \\`)
          })
          console.log()

          // JSON array for easier processing
          console.log('Or use this JSON array:')
          console.log(JSON.stringify(toDelete.map(s => s.id), null, 2))
        }
      } else {
        console.log('\n⚠️  Cannot determine deletion range - Mika\'s story is newer than New Year stories')
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

listStories()
