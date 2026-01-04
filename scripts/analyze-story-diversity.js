const admin = require('firebase-admin')
const path = require('path')

const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'moshimoshi-de237',
  })
}

const db = admin.firestore()

async function analyzeStories() {
  console.log('=== STORY DIVERSITY ANALYSIS ===\n')

  const snapshot = await db
    .collection('stories')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()

  const jlptCount = {}
  const mainCharacters = []

  snapshot.docs.forEach(function (doc) {
    const data = doc.data()
    const jlpt = data.jlptLevel || 'Unknown'
    jlptCount[jlpt] = (jlptCount[jlpt] || 0) + 1

    if (data.characterSheet && data.characterSheet.mainCharacter) {
      mainCharacters.push({
        name: data.characterSheet.mainCharacter.name,
        nameJa: data.characterSheet.mainCharacter.nameJa,
        theme: data.theme,
        jlpt: data.jlptLevel,
      })
    }
  })

  console.log('JLPT Distribution (last 20 stories):')
  Object.entries(jlptCount)
    .sort(function (a, b) {
      return b[1] - a[1]
    })
    .forEach(function (entry) {
      const level = entry[0]
      const count = entry[1]
      const percentage = ((count / snapshot.size) * 100).toFixed(1)
      console.log('  ' + level + ': ' + count + ' (' + percentage + '%)')
    })

  console.log('\n\nMain Characters (last 20):')
  mainCharacters.forEach(function (char, i) {
    console.log(
      '  ' +
        (i + 1) +
        '. ' +
        char.name +
        ' (' +
        char.nameJa +
        ') - ' +
        char.theme +
        ' [' +
        char.jlpt +
        ']'
    )
  })

  process.exit(0)
}

analyzeStories().catch(function (err) {
  console.error('Error:', err)
  process.exit(1)
})
