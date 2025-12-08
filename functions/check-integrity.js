const admin = require('firebase-admin')
if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()
async function check() {
  const checks = await db
    .collection('ops')
    .doc('integrity')
    .collection('processed_checks')
    .orderBy('processedAt', 'desc')
    .limit(5)
    .get()
  console.log('Recent processed checks:')
  checks.forEach(doc => {
    const d = doc.data()
    console.log(
      JSON.stringify(
        {
          id: doc.id,
          status: d.status,
          progress: d.progress,
          processedAt: d.processedAt?.toDate?.()?.toISOString(),
          type: d.type,
          triggeredBy: d.triggeredBy,
          error: d.error,
        },
        null,
        2
      )
    )
  })
}
check().catch(console.error)
