/**
 * Backfill missing translations for stories
 * Uses OpenAI to generate English translations for Japanese story pages
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

async function generateTranslation(japaneseText) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional Japanese to English translator for children\'s stories. Translate the Japanese text to natural, simple English suitable for language learners. Only return the translation, no explanations.'
        },
        {
          role: 'user',
          content: japaneseText
        }
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

async function backfillTranslations() {
  console.log('🌐 Story Translation Backfill\n')

  try {
    // Get all published stories
    const snapshot = await db.collection('stories').where('status', '==', 'published').get()

    console.log(`Found ${snapshot.size} published stories\n`)

    const storiesNeedingTranslations = []

    // Find stories with missing translations
    snapshot.forEach(doc => {
      const data = doc.data()
      const pages = data.pages || []

      const pagesWithMissingTranslations = pages.filter(
        p => p.text && !p.translation && !p.textEn
      )

      if (pagesWithMissingTranslations.length > 0) {
        storiesNeedingTranslations.push({
          id: doc.id,
          title: data.titleJa || data.title,
          titleEn: data.title,
          pages: pages,
          missingCount: pagesWithMissingTranslations.length,
        })
      }
    })

    console.log('═'.repeat(80))
    console.log(`📊 Found ${storiesNeedingTranslations.length} stories needing translations`)
    console.log('═'.repeat(80))
    console.log()

    if (storiesNeedingTranslations.length === 0) {
      console.log('✅ All stories have translations!')
      process.exit(0)
    }

    // Display stories
    console.log('Stories to process:\n')
    storiesNeedingTranslations.forEach((story, index) => {
      console.log(`${index + 1}. ${story.title}`)
      console.log(`   ID: ${story.id}`)
      console.log(`   Missing: ${story.missingCount}/${story.pages.length} page translations`)
      console.log()
    })

    console.log('═'.repeat(80))
    console.log('⏳ Starting translation in 3 seconds...')
    console.log('   Press Ctrl+C to cancel')
    console.log('═'.repeat(80))
    console.log()

    await new Promise(resolve => setTimeout(resolve, 3000))

    let totalTranslated = 0
    let storiesUpdated = 0

    for (const story of storiesNeedingTranslations) {
      console.log(`\n🔄 Processing: ${story.title}`)
      console.log(`   ID: ${story.id}`)

      const updatedPages = [...story.pages]
      let pagesTranslated = 0

      for (let i = 0; i < updatedPages.length; i++) {
        const page = updatedPages[i]

        // Skip if already has translation
        if (page.translation || page.textEn) {
          continue
        }

        // Skip if no Japanese text
        if (!page.text) {
          console.log(`   ⏭️  Page ${i + 1}: No Japanese text, skipping`)
          continue
        }

        try {
          console.log(`   🌐 Translating page ${i + 1}...`)

          // Strip HTML tags from Japanese text for translation
          const cleanText = page.text.replace(/<[^>]*>/g, '')

          const translation = await generateTranslation(cleanText)

          updatedPages[i] = {
            ...page,
            translation: translation,
          }

          pagesTranslated++
          totalTranslated++

          console.log(`   ✓ Page ${i + 1} translated`)

          // Rate limiting: wait 500ms between API calls
          await new Promise(resolve => setTimeout(resolve, 500))

        } catch (error) {
          console.error(`   ❌ Page ${i + 1} translation failed:`, error.message)
        }
      }

      // Update story in Firestore if any pages were translated
      if (pagesTranslated > 0) {
        try {
          await db.collection('stories').doc(story.id).update({
            pages: updatedPages,
            updatedAt: new Date(),
          })

          storiesUpdated++
          console.log(`   ✅ Updated ${pagesTranslated} pages in Firestore`)

        } catch (error) {
          console.error(`   ❌ Failed to update Firestore:`, error.message)
        }
      } else {
        console.log(`   ⏭️  No translations needed`)
      }
    }

    console.log('\n═'.repeat(80))
    console.log('✅ TRANSLATION COMPLETE')
    console.log('═'.repeat(80))
    console.log(`  Total pages translated: ${totalTranslated}`)
    console.log(`  Stories updated: ${storiesUpdated}/${storiesNeedingTranslations.length}`)
    console.log()

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n❌ Translation cancelled by user')
  process.exit(0)
})

backfillTranslations()
