#!/usr/bin/env node
/**
 * Delete all email templates from Firestore
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=./moshimoshi-service-account.json node scripts/delete-email-templates.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))
if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) })
}
const db = getFirestore()

const snapshot = await db.collection('email_templates').get()
console.log(`Deleting ${snapshot.size} templates...`)
for (const doc of snapshot.docs) {
  await doc.ref.delete()
  console.log(`  Deleted: ${doc.id}`)
}
console.log('Done!')
