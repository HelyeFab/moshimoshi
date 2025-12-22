/**
 * Compare Integrity Checker scope vs ALL stories
 * Shows why dashboard data differs from comprehensive check
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function compareScopes() {
  console.log('🔍 Comparing Integrity Checker Scope vs ALL Stories\n')

  const LOOKBACK_DAYS = 7 // Same as CONFIG.LOOKBACK_DAYS in integrityChecker.ts

  // Calculate lookback date
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS)

  console.log('═'.repeat(80))
  console.log('📅 INTEGRITY CHECKER CONFIGURATION')
  console.log('═'.repeat(80))
  console.log(`  Lookback period: Last ${LOOKBACK_DAYS} days`)
  console.log(`  Lookback date: ${lookbackDate.toISOString()}`)
  console.log(`  Max stories per run: 1`)
  console.log(`  Max articles per run: 1`)
  console.log()

  try {
    // Get ALL published stories
    const allStoriesSnapshot = await db.collection('stories').where('status', '==', 'published').get()

    // Get stories within integrity checker scope (last 7 days)
    const recentStoriesSnapshot = await db
      .collection('stories')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(lookbackDate))
      .orderBy('createdAt', 'desc')
      .get()

    console.log('═'.repeat(80))
    console.log('📊 STORY SCOPE COMPARISON')
    console.log('═'.repeat(80))
    console.log(`  ALL published stories: ${allStoriesSnapshot.size}`)
    console.log(`  Stories in last ${LOOKBACK_DAYS} days: ${recentStoriesSnapshot.size}`)
    console.log(`  Stories OUTSIDE scope: ${allStoriesSnapshot.size - recentStoriesSnapshot.size}`)
    console.log()

    // Analyze both scopes
    const analyzeScope = (snapshot, label) => {
      const stats = {
        total: snapshot.size,
        missingImages: [],
        missingAudio: [],
        missingTranslations: [],
      }

      snapshot.forEach(doc => {
        const data = doc.data()
        const pages = data.pages || []

        // Check images (same logic as integrity checker)
        const hasCoverImage = !!data.coverImageUrl
        const missingPageImages = pages.filter(p => !p.imageUrl).length
        if (!hasCoverImage || missingPageImages > 0) {
          stats.missingImages.push({
            id: doc.id,
            title: data.titleJa || data.title,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || 'unknown',
            missingPageImages,
            hasCoverImage,
          })
        }

        // Check audio (same logic as integrity checker)
        const hasFullAudio = !!data.fullAudioUrl
        const audioStatus = data.audioStatus
        const hasFailed = audioStatus === 'failed' || audioStatus === 'partial'
        if (!hasFullAudio || hasFailed) {
          stats.missingAudio.push({
            id: doc.id,
            title: data.titleJa || data.title,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || 'unknown',
            hasFullAudio,
            audioStatus,
          })
        }

        // Check translations (same logic as integrity checker)
        const pagesWithMissingTranslations = pages.filter(
          p => p.text && !p.translation && !p.textEn
        ).length
        if (pagesWithMissingTranslations > 0) {
          stats.missingTranslations.push({
            id: doc.id,
            title: data.titleJa || data.title,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || 'unknown',
            missingCount: pagesWithMissingTranslations,
            totalPages: pages.length,
          })
        }
      })

      return stats
    }

    const allStats = analyzeScope(allStoriesSnapshot, 'ALL')
    const recentStats = analyzeScope(recentStoriesSnapshot, 'RECENT')

    console.log('═'.repeat(80))
    console.log('🖼️  MISSING IMAGES COMPARISON')
    console.log('═'.repeat(80))
    console.log(`  Integrity checker sees: ${recentStats.missingImages.length} stories`)
    console.log(`  Actually exist (ALL):    ${allStats.missingImages.length} stories`)
    console.log(`  Hidden from checker:     ${allStats.missingImages.length - recentStats.missingImages.length} stories`)
    console.log()

    if (allStats.missingImages.length > recentStats.missingImages.length) {
      console.log('  Stories with missing images OUTSIDE 7-day scope:')
      const recentIds = new Set(recentStats.missingImages.map(s => s.id))
      const hidden = allStats.missingImages.filter(s => !recentIds.has(s.id))
      hidden.forEach(s => {
        console.log(`    • ${s.title}`)
        console.log(`      ID: ${s.id}`)
        console.log(`      Created: ${s.createdAt}`)
        console.log(`      Missing: ${s.missingPageImages} page images, Cover: ${s.hasCoverImage ? 'Present' : 'MISSING'}`)
        console.log()
      })
    }

    console.log('═'.repeat(80))
    console.log('🔊 MISSING AUDIO COMPARISON')
    console.log('═'.repeat(80))
    console.log(`  Integrity checker sees: ${recentStats.missingAudio.length} stories`)
    console.log(`  Actually exist (ALL):    ${allStats.missingAudio.length} stories`)
    console.log(`  Hidden from checker:     ${allStats.missingAudio.length - recentStats.missingAudio.length} stories`)
    console.log()

    if (allStats.missingAudio.length > recentStats.missingAudio.length) {
      console.log('  Stories with missing audio OUTSIDE 7-day scope:')
      const recentIds = new Set(recentStats.missingAudio.map(s => s.id))
      const hidden = allStats.missingAudio.filter(s => !recentIds.has(s.id))
      hidden.forEach(s => {
        console.log(`    • ${s.title}`)
        console.log(`      ID: ${s.id}`)
        console.log(`      Created: ${s.createdAt}`)
        console.log(`      Full audio: ${s.hasFullAudio ? 'Present' : 'MISSING'}, Status: ${s.audioStatus || 'unknown'}`)
        console.log()
      })
    }

    console.log('═'.repeat(80))
    console.log('🌐 MISSING TRANSLATIONS COMPARISON')
    console.log('═'.repeat(80))
    console.log(`  Integrity checker sees: ${recentStats.missingTranslations.length} stories`)
    console.log(`  Actually exist (ALL):    ${allStats.missingTranslations.length} stories`)
    console.log(`  Hidden from checker:     ${allStats.missingTranslations.length - recentStats.missingTranslations.length} stories`)
    console.log()

    if (allStats.missingTranslations.length > recentStats.missingTranslations.length) {
      console.log('  Stories with missing translations OUTSIDE 7-day scope:')
      const recentIds = new Set(recentStats.missingTranslations.map(s => s.id))
      const hidden = allStats.missingTranslations.filter(s => !recentIds.has(s.id))
      hidden.forEach(s => {
        console.log(`    • ${s.title}`)
        console.log(`      ID: ${s.id}`)
        console.log(`      Created: ${s.createdAt}`)
        console.log(`      Missing: ${s.missingCount}/${s.totalPages} page translations`)
        console.log()
      })
    }

    console.log('═'.repeat(80))
    console.log('💡 KEY INSIGHTS')
    console.log('═'.repeat(80))
    console.log()
    console.log('1️⃣  WHY THE DASHBOARD SHOWS DIFFERENT DATA:')
    console.log('   The integrity checker (and dashboard) ONLY looks at stories')
    console.log(`   created in the last ${LOOKBACK_DAYS} days. Older stories are invisible to it.`)
    console.log()
    console.log('2️⃣  CURRENT SITUATION:')
    console.log(`   • ${recentStoriesSnapshot.size}/${allStoriesSnapshot.size} stories are monitored by the integrity checker`)
    console.log(`   • ${allStoriesSnapshot.size - recentStoriesSnapshot.size} stories are too old and won't be auto-repaired`)
    console.log()
    console.log('3️⃣  HIDDEN ISSUES:')
    console.log(`   • ${allStats.missingImages.length - recentStats.missingImages.length} stories with missing images are OUTSIDE the 7-day scope`)
    console.log(`   • ${allStats.missingAudio.length - recentStats.missingAudio.length} stories with missing audio are OUTSIDE the 7-day scope`)
    console.log(`   • ${allStats.missingTranslations.length - recentStats.missingTranslations.length} stories with missing translations are OUTSIDE the 7-day scope`)
    console.log()
    console.log('4️⃣  RECOMMENDATIONS:')
    console.log('   a) Use the comprehensive check (check-all-story-assets.js) to find ALL issues')
    console.log('   b) For older stories, use manual repair scripts:')
    console.log('      - node scripts/repair-story-pageimages.js [storyId]')
    console.log('      - node scripts/regenerate-story-audio.js [storyId]')
    console.log('   c) Consider increasing LOOKBACK_DAYS in production if you want')
    console.log('      the integrity checker to monitor older content')
    console.log()
    console.log('═'.repeat(80))

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

compareScopes()
