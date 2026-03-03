#!/usr/bin/env node

/**
 * Upsert Kuchiguse 500 Deck Update email template in Firestore.
 *
 * Usage:
 *   node --import tsx scripts/add-kuchiguse500-deck-update-template.mjs
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import startersModule from '../src/lib/email/templates/starters.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const SLUG = 'kuchiguse500-deck-update'

function initDb() {
  if (getApps().length === 0) {
    const serviceAccountPath = path.join(root, 'moshimoshi-service-account.json')
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({
      credential: cert(serviceAccount),
    })
  }
  return getFirestore()
}

async function main() {
  const getStarterTemplates =
    startersModule?.getStarterTemplates ||
    startersModule?.default?.getStarterTemplates

  if (typeof getStarterTemplates !== 'function') {
    throw new Error('Could not resolve getStarterTemplates() from starters module.')
  }

  const starters = getStarterTemplates()
  const starter = starters.kuchiguse500DeckUpdate

  if (!starter) {
    throw new Error('Starter "kuchiguse500DeckUpdate" not found.')
  }

  const db = initDb()
  const now = Timestamp.now()

  const payload = {
    name: starter.name,
    slug: SLUG,
    description: starter.description,
    subject: starter.subject,
    htmlContent: starter.html,
    textContent: starter.text,
    variables: [
      {
        name: 'unsubscribeUrl',
        label: 'Unsubscribe URL',
        type: 'url',
        defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW',
        required: true,
      },
    ],
    category: 'marketing',
    status: 'active',
    updatedBy: 'script:add-kuchiguse500-deck-update-template',
    updatedAt: now,
  }

  const existing = await db
    .collection('email_templates')
    .where('slug', '==', SLUG)
    .limit(1)
    .get()

  if (!existing.empty) {
    const doc = existing.docs[0]
    await doc.ref.update(payload)
    console.log(`Updated template: ${doc.id} (${SLUG})`)
    return
  }

  const created = await db.collection('email_templates').add({
    ...payload,
    createdBy: 'script:add-kuchiguse500-deck-update-template',
    createdAt: now,
  })
  console.log(`Created template: ${created.id} (${SLUG})`)
}

main().catch((error) => {
  console.error('Failed to upsert template:', error)
  process.exit(1)
})
