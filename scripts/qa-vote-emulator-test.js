/**
 * QA Voting Emulator Test
 *
 * Verifies vote counts change exactly once when using the Firestore + Functions emulators.
 *
 * Prerequisites:
 * - Firestore emulator running on localhost:8080
 * - Functions emulator running so qa-voting triggers fire
 * - Service account JSON path passed via SERVICE_ACCOUNT or defaulting to
 *   /home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json
 *
 * Run: node scripts/qa-vote-emulator-test.js
 */

const path = require('path')
const admin = require('firebase-admin')

// Point to emulators
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'

const serviceAccountPath =
  process.env.SERVICE_ACCOUNT ||
  '/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json'

const serviceAccount = require(serviceAccountPath)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
})

const db = admin.firestore()

const questionId = 'vote-test-question'
const answerId = 'vote-test-answer'
const userA = 'userA' // author
const userB = 'userB' // voter

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForCounts(ref, expected, label) {
  for (let i = 0; i < 40; i++) {
    const snap = await ref.get()
    const data = snap.data() || {}
    const matches =
      data.upvotes === expected.upvotes &&
      data.downvotes === expected.downvotes

    if (matches) {
      console.log(`[${label}] counts OK`, data.upvotes, data.downvotes)
      return
    }
    await sleep(500)
  }
  throw new Error(`[${label}] counts did not reach expected ${JSON.stringify(expected)}`)
}

async function seed() {
  // Clean up existing docs for repeatability
  const batch = db.batch()
  batch.delete(db.collection('qa_questions').doc(questionId))
  batch.delete(db.collection('qa_answers').doc(answerId))
  batch.delete(db.collection('qa_question_votes').doc(`${userB}_${questionId}`))
  batch.delete(db.collection('qa_answer_votes').doc(`${userB}_${answerId}`))
  await batch.commit().catch(() => {})

  const now = admin.firestore.FieldValue.serverTimestamp()

  await db.collection('qa_questions').doc(questionId).set({
    title: 'Vote test question',
    content: 'Vote test question content',
    tags: ['grammar'],
    author: { uid: userA, name: 'Author' },
    upvotes: 0,
    downvotes: 0,
    answerCount: 0,
    viewCount: 0,
    hasAcceptedAnswer: false,
    moderationStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  })

  await db.collection('qa_answers').doc(answerId).set({
    questionId,
    content: 'Vote test answer content',
    author: { uid: userA, name: 'Author' },
    upvotes: 0,
    downvotes: 0,
    accepted: false,
    moderationStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  })

  console.log('Seeded question and answer')
}

async function voteQuestion(voteType) {
  const voteRef = db.collection('qa_question_votes').doc(`${userB}_${questionId}`)
  await voteRef.set({
    userId: userB,
    questionId,
    voteType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function deleteQuestionVote() {
  const voteRef = db.collection('qa_question_votes').doc(`${userB}_${questionId}`)
  await voteRef.delete()
}

async function voteAnswer(voteType) {
  const voteRef = db.collection('qa_answer_votes').doc(`${userB}_${answerId}`)
  await voteRef.set({
    userId: userB,
    answerId,
    voteType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function deleteAnswerVote() {
  const voteRef = db.collection('qa_answer_votes').doc(`${userB}_${answerId}`)
  await voteRef.delete()
}

async function run() {
  await seed()

  const questionRef = db.collection('qa_questions').doc(questionId)
  const answerRef = db.collection('qa_answers').doc(answerId)

  // Question votes
  await voteQuestion('upvote')
  await waitForCounts(questionRef, { upvotes: 1, downvotes: 0 }, 'Q upvote')

  await deleteQuestionVote()
  await waitForCounts(questionRef, { upvotes: 0, downvotes: 0 }, 'Q toggle off')

  await voteQuestion('downvote')
  await waitForCounts(questionRef, { upvotes: 0, downvotes: 1 }, 'Q downvote')

  await voteQuestion('upvote') // switch from down->up
  await waitForCounts(questionRef, { upvotes: 1, downvotes: 0 }, 'Q switch to upvote')

  // Answer votes
  await voteAnswer('upvote')
  await waitForCounts(answerRef, { upvotes: 1, downvotes: 0 }, 'A upvote')

  await deleteAnswerVote()
  await waitForCounts(answerRef, { upvotes: 0, downvotes: 0 }, 'A toggle off')

  await voteAnswer('downvote')
  await waitForCounts(answerRef, { upvotes: 0, downvotes: 1 }, 'A downvote')

  await voteAnswer('upvote')
  await waitForCounts(answerRef, { upvotes: 1, downvotes: 0 }, 'A switch to upvote')

  console.log('✅ Voting emulator test completed successfully')
  process.exit(0)
}

run().catch(err => {
  console.error('❌ Voting emulator test failed:', err)
  process.exit(1)
})
