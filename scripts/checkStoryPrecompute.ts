import path from 'path'
import { config } from 'dotenv'
import admin from 'firebase-admin'

config({ path: path.resolve('.env.local') })

const {
  FIREBASE_ADMIN_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY,
} = process.env

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error('Missing Firebase Admin env vars (check .env.local)')
  process.exit(1)
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()

function parseArgs() {
  const args = process.argv.slice(2)
  const storyArg = args.find(arg => arg.startsWith('--story='))
  const storyId = storyArg?.split('=')[1]
  if (!storyId) {
    console.error('Usage: npx tsx checkStoryPrecompute.ts --story=STORY_ID')
    process.exit(1)
  }
  return { storyId }
}

async function main() {
  const { storyId } = parseArgs()
  const storyDoc = await db.collection('stories').doc(storyId).get()
  if (!storyDoc.exists) {
    console.log('Story not found')
    return
  }

  const story = storyDoc.data() || {}
  const pages = Array.isArray(story.pages) ? story.pages : []
  const fullText = pages.map((p: any) => p?.text || '').filter(Boolean).join(' ')

  const preDoc = await db.collection('story_word_explanations').doc(storyId).get()
  if (!preDoc.exists) {
    console.log('No precompute doc')
    return
  }

  const pre = preDoc.data() || {}
  const words = Array.isArray(pre.words) ? pre.words : []

  console.log(
    JSON.stringify(
      {
        storyId,
        title: story.title,
        jlptLevel: story.jlptLevel,
        pages: pages.length,
        textLength: fullText.length,
        precomputeWords: words.length,
        precomputeVersion: pre.precomputeVersion,
        precomputeOptions: pre.precomputeOptions,
      },
      null,
      2
    )
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
