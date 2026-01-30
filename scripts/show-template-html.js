const admin = require('firebase-admin')
const path = require('path')

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function showHtml() {
  try {
    const snapshot = await db.collection('email_templates')
      .where('slug', '==', 'blast-mode-announcement')
      .get()

    if (snapshot.empty) {
      console.log('No template found')
      process.exit(1)
    }

    const doc = snapshot.docs[0]
    const data = doc.data()

    console.log('=== ACTUAL HTML CONTENT IN FIRESTORE ===\n')
    console.log(data.htmlContent.substring(0, 2000))
    console.log('\n\n... (truncated)')

    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

showHtml()
