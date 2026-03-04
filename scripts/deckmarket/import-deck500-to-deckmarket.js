#!/usr/bin/env node

/**
 * Import deck500 tiers into DeckMarket with both APKG and CSV artifacts per version.
 *
 * Usage:
 *   node scripts/deckmarket/import-deck500-to-deckmarket.js
 *   node scripts/deckmarket/import-deck500-to-deckmarket.js --dry-run
 *   node scripts/deckmarket/import-deck500-to-deckmarket.js --draft
 *   node scripts/deckmarket/import-deck500-to-deckmarket.js --force-version
 */

const fs = require('fs/promises')
const path = require('path')
const admin = require('firebase-admin')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') })

const ROOT = '/home/beano/Dev/deck500'
const DECKMARKET_COLLECTION = 'deckmarket_decks'
const VERSIONS_SUBCOLLECTION = 'versions'

const ARGS = new Set(process.argv.slice(2))
const DRY_RUN = ARGS.has('--dry-run')
const IS_PUBLISHED = !ARGS.has('--draft')
const FORCE_VERSION = ARGS.has('--force-version')

const TIERS = [
  {
    tier: 1,
    id: 'kuchiguse500-t1-survival-core',
    title: 'Kuchiguse 500 - Tier 1: Survival Core',
    jlpt: 'N5',
    tags: ['spoken', 'survival', 'beginner', 'tier-1', 'kuchiguse500'],
    pitchFile: 'pitch_t1.md',
    apkgFile: 'decks/apkg/kuchiguse500_t1_001-100.apkg',
    csvFile: 'decks/csv/kuchiguse500_t1_001-100.simple.csv',
  },
  {
    tier: 2,
    id: 'kuchiguse500-t2-daily-life',
    title: 'Kuchiguse 500 - Tier 2: Daily Life',
    jlpt: 'N4',
    tags: ['spoken', 'daily-life', 'practical', 'tier-2', 'kuchiguse500'],
    pitchFile: 'pitch_t2.md',
    apkgFile: 'decks/apkg/kuchiguse500_t2_101-200.apkg',
    csvFile: 'decks/csv/kuchiguse500_t2_101-200.simple.csv',
  },
  {
    tier: 3,
    id: 'kuchiguse500-t3-social-situational',
    title: 'Kuchiguse 500 - Tier 3: Social & Situational',
    jlpt: 'N3',
    tags: ['spoken', 'social', 'nuance', 'tier-3', 'kuchiguse500'],
    pitchFile: 'pitch_t3.md',
    apkgFile: 'decks/apkg/kuchiguse500_t3_201-300.apkg',
    csvFile: 'decks/csv/kuchiguse500_t3_201-300.simple.csv',
  },
  {
    tier: 4,
    id: 'kuchiguse500-t4-fluency-builders',
    title: 'Kuchiguse 500 - Tier 4: Fluency Builders',
    jlpt: 'N2',
    tags: ['spoken', 'fluency', 'work', 'tier-4', 'kuchiguse500'],
    pitchFile: 'pitch_t4.md',
    apkgFile: 'decks/apkg/kuchiguse500_t4_301-400.apkg',
    csvFile: 'decks/csv/kuchiguse500_t4_301-400.simple.csv',
  },
  {
    tier: 5,
    id: 'kuchiguse500-t5-nuance-range',
    title: 'Kuchiguse 500 - Tier 5: Nuance & Range',
    jlpt: 'N1',
    tags: ['spoken', 'advanced', 'natural-japanese', 'tier-5', 'kuchiguse500'],
    pitchFile: 'pitch_t5.md',
    apkgFile: 'decks/apkg/kuchiguse500_t5_401-500.apkg',
    csvFile: 'decks/csv/kuchiguse500_t5_401-500.simple.csv',
  },
]

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function cleanMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/\|/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\n##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i')
  const match = markdown.match(re)
  if (!match) return ''
  return cleanMarkdown(match[1]).trim()
}

function trimToLimit(text, limit) {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, Math.max(0, lastSpace))}…`
}

function buildDescription(aboutMd, pitchMd, tier) {
  const aboutProblem = extractSection(aboutMd, 'The Problem')
  const aboutFix = extractSection(aboutMd, 'The Fix')
  const whatsInside = extractSection(pitchMd, "What's Inside")
  const outcomes = extractSection(pitchMd, "What You'll Be Able to Do")

  const aboutSummary = cleanMarkdown(
    [
      'Kuchiguse 500 focuses on spoken Japanese frequency instead of textbook print frequency.',
      aboutProblem.split('\n')[0] || '',
      aboutFix.split('\n')[0] || '',
      'Each tier contains 100 spoken words split into 200 cards (word + sentence), with native audio for word and sentence, and includes APKG + CSV download formats.',
    ]
      .filter(Boolean)
      .join(' ')
  )

  const parts = [
    `${tier.title}.`,
    aboutSummary,
    whatsInside,
    outcomes,
  ]
    .filter(Boolean)
    .join('\n\n')

  return trimToLimit(parts, 1950)
}

async function readDeck500Text(relativePath) {
  const filePath = path.join(ROOT, relativePath)
  return fs.readFile(filePath, 'utf8')
}

async function readDeck500Buffer(relativePath) {
  const filePath = path.join(ROOT, relativePath)
  return fs.readFile(filePath)
}

async function fileSize(relativePath) {
  const filePath = path.join(ROOT, relativePath)
  const stat = await fs.stat(filePath)
  return stat.size
}

function initFirebase() {
  const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json')
  const serviceAccount = require(serviceAccountPath)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
  }
  return admin.firestore()
}

function initR2() {
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY')
  const endpoint = requireEnv('R2_ENDPOINT')
  const region = process.env.R2_REGION || 'auto'
  const bucket = requireEnv('R2_BUCKET')
  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  return { client, bucket }
}

async function main() {
  const db = initFirebase()
  const { client, bucket } = initR2()
  const aboutMd = await readDeck500Text('ABOUT.md')

  console.log(
    `Starting deck500 import (${DRY_RUN ? 'dry-run' : 'live'} | ${IS_PUBLISHED ? 'published' : 'draft'})`
  )

  for (const tier of TIERS) {
    const pitchMd = await readDeck500Text(tier.pitchFile)
    const description = buildDescription(aboutMd, pitchMd, tier)
    const apkgSize = await fileSize(tier.apkgFile)
    const csvSize = await fileSize(tier.csvFile)

    const deckRef = db.collection(DECKMARKET_COLLECTION).doc(tier.id)
    const deckSnap = await deckRef.get()

    const deckDoc = {
      id: tier.id,
      title: tier.title,
      description,
      hasNativeAudio: true,
      language: 'ja',
      jlpt: tier.jlpt,
      tags: tier.tags,
      isPublished: IS_PUBLISHED,
      downloadCount: deckSnap.exists ? deckSnap.get('downloadCount') || 0 : 0,
      lastDownloadAt: deckSnap.exists ? deckSnap.get('lastDownloadAt') || null : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: deckSnap.exists
        ? deckSnap.get('createdAt') || admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
      latestVersionId: deckSnap.exists ? deckSnap.get('latestVersionId') || null : null,
    }

    const latestVersionId = deckSnap.exists ? deckSnap.get('latestVersionId') : null
    let skipVersion = false
    if (latestVersionId && !FORCE_VERSION) {
      const latestSnap = await deckRef.collection(VERSIONS_SUBCOLLECTION).doc(latestVersionId).get()
      if (latestSnap.exists) {
        const latest = latestSnap.data() || {}
        const sameApkg = latest.apkgFilename === path.basename(tier.apkgFile) && latest.sizeBytes === apkgSize
        const sameCsv =
          latest.csvFilename === path.basename(tier.csvFile) && latest.csvSizeBytes === csvSize
        if (sameApkg && sameCsv) {
          skipVersion = true
        }
      }
    }

    if (DRY_RUN) {
      console.log(`- ${tier.id}: ${deckSnap.exists ? 'update' : 'create'} deck doc`)
      console.log(`  description chars: ${description.length}`)
      if (skipVersion) {
        console.log('  version upload: skipped (latest version already matches filenames and sizes)')
      } else {
        console.log(`  version upload: ${path.basename(tier.apkgFile)} + ${path.basename(tier.csvFile)}`)
      }
      continue
    }

    await deckRef.set(deckDoc, { merge: true })
    console.log(`- ${tier.id}: deck metadata upserted`)

    if (skipVersion) {
      console.log(`  latest version unchanged (already matches)`)
      continue
    }

    const versionId = uuidv4()
    const apkgFilename = path.basename(tier.apkgFile)
    const csvFilename = path.basename(tier.csvFile)
    const apkgR2Key = `deckmarket/${tier.id}/${versionId}/${apkgFilename}`
    const csvR2Key = `deckmarket/${tier.id}/${versionId}/${csvFilename}`

    const [apkgBuffer, csvBuffer] = await Promise.all([
      readDeck500Buffer(tier.apkgFile),
      readDeck500Buffer(tier.csvFile),
    ])

    await Promise.all([
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: apkgR2Key,
          Body: apkgBuffer,
          ContentType: 'application/octet-stream',
        })
      ),
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: csvR2Key,
          Body: csvBuffer,
          ContentType: 'text/csv',
        })
      ),
    ])

    await deckRef.collection(VERSIONS_SUBCOLLECTION).doc(versionId).set({
      id: versionId,
      deckId: tier.id,
      versionLabel: 'v1',
      changelog: 'Initial import from deck500 (APKG + CSV)',
      apkgR2Key,
      apkgFilename,
      sizeBytes: apkgBuffer.length,
      csvR2Key,
      csvFilename,
      csvSizeBytes: csvBuffer.length,
      sha256: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: 'script:deck500-import',
    })

    await deckRef.update({
      latestVersionId: versionId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isPublished: IS_PUBLISHED,
    })

    console.log(`  version created: ${versionId}`)
  }

  console.log('Import completed.')
}

main().catch((error) => {
  console.error('Import failed:', error)
  process.exit(1)
})
