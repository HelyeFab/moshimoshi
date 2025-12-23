/**
 * Add Furigana to Comic Episodes Script
 *
 * Adds furigana (ruby tags) to comic episodes 1-5
 * - Updates narration.furigana field
 * - Updates dialogue.furigana field (if missing)
 *
 * Usage:
 *   npm run add-furigana:dry-run  # Dry run - see what would change
 *   npm run add-furigana           # Live run - actually adds furigana
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Initialize Firebase Admin for this script
function initializeFirebaseForScript() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json')

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found at: ${serviceAccountPath}`)
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })

    console.log('✅ Firebase Admin initialized from service account file')
    console.log(`Project ID: ${serviceAccount.project_id}`)
  }

  return admin.firestore()
}

const db = initializeFirebaseForScript()

interface FuriganaResult {
  episodesProcessed: number
  narrationsUpdated: number
  dialoguesUpdated: number
  errors: Array<{ episodeId: string; error: string }>
  dryRun: boolean
}

/**
 * Generate furigana with ruby tags for Japanese text using OpenAI
 */
async function generateFurigana(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a Japanese language expert. Add furigana (readings) to Japanese text using HTML ruby tags.

IMPORTANT RULES:
1. Use format: <ruby>漢字<rt>かんじ</rt></ruby>
2. Only add furigana to kanji, not hiragana or katakana
3. Use correct readings based on context
4. Preserve all punctuation and spacing exactly
5. Return ONLY the text with ruby tags, no explanations

Example input: 浅草寺の大きな門を見て、興奮しています。
Example output: <ruby>浅草寺<rt>せんそうじ</rt></ruby>の<ruby>大<rt>おお</rt></ruby>きな<ruby>門<rt>もん</rt></ruby>を<ruby>見<rt>み</rt></ruby>て、<ruby>興奮<rt>こうふん</rt></ruby>しています。`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3, // Low temperature for consistent output
      max_tokens: 1000,
    })

    const furiganaText = response.choices[0]?.message?.content?.trim() || text
    return furiganaText
  } catch (error) {
    console.error('Error generating furigana:', error)
    return text // Return original text on error
  }
}

/**
 * Add furigana to comic episodes 1-5
 */
async function addComicFurigana(dryRun = true): Promise<FuriganaResult> {
  console.log('\n=== Add Comic Furigana ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will modify data)'}`)
  console.log(`Started at: ${new Date().toISOString()}\n`)

  const result: FuriganaResult = {
    episodesProcessed: 0,
    narrationsUpdated: 0,
    dialoguesUpdated: 0,
    errors: [],
    dryRun,
  }

  if (!db) {
    throw new Error('Firebase Admin not initialized. Check your credentials.')
  }

  try {
    // Fetch comic episodes 1-5
    console.log('📖 Fetching comic episodes 1-5...\n')
    const episodesSnapshot = await db
      .collection('comics')
      .where('episodeNumber', '>=', 1)
      .where('episodeNumber', '<=', 5)
      .get()

    console.log(`Found ${episodesSnapshot.size} episodes\n`)

    for (const episodeDoc of episodesSnapshot.docs) {
      const episodeId = episodeDoc.id
      const episode = episodeDoc.data()
      const episodeNumber = episode.episodeNumber

      console.log(`\n📚 Processing Episode ${episodeNumber} (${episodeId})`)

      if (!episode.panels || !Array.isArray(episode.panels)) {
        console.log('  ⚠️  No panels found, skipping...')
        continue
      }

      const updatedPanels = []

      for (let i = 0; i < episode.panels.length; i++) {
        const panel = episode.panels[i]
        const updatedPanel = { ...panel }
        let panelModified = false

        // Process narration
        if (panel.narration?.textJa) {
          if (!panel.narration.furigana) {
            console.log(`  📝 Panel ${panel.panelNumber}: Generating narration furigana...`)
            const furigana = await generateFurigana(panel.narration.textJa)
            console.log(`     Original: ${panel.narration.textJa.substring(0, 50)}...`)
            console.log(`     Furigana: ${furigana.substring(0, 80)}...`)

            updatedPanel.narration = {
              ...panel.narration,
              furigana,
            }
            result.narrationsUpdated++
            panelModified = true
          } else {
            console.log(`  ✓ Panel ${panel.panelNumber}: Narration already has furigana`)
          }
        }

        // Process dialogues
        if (panel.dialogues && Array.isArray(panel.dialogues)) {
          const updatedDialogues = []

          for (let j = 0; j < panel.dialogues.length; j++) {
            const dialogue = panel.dialogues[j]
            const updatedDialogue = { ...dialogue }

            if (dialogue.textJa && !dialogue.furigana) {
              console.log(
                `  💬 Panel ${panel.panelNumber}, Dialogue ${j + 1} (${dialogue.characterName}): Generating furigana...`
              )
              const furigana = await generateFurigana(dialogue.textJa)
              console.log(`     Original: ${dialogue.textJa}`)
              console.log(`     Furigana: ${furigana}`)

              updatedDialogue.furigana = furigana
              result.dialoguesUpdated++
              panelModified = true
            } else if (dialogue.furigana) {
              console.log(
                `  ✓ Panel ${panel.panelNumber}, Dialogue ${j + 1}: Already has furigana`
              )
            }

            updatedDialogues.push(updatedDialogue)
          }

          updatedPanel.dialogues = updatedDialogues
        }

        updatedPanels.push(updatedPanel)
      }

      // Update the episode document
      if (!dryRun) {
        console.log(`\n  💾 Updating episode ${episodeNumber} in Firestore...`)
        await episodeDoc.ref.update({
          panels: updatedPanels,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log(`  ✅ Episode ${episodeNumber} updated successfully`)
      } else {
        console.log(`\n  🔍 DRY RUN: Would update episode ${episodeNumber}`)
      }

      result.episodesProcessed++
    }

    console.log('\n=== Summary ===')
    console.log(`Episodes processed: ${result.episodesProcessed}`)
    console.log(`Narrations updated: ${result.narrationsUpdated}`)
    console.log(`Dialogues updated: ${result.dialoguesUpdated}`)
    console.log(`Errors: ${result.errors.length}`)
    console.log(
      `\nCompleted at: ${new Date().toISOString()}`
    )

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made')
      console.log('Run with --live flag to actually update the data')
    }

    return result
  } catch (error) {
    console.error('Fatal error:', error)
    throw error
  }
}

// Main execution
const dryRun = !process.argv.includes('--live')
addComicFurigana(dryRun)
  .then(result => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
