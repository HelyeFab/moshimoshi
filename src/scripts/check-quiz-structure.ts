/**
 * Check Quiz Structure Script
 * Examines current quiz data structure before migration
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

// Initialize Firebase Admin
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

    console.log('✅ Firebase Admin initialized')
  }

  return admin.firestore()
}

async function checkQuizStructure() {
  const db = initializeFirebaseForScript()

  console.log('\n=== Checking Quiz Data Structure ===\n')

  // Check stories
  const storiesSnapshot = await db
    .collection('stories')
    .where('quiz', '!=', null)
    .limit(1)
    .get()

  if (!storiesSnapshot.empty) {
    const story = storiesSnapshot.docs[0]
    const data = story.data()

    console.log('📚 STORY QUIZ STRUCTURE')
    console.log('Story ID:', story.id)
    console.log('Story Title:', data.title)
    console.log('\nFirst Quiz Question:')
    console.log(JSON.stringify(data.quiz[0], null, 2))

    if (data.quiz.length > 1) {
      console.log('\nSecond Quiz Question:')
      console.log(JSON.stringify(data.quiz[1], null, 2))
    }

    console.log('\n--- Analysis ---')
    const firstQ = data.quiz[0]
    console.log(`Has 'correctIndex': ${!!firstQ.correctIndex}`)
    console.log(`Has 'correctAnswer': ${!!firstQ.correctAnswer}`)
    console.log(`Has 'type': ${!!firstQ.type}`)
    console.log(`Has 'questionJa': ${!!firstQ.questionJa}`)
  }

  // Check drafts
  const draftsSnapshot = await db
    .collection('ai_story_drafts')
    .where('quiz', '!=', null)
    .limit(1)
    .get()

  if (!draftsSnapshot.empty) {
    const draft = draftsSnapshot.docs[0]
    const data = draft.data()

    console.log('\n\n📝 DRAFT QUIZ STRUCTURE')
    console.log('Draft ID:', draft.id)
    console.log('\nFirst Quiz Question:')
    console.log(JSON.stringify(data.quiz[0], null, 2))
  }

  // Check comics
  const comicsSnapshot = await db
    .collection('comic_episodes')
    .where('quiz', '!=', null)
    .limit(1)
    .get()

  if (!comicsSnapshot.empty) {
    const comic = comicsSnapshot.docs[0]
    const data = comic.data()

    console.log('\n\n📖 COMIC QUIZ STRUCTURE')
    console.log('Comic ID:', comic.id)
    console.log('Episode:', data.episodeNumber)
    console.log('\nFirst Quiz Question:')
    console.log(JSON.stringify(data.quiz.questions[0], null, 2))
  } else {
    console.log('\n\n📖 COMIC QUIZ STRUCTURE')
    console.log('No comics with quizzes found')
  }

  console.log('\n')
  process.exit(0)
}

checkQuizStructure().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
