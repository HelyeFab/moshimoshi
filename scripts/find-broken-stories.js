const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('../moshimoshi-service-account.json')),
    projectId: 'moshimoshi-de237',
  })
}

const db = admin.firestore()

async function findBrokenStories() {
  const snapshot = await db.collection('stories').where('status', '==', 'published').get()
  const broken = []

  snapshot.forEach(doc => {
    const data = doc.data()
    const pages = data.pages || []
    const missingImages = pages.filter(p => !p.imageUrl).length

    if (missingImages > 0) {
      broken.push({
        id: doc.id,
        title: data.title,
        totalPages: pages.length,
        missingImages,
        hasCharacterSheet: !!data.characterSheet,
      })
    }
  })

  console.log('Stories with missing images:')
  broken.forEach(s => {
    console.log(
      `- ${s.id}: ${s.missingImages}/${s.totalPages} missing, characterSheet: ${s.hasCharacterSheet}`
    )
  })

  if (broken.length === 0) {
    console.log('No stories with missing images found!')
  }

  process.exit(0)
}

findBrokenStories()
