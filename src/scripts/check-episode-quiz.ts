/**
 * Check specific episode quiz data
 */

import admin from 'firebase-admin'
import * as path from 'path'

const serviceAccountPath = path.join(
  process.cwd(),
  'moshimoshi-service-account.json'
)

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  })
}

const db = admin.firestore()

async function checkEpisodeQuiz() {
  // First, list all episodes
  const allEpisodes = await db.collection('comic_episodes').get()
  console.log('\n📚 Available episodes:')
  allEpisodes.docs.forEach(doc => {
    const data = doc.data()
    console.log(`  - ${doc.id} (${data.title})`)
  })

  const episodeId = allEpisodes.docs[0]?.id || 'moshi-goes-to-japan-ep001'
  console.log(`\n🔍 Checking episode: ${episodeId}`)

  const doc = await db.collection('comic_episodes').doc(episodeId).get()

  if (!doc.exists) {
    console.log('Episode not found')
    return
  }

  const data = doc.data()
  console.log('\n📚 Episode:', episodeId)
  console.log('Title:', data?.title)

  if (!data?.quiz?.questions) {
    console.log('No quiz found')
    return
  }

  const questions = data.quiz.questions

  console.log('\n🧪 Quiz Questions:')
  questions.forEach((q: any, index: number) => {
    console.log(`\n${index + 1}. Question ID: ${q.id}`)
    console.log(`   Question: ${q.question}`)
    console.log(`   Options: ${q.options?.length || 0}`)
    console.log(`   correctAnswer: ${q.correctAnswer}`)
    console.log(`   Type: ${q.type}`)
  })

  // Check for duplicates
  const ids = questions.map((q: any) => q.id)
  const duplicates = ids.filter((id: string, index: number) => ids.indexOf(id) !== index)

  if (duplicates.length > 0) {
    console.log('\n❌ Duplicate IDs:', duplicates)
  } else {
    console.log('\n✓ All IDs are unique')
  }
}

checkEpisodeQuiz().catch(console.error).finally(() => process.exit(0))
