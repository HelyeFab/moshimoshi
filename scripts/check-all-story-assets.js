/**
 * Comprehensive Story Assets Checker
 * Checks all published stories for missing images, audio, and translations
 * Run with: node scripts/check-all-story-assets.js
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

async function checkAllStoryAssets() {
  console.log('🔍 Checking all published stories for missing assets...\n')

  try {
    // Get all published stories
    const storiesSnapshot = await db.collection('stories').where('status', '==', 'published').get()

    console.log(`📚 Found ${storiesSnapshot.size} published stories\n`)

    const report = {
      total: storiesSnapshot.size,
      healthy: [],
      missingImages: [],
      missingAudio: [],
      missingTranslations: [],
      missingMultiple: [],
      cannotRepair: []
    }

    for (const doc of storiesSnapshot.docs) {
      const story = doc.data()
      const storyId = doc.id
      const title = story.titleJa || story.title || 'Untitled'
      const pages = story.pages || []
      const totalPages = pages.length

      // Check images
      const hasCoverImage = !!story.coverImageUrl
      const pagesWithImages = pages.filter(p => !!p.imageUrl).length
      const missingImageCount = totalPages - pagesWithImages
      const hasImageIssues = !hasCoverImage || missingImageCount > 0

      // Check audio
      const hasFullAudio = !!story.fullAudioUrl
      const pagesWithAudio = pages.filter(p => !!p.audioUrl).length
      const missingAudioCount = totalPages - pagesWithAudio
      const hasAudioIssues = !hasFullAudio || missingAudioCount > 0
      const audioStatus = story.audioStatus

      // Check translations
      const pagesWithTranslations = pages.filter(p => !!(p.translation || p.textEn)).length
      const missingTranslationCount = totalPages - pagesWithTranslations
      const hasTranslationIssues = missingTranslationCount > 0

      // Check if repairable
      const hasCharacterSheet = !!story.characterSheet
      const canRepair = hasCharacterSheet

      // Build issue object
      const storyIssue = {
        id: storyId,
        title,
        totalPages,
        issues: {
          images: hasImageIssues,
          audio: hasAudioIssues,
          translations: hasTranslationIssues
        },
        details: {
          coverImage: hasCoverImage,
          pagesWithImages: `${pagesWithImages}/${totalPages}`,
          missingImages: missingImageCount,
          fullAudio: hasFullAudio,
          pagesWithAudio: `${pagesWithAudio}/${totalPages}`,
          missingAudio: missingAudioCount,
          audioStatus: audioStatus || 'unknown',
          pagesWithTranslations: `${pagesWithTranslations}/${totalPages}`,
          missingTranslations: missingTranslationCount
        },
        canRepair,
        hasCharacterSheet
      }

      // Categorize
      const issueCount = [hasImageIssues, hasAudioIssues, hasTranslationIssues].filter(Boolean).length

      if (issueCount === 0) {
        report.healthy.push(storyIssue)
      } else {
        if (issueCount > 1) {
          report.missingMultiple.push(storyIssue)
        }
        if (hasImageIssues) report.missingImages.push(storyIssue)
        if (hasAudioIssues) report.missingAudio.push(storyIssue)
        if (hasTranslationIssues) report.missingTranslations.push(storyIssue)
        if (!canRepair && (hasImageIssues || hasAudioIssues)) {
          report.cannotRepair.push(storyIssue)
        }
      }
    }

    // Print Report
    console.log('═'.repeat(80))
    console.log('📊 COMPREHENSIVE STORY ASSETS REPORT')
    console.log('═'.repeat(80))
    console.log()

    // Summary
    console.log('📈 SUMMARY')
    console.log('─'.repeat(80))
    console.log(`  ✅ Healthy stories:              ${report.healthy.length}`)
    console.log(`  🖼️  Stories missing images:       ${report.missingImages.length}`)
    console.log(`  🔊 Stories missing audio:        ${report.missingAudio.length}`)
    console.log(`  🌐 Stories missing translations: ${report.missingTranslations.length}`)
    console.log(`  ⚠️  Stories with multiple issues: ${report.missingMultiple.length}`)
    console.log(`  🚫 Cannot repair (no charSheet): ${report.cannotRepair.length}`)
    console.log(`  📚 Total published:              ${report.total}`)
    console.log()

    // Healthy Stories
    if (report.healthy.length > 0) {
      console.log('✅ HEALTHY STORIES (All assets present)')
      console.log('─'.repeat(80))
      report.healthy.forEach(s => {
        console.log(`  • ${s.title}`)
        console.log(`    ID: ${s.id}`)
      })
      console.log()
    }

    // Stories with multiple issues
    if (report.missingMultiple.length > 0) {
      console.log('⚠️  STORIES WITH MULTIPLE MISSING ASSETS (Priority Repair)')
      console.log('─'.repeat(80))
      report.missingMultiple.forEach(s => {
        const issues = []
        if (s.issues.images) issues.push('🖼️  Images')
        if (s.issues.audio) issues.push('🔊 Audio')
        if (s.issues.translations) issues.push('🌐 Translations')

        console.log(`  • ${s.title}`)
        console.log(`    ID: ${s.id}`)
        console.log(`    Issues: ${issues.join(', ')}`)
        console.log(`    Images: ${s.details.pagesWithImages} (${s.details.missingImages} missing)`)
        console.log(`    Audio: ${s.details.pagesWithAudio} (${s.details.missingAudio} missing)`)
        console.log(`    Translations: ${s.details.pagesWithTranslations} (${s.details.missingTranslations} missing)`)
        console.log(`    Can repair: ${s.canRepair ? 'YES ✓' : 'NO ✗ (no characterSheet)'}`)
        console.log()
      })
    }

    // Missing Images Detail
    if (report.missingImages.length > 0) {
      console.log('🖼️  STORIES MISSING IMAGES')
      console.log('─'.repeat(80))
      report.missingImages.forEach(s => {
        console.log(`  • ${s.title}`)
        console.log(`    ID: ${s.id}`)
        console.log(`    Cover image: ${s.details.coverImage ? 'Present' : 'MISSING'}`)
        console.log(`    Page images: ${s.details.pagesWithImages} (${s.details.missingImages} missing)`)
        console.log(`    Can repair: ${s.canRepair ? 'YES ✓' : 'NO ✗'}`)
        console.log()
      })
    }

    // Missing Audio Detail
    if (report.missingAudio.length > 0) {
      console.log('🔊 STORIES MISSING AUDIO')
      console.log('─'.repeat(80))
      report.missingAudio.forEach(s => {
        console.log(`  • ${s.title}`)
        console.log(`    ID: ${s.id}`)
        console.log(`    Full audio: ${s.details.fullAudio ? 'Present' : 'MISSING'}`)
        console.log(`    Page audio: ${s.details.pagesWithAudio} (${s.details.missingAudio} missing)`)
        console.log(`    Audio status: ${s.details.audioStatus}`)
        console.log()
      })
    }

    // Missing Translations Detail
    if (report.missingTranslations.length > 0) {
      console.log('🌐 STORIES MISSING TRANSLATIONS')
      console.log('─'.repeat(80))
      report.missingTranslations.forEach(s => {
        console.log(`  • ${s.title}`)
        console.log(`    ID: ${s.id}`)
        console.log(`    Pages with translations: ${s.details.pagesWithTranslations} (${s.details.missingTranslations} missing)`)
        console.log()
      })
    }

    // Cannot Repair
    if (report.cannotRepair.length > 0) {
      console.log('🚫 STORIES THAT CANNOT BE AUTO-REPAIRED (Missing characterSheet)')
      console.log('─'.repeat(80))
      report.cannotRepair.forEach(s => {
        console.log(`  • ${s.title}`)
        console.log(`    ID: ${s.id}`)
        console.log(`    Missing: Images=${s.issues.images}, Audio=${s.issues.audio}`)
        console.log()
      })
    }

    // Action Items
    console.log('═'.repeat(80))
    console.log('🔧 RECOMMENDED ACTIONS')
    console.log('═'.repeat(80))

    if (report.missingImages.filter(s => s.canRepair).length > 0) {
      console.log('\n1. Repair missing images:')
      console.log('   Run: Trigger integrity checker via admin dashboard')
      console.log('   Or manually repair via: /api/admin/repair-story-images')
      const repairableImageIds = report.missingImages.filter(s => s.canRepair).map(s => s.id)
      console.log(`   Story IDs: ${JSON.stringify(repairableImageIds.slice(0, 5))}${repairableImageIds.length > 5 ? ` (+ ${repairableImageIds.length - 5} more)` : ''}`)
    }

    if (report.missingAudio.length > 0) {
      console.log('\n2. Repair missing audio:')
      console.log('   Run: Trigger integrity checker via admin dashboard')
      console.log('   Or manually regenerate: node scripts/regenerate-story-audio.js [storyId]')
      const audioIds = report.missingAudio.map(s => s.id)
      console.log(`   Story IDs: ${JSON.stringify(audioIds.slice(0, 5))}${audioIds.length > 5 ? ` (+ ${audioIds.length - 5} more)` : ''}`)
    }

    if (report.cannotRepair.length > 0) {
      console.log('\n3. Stories without characterSheet need manual intervention:')
      console.log('   These stories cannot be auto-repaired and may need republishing')
      report.cannotRepair.forEach(s => console.log(`   - ${s.id}: ${s.title}`))
    }

    console.log('\n═'.repeat(80))
    console.log('✨ Check complete!')
    console.log('═'.repeat(80))

  } catch (error) {
    console.error('❌ Error checking stories:', error)
    process.exit(1)
  }

  process.exit(0)
}

checkAllStoryAssets()
