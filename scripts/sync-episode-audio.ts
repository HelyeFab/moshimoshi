/**
 * Sync audio URLs from comic_sentence_data to published comics
 * Usage: npx tsx scripts/sync-episode-audio.ts <episodeId>
 */

import * as admin from 'firebase-admin'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as serviceAccount from '../moshimoshi-service-account.json'

if (admin.apps.length === 0) {
  initializeApp({
    credential: cert(serviceAccount as admin.ServiceAccount),
  })
}

const db = getFirestore()

async function syncAudio(episodeId: string) {
  console.log(`\nSyncing audio for: ${episodeId}\n`)

  // Get sentence data
  const sentenceDoc = await db.collection('comic_sentence_data').doc(episodeId).get()
  if (!sentenceDoc.exists) {
    console.log('No sentence data found')
    return
  }
  const sentenceData = sentenceDoc.data()!

  // Get published comic
  const comicDoc = await db.collection('comics').doc(episodeId).get()
  if (!comicDoc.exists) {
    console.log('No comic found')
    return
  }
  const comic = comicDoc.data()!

  let updatedCount = 0

  // Update panels with audio URLs
  const updatedPanels = comic.panels.map((panel: any, pIndex: number) => {
    const panelNumber = pIndex + 1

    // Update dialogues
    const updatedDialogues =
      panel.dialogues?.map((dialogue: any, dIndex: number) => {
        const sentenceDialogue = sentenceData.dialogues?.find(
          (d: any) => d.panelNumber === panelNumber && d.dialogueIndex === dIndex
        )
        if (sentenceDialogue?.audioUrl && !dialogue.audioUrl) {
          console.log(`Panel ${panelNumber} dialogue ${dIndex}: Adding audio URL`)
          updatedCount++
          return { ...dialogue, audioUrl: sentenceDialogue.audioUrl }
        }
        return dialogue
      }) || []

    // Update narration
    const sentenceNarration = sentenceData.narrations?.find(
      (n: any) => n.panelNumber === panelNumber
    )
    let updatedNarration = panel.narration
    if (panel.narration && sentenceNarration?.audioUrl && !panel.narration.audioUrl) {
      console.log(`Panel ${panelNumber} narration: Adding audio URL`)
      updatedCount++
      updatedNarration = { ...panel.narration, audioUrl: sentenceNarration.audioUrl }
    }

    return { ...panel, dialogues: updatedDialogues, narration: updatedNarration }
  })

  if (updatedCount === 0) {
    console.log('No updates needed - all audio URLs already present')
    return
  }

  // Save updated comic
  await db.collection('comics').doc(episodeId).update({
    panels: updatedPanels,
    audioStatus: 'complete',
    updatedAt: new Date(),
  })

  console.log(`\n✓ Updated ${updatedCount} audio URLs`)
}

// Main
const episodeId = process.argv[2] || 'moshi-goes-to-japan-ep002'
syncAudio(episodeId)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch(err => {
    console.error('\nError:', err)
    process.exit(1)
  })
