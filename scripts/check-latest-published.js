/**
 * Check the latest published story
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkLatestPublished() {
  console.log('📖 Checking Latest Published Story')
  console.log('═'.repeat(80))
  console.log()

  try {
    const snapshot = await db
      .collection('stories')
      .where('status', '==', 'published')
      .get()

    if (snapshot.empty) {
      console.log('No published stories found')
      process.exit(0)
    }

    // Sort by createdAt in memory
    const stories = snapshot.docs
      .map(doc => ({
        doc,
        createdAt: doc.data().createdAt?.toDate() || new Date(0)
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const doc = stories[0].doc
    const data = doc.data()
    const createdAt = data.createdAt?.toDate()
    const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60))

    console.log('Story ID:', doc.id)
    console.log('Created:', `${minutesAgo} minutes ago (${createdAt?.toISOString()})`)
    console.log()
    console.log('Title (EN):', data.title)
    console.log('Title (JA):', data.titleJa)
    console.log()
    console.log('JLPT Level:', data.jlptLevel)
    console.log('Theme:', data.theme)
    console.log('Pages:', data.pages?.length || 0)
    console.log()

    if (data.characterSheet?.mainCharacter) {
      const char = data.characterSheet.mainCharacter
      console.log('Main Character:')
      console.log('  Name (EN):', char.name)
      console.log('  Name (JA):', char.nameJa)
      console.log('  Age:', char.age || 'N/A')
      console.log('  Role:', char.role || 'N/A')
      console.log()
    }

    console.log('Assets:')
    console.log('  Cover Image:', data.coverImageUrl ? '✓' : '✗')
    console.log('  Story Audio:', data.audioUrl ? '✓' : '✗')
    console.log('  Model Sheet:', data.modelSheetUrl ? '✓' : '✗')
    console.log()

    console.log('View story:')
    console.log('  https://moshimoshi.app/en/story/interactive/' + doc.id)
    console.log()

    // Verify our improvements
    console.log('═'.repeat(80))
    console.log('VERIFICATION OF IMPROVEMENTS')
    console.log('═'.repeat(80))
    console.log()

    const checks = []

    // Check JLPT level (should be N3 for day 356)
    if (data.jlptLevel === 'N3') {
      checks.push('✅ JLPT Level: N3 (correct for day 356)')
    } else {
      checks.push(`⚠️  JLPT Level: ${data.jlptLevel} (expected N3 for day 356)`)
    }

    // Check character name is NOT Hana
    const charName = data.characterSheet?.mainCharacter?.name
    if (charName && charName !== 'Hana') {
      checks.push(`✅ Character Name: ${charName} (NOT "Hana")`)
    } else if (charName === 'Hana') {
      checks.push('❌ Character Name: Hana (should be avoided!)')
    }

    // Check if character is from our suggested list
    const suggestedNames = [
      'Yuki', 'Haruto', 'Kaito', 'Riku', 'Sota',
      'Aiko', 'Yui', 'Sakura', 'Rin', 'Mika',
      'Ren', 'Nao', 'Aki'
    ]
    if (charName && suggestedNames.includes(charName)) {
      checks.push(`✅ Character is from suggested list: ${charName}`)
    }

    // Check theme
    if (data.theme === 'Going to the Beach') {
      checks.push('✅ Theme: Going to the Beach (correct for day 356)')
    }

    checks.forEach(check => console.log(check))
    console.log()

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

checkLatestPublished()
