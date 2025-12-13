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

async function checkGenerationState() {
  // Check comic_drafts collection (top level)
  console.log('\n=== COMIC DRAFTS (top level) ===')
  const topDraftsSnap = await db.collection('comic_drafts').orderBy('createdAt', 'desc').limit(5).get()

  if (topDraftsSnap.empty) {
    console.log('No drafts in comic_drafts')
  } else {
    topDraftsSnap.docs.forEach(doc => {
      const data = doc.data()
      console.log(`Draft ${doc.id}:`)
      console.log(`  Episode: ${data.episodeNumber}`)
      console.log(`  Title: ${data.title || data.outline?.title || 'N/A'}`)
      console.log(`  Status: ${data.status}`)
      console.log(`  Current Step: ${data.currentStep || 'N/A'}`)
      console.log(`  Created: ${data.createdAt?.toDate?.() || 'N/A'}`)
      console.log(`  Has panels: ${data.panels?.length || 0}`)
      console.log(`  Has vocabulary: ${data.vocabulary?.length > 0}`)
      console.log(`  Has cultural notes: ${data.culturalNotes?.length > 0}`)
      console.log(`  Has quiz: ${data.quiz?.questions?.length > 0}`)

      // Check panels for audio and images
      if (data.panels?.length) {
        data.panels.forEach((p: any, i: number) => {
          const hasImage = Boolean(p.imageUrl)
          const hasAudio = Boolean(p.audioUrl)
          console.log(`    Panel ${i + 1}: Image=${hasImage}, Audio=${hasAudio}`)
        })
      }
    })
  }

  // Check comic_generation_queue
  console.log('\n=== COMIC GENERATION QUEUE ===')
  const queueSnap = await db
    .collection('comic_generation_queue')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get()

  if (queueSnap.empty) {
    console.log('No items in queue')
  } else {
    queueSnap.docs.forEach(doc => {
      const data = doc.data()
      console.log(`Queue item ${doc.id}:`)
      console.log(`  Status: ${data.status}`)
      console.log(`  Theme: ${data.theme}`)
      console.log(`  Created: ${data.createdAt?.toDate?.() || 'N/A'}`)
      console.log(`  Draft ID: ${data.draftId || 'N/A'}`)
    })
  }

  // Check for the latest draft in series subcollection
  console.log('\n=== SERIES DRAFTS (subcollection) ===')
  const seriesSnap = await db.collection('comic_series').get()

  for (const seriesDoc of seriesSnap.docs) {
    console.log(`\nSeries: ${seriesDoc.id}`)
    const draftsSnap = await db
      .collection('comic_series')
      .doc(seriesDoc.id)
      .collection('drafts')
      .orderBy('createdAt', 'desc')
      .limit(2)
      .get()

    if (draftsSnap.empty) {
      console.log('  No drafts found')
    } else {
      draftsSnap.docs.forEach(doc => {
        const data = doc.data()
        console.log(`  Draft ${doc.id}:`)
        console.log(`    Episode: ${data.episodeNumber}`)
        console.log(`    Title: ${data.title || data.outline?.title || 'N/A'}`)
        console.log(`    Status: ${data.status}`)
        console.log(`    Step: ${data.currentStep || 'N/A'}`)
      })
    }
  }

  // Check comic_episodes
  console.log('\n=== COMIC EPISODES ===')
  const episodesSnap = await db.collection('comic_episodes').orderBy('createdAt', 'desc').limit(3).get()

  if (episodesSnap.empty) {
    console.log('No episodes found')
  } else {
    episodesSnap.docs.forEach(doc => {
      const data = doc.data()
      console.log(`Episode ${doc.id}:`)
      console.log(`  Title: ${data.title}`)
      console.log(`  Status: ${data.status}`)
    })
  }

  // Check comic_sentence_data (audio pre-generation)
  console.log('\n=== COMIC SENTENCE DATA (Audio) ===')
  const sentenceSnap = await db.collection('comic_sentence_data').limit(5).get()

  if (sentenceSnap.empty) {
    console.log('No sentence data found (no audio generated)')
  } else {
    sentenceSnap.docs.forEach(doc => {
      const data = doc.data()
      console.log(`Sentence data ${doc.id}:`)
      console.log(`  Title: ${data.title}`)
      console.log(`  Dialogues: ${data.dialogues?.length || 0}`)
      console.log(`  Narrations: ${data.narrations?.length || 0}`)
      console.log(`  Full audio URL: ${data.fullAudioUrl ? 'YES' : 'NO'}`)
      console.log(`  Generated at: ${data.generatedAt?.toDate?.() || 'N/A'}`)

      // Check how many dialogues have audio
      if (data.dialogues?.length) {
        const withAudio = data.dialogues.filter((d: any) => Boolean(d.audioUrl)).length
        console.log(`  Dialogues with audio: ${withAudio}/${data.dialogues.length}`)
      }
    })
  }
}

checkGenerationState()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
