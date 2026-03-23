#!/usr/bin/env node

/**
 * Seed announcement for Lonely Castle in the Mirror book addition.
 *
 * Usage:
 *   node scripts/announcements/seed-lonely-castle-mirror-announcement.mjs --dry-run
 *   node scripts/announcements/seed-lonely-castle-mirror-announcement.mjs
 *   node scripts/announcements/seed-lonely-castle-mirror-announcement.mjs --publish
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { marked } from 'marked'
import { fileURLToPath } from 'url'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')

dotenv.config({ path: path.join(projectRoot, '.env.local') })

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const publishNow = args.includes('--publish')

const markdownPath = path.join(
  projectRoot,
  '02-PRODUCTION_DOCS',
  'announcements',
  'lonely-castle-mirror.md'
)

const payload = {
  title: 'New in Library: かがみの孤城 (Lonely Castle in the Mirror)',
  featureId: 'library-lonely-castle-mirror-2026-03',
  imageUrl: '',
}

function getServiceAccountFromEnv() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
  }
}

function getServiceAccountFromFile() {
  const filePath = path.join(projectRoot, 'moshimoshi-service-account.json')
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function initializeFirebase() {
  if (getApps().length > 0) return

  const fromEnv = getServiceAccountFromEnv()
  const fromFile = getServiceAccountFromFile()
  const credentials = fromEnv || fromFile

  if (!credentials) {
    throw new Error(
      'No Firebase admin credentials found. Set FIREBASE_ADMIN_* env vars or provide moshimoshi-service-account.json'
    )
  }

  initializeApp({
    credential: cert(credentials),
  })
}

async function main() {
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`Announcement markdown not found: ${markdownPath}`)
  }

  const markdown = fs.readFileSync(markdownPath, 'utf8')
  const content = marked.parse(markdown, {
    gfm: true,
    breaks: true,
  })

  if (!content || typeof content !== 'string') {
    throw new Error('Failed to parse markdown content')
  }

  const status = publishNow ? 'published' : 'draft'
  const prepared = {
    ...payload,
    content,
    status,
    publishedAt: publishNow ? new Date().toISOString() : null,
    sourceMarkdown: markdownPath,
  }

  if (isDryRun) {
    console.log('[dry-run] Prepared announcement payload:')
    console.log(JSON.stringify(prepared, null, 2))
    return
  }

  initializeFirebase()
  const db = getFirestore()

  const doc = {
    title: payload.title,
    content,
    imageUrl: payload.imageUrl,
    featureId: payload.featureId,
    status,
    publishedAt: publishNow ? Timestamp.now() : null,
    createdAt: Timestamp.now(),
    createdBy: 'script:seed-lonely-castle-mirror-announcement',
  }

  const ref = await db.collection('announcements').add(doc)
  console.log(
    `Created announcement ${ref.id} (${status}). title="${payload.title}" featureId="${payload.featureId}"`
  )
}

main().catch((error) => {
  console.error('[seed-lonely-castle-mirror-announcement] Failed:', error.message)
  process.exit(1)
})
