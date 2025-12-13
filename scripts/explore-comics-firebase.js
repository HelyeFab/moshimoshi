/**
 * Debug script to explore comics data in Firebase
 * Run with: node scripts/explore-comics-firebase.js
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'moshimoshi-service-account.json'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function exploreComics() {
  console.log('\n📺 Exploring comics collection...\n')

  try {
    // Get ALL documents in comics collection
    const allSnapshot = await db.collection('comics').get()

    console.log(`Total documents in 'comics' collection: ${allSnapshot.size}\n`)

    if (allSnapshot.empty) {
      console.log('❌ No comics found in the collection!')
      console.log('   You need to add comics to Firebase first.')
      return
    }

    // Group by status and seriesId
    const byStatus = {}
    const bySeriesId = {}

    allSnapshot.docs.forEach(doc => {
      const data = doc.data()
      const status = data.status || 'undefined'
      const seriesId = data.seriesId || 'undefined'

      byStatus[status] = (byStatus[status] || 0) + 1
      bySeriesId[seriesId] = (bySeriesId[seriesId] || 0) + 1
    })

    console.log('📊 Documents by status:')
    Object.entries(byStatus).forEach(([status, count]) => {
      const icon = status === 'published' ? '✅' : '⚠️'
      console.log(`   ${icon} ${status}: ${count}`)
    })

    console.log('\n📊 Documents by seriesId:')
    Object.entries(bySeriesId).forEach(([seriesId, count]) => {
      const icon = seriesId === 'moshi-goes-to-japan' ? '✅' : '⚠️'
      console.log(`   ${icon} ${seriesId}: ${count}`)
    })

    // Check for expected combination
    const publishedMoshi = allSnapshot.docs.filter(doc => {
      const data = doc.data()
      return data.status === 'published' && data.seriesId === 'moshi-goes-to-japan'
    })

    console.log(`\n🎯 Comics matching page query (status='published' AND seriesId='moshi-goes-to-japan'):`)
    console.log(`   Found: ${publishedMoshi.length} comics`)

    if (publishedMoshi.length === 0) {
      console.log('\n⚠️  ISSUE FOUND: No comics match the required filters!')
      console.log('   The page expects:')
      console.log('   - status: "published"')
      console.log('   - seriesId: "moshi-goes-to-japan"')
      console.log('\n   Your comics have:')

      // Show first 3 documents
      allSnapshot.docs.slice(0, 3).forEach((doc, i) => {
        const data = doc.data()
        console.log(`\n   Document ${i + 1} (${doc.id}):`)
        console.log(`     status: "${data.status}"`)
        console.log(`     seriesId: "${data.seriesId}"`)
        console.log(`     title: "${data.title}"`)
      })

      console.log('\n💡 Fix options:')
      console.log('   1. Update comics to have status="published"')
      console.log('   2. Update comics to have seriesId="moshi-goes-to-japan"')
      console.log('   3. Or modify the API to match your data')
    } else {
      console.log('\n✅ Comics data looks correct! Showing first 3:')
      publishedMoshi.slice(0, 3).forEach((doc, i) => {
        const data = doc.data()
        console.log(`\n   ${i + 1}. ${data.title} (EP ${data.episodeNumber})`)
        console.log(`      id: ${doc.id}`)
        console.log(`      titleJa: ${data.titleJa}`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }

  process.exit(0)
}

exploreComics()
