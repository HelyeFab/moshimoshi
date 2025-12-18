/**
 * Quick waitlist inspector.
 * Usage:
 *   node scripts/check-waitlist.js                # prints total + first 20
 *   node scripts/check-waitlist.js someone@email.com  # lookup a specific email
 */

const admin = require('firebase-admin')
const path = require('path')

// Load service account from repo root
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function lookupByEmail(email) {
  console.log(`🔍 Looking up waitlist entry for: ${email}`)
  const snapshot = await db
    .collection('waitlist')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get()

  if (snapshot.empty) {
    console.log('❌ No waitlist entry found for this email.')
    return
  }

  const doc = snapshot.docs[0]
  const data = doc.data()

  console.log('✅ Waitlist entry found:')
  console.log(' - docId:', doc.id)
  console.log(' - email:', data.email)
  console.log(' - joinedAt:', data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : data.joinedAt)
  console.log(' - source:', data.source || 'unknown')
  console.log(' - linkedUid:', data.linkedUid || 'null')
  console.log(' - linkedAt:', data.linkedAt?.toDate ? data.linkedAt.toDate().toISOString() : data.linkedAt || 'null')
  console.log(' - discountGranted:', data.discountGranted ?? false)
}

async function listWaitlist(limit = 20) {
  console.log('📋 Listing waitlist entries...')

  const countAgg = await db.collection('waitlist').count().get()
  const total = countAgg.data()?.count ?? 0
  console.log(`Total entries: ${total}`)

  const snapshot = await db
    .collection('waitlist')
    .orderBy('joinedAt', 'desc')
    .limit(limit)
    .get()

  if (snapshot.empty) {
    console.log('No entries found.')
    return
  }

  snapshot.docs.forEach((doc, idx) => {
    const data = doc.data()
    console.log(`\n#${idx + 1} docId: ${doc.id}`)
    console.log(' - email:', data.email)
    console.log(' - joinedAt:', data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : data.joinedAt)
    console.log(' - source:', data.source || 'unknown')
    console.log(' - linkedUid:', data.linkedUid || 'null')
    console.log(' - discountGranted:', data.discountGranted ?? false)
  })
}

async function main() {
  const emailArg = process.argv[2]

  if (emailArg) {
    await lookupByEmail(emailArg)
  } else {
    await listWaitlist()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
