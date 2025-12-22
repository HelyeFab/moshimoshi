/**
 * Check story cover image configuration
 * Verifies if cover is using model sheet vs first page image
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkStoryCover() {
  const storyId = process.argv[2] || 'story_1766343175311_scheduler-system'

  console.log('🔍 Checking Story Cover Configuration\n')
  console.log('Story ID:', storyId)
  console.log('═'.repeat(80))
  console.log()

  try {
    const doc = await db.collection('stories').doc(storyId).get()

    if (!doc.exists) {
      console.log('❌ Story not found')
      process.exit(1)
    }

    const data = doc.data()

    console.log('📖 Story Details:')
    console.log('  Title (JA):', data.titleJa || 'N/A')
    console.log('  Title (EN):', data.title || 'N/A')
    console.log('  Total Pages:', (data.pages || []).length)
    console.log()

    console.log('═'.repeat(80))
    console.log('🖼️  IMAGE ANALYSIS')
    console.log('═'.repeat(80))
    console.log()

    // Cover Image
    const coverImageUrl = data.coverImageUrl || null
    console.log('1. Cover Image URL:')
    if (coverImageUrl) {
      console.log(`   ${coverImageUrl}`)
      console.log()
    } else {
      console.log('   ❌ NOT SET')
      console.log()
    }

    // Model Sheet
    const modelSheetUrl = data.modelSheet?.imageUrl || data.characterSheet?.modelSheet?.imageUrl || null
    console.log('2. Model Sheet URL:')
    if (modelSheetUrl) {
      console.log(`   ${modelSheetUrl}`)
      console.log()
    } else {
      console.log('   ❌ NOT SET')
      console.log()
    }

    // First Page Image
    const pages = data.pages || []
    const firstPageImageUrl = pages.length > 0 ? pages[0].imageUrl || null : null
    console.log('3. First Page Image URL:')
    if (firstPageImageUrl) {
      console.log(`   ${firstPageImageUrl}`)
      console.log()
    } else {
      console.log('   ❌ NOT SET')
      console.log()
    }

    // All page images
    console.log('4. All Page Images:')
    if (pages.length > 0) {
      pages.forEach((page, index) => {
        const pageNum = page.pageNumber || (index + 1)
        const hasImage = !!page.imageUrl
        console.log(`   Page ${pageNum}: ${hasImage ? '✓ Has image' : '✗ Missing'}`)
        if (hasImage && index < 3) {
          console.log(`            ${page.imageUrl}`)
        }
      })
      console.log()
    } else {
      console.log('   ❌ No pages found')
      console.log()
    }

    // Analysis
    console.log('═'.repeat(80))
    console.log('📊 ANALYSIS')
    console.log('═'.repeat(80))
    console.log()

    if (!coverImageUrl) {
      console.log('⚠️  Cover image is NOT SET')
    } else if (coverImageUrl === modelSheetUrl) {
      console.log('🔴 ISSUE DETECTED: Cover is using MODEL SHEET')
      console.log()
      console.log('   Current Behavior:')
      console.log('   - Cover shows character reference sheet (3-pose turnaround)')
      console.log('   - This is the reference image used for consistency, not a story page')
      console.log()
      console.log('   Expected Behavior:')
      console.log('   - Cover should use first page image')
      console.log()
      console.log('   Fix Required: Update coverImageUrl to first page image')
    } else if (coverImageUrl === firstPageImageUrl) {
      console.log('✅ Cover is correctly using FIRST PAGE IMAGE')
    } else {
      console.log('⚠️  Cover is using a DIFFERENT image (not model sheet, not first page)')
      console.log()
      console.log('   This might be intentional or an older story')
    }

    console.log()
    console.log('═'.repeat(80))
    console.log('🔧 RECOMMENDED ACTION')
    console.log('═'.repeat(80))
    console.log()

    if (coverImageUrl === modelSheetUrl && firstPageImageUrl) {
      console.log('Run the following command to fix:')
      console.log()
      console.log(`  node scripts/fix-story-cover.js ${storyId}`)
      console.log()
      console.log('This will update the cover to use the first page image.')
    } else if (!coverImageUrl && firstPageImageUrl) {
      console.log('Cover is missing. Run:')
      console.log()
      console.log(`  node scripts/fix-story-cover.js ${storyId}`)
    } else if (!firstPageImageUrl) {
      console.log('❌ Cannot fix: First page has no image')
      console.log('   Story needs image generation first')
    } else {
      console.log('✅ No action needed - cover is correctly configured')
    }

    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

checkStoryCover()
