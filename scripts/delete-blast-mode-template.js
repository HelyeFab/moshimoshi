/**
 * Delete Blast Mode template from Firestore
 *
 * Usage: node scripts/delete-blast-mode-template.js
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function deleteBlastModeTemplates() {
  try {
    console.log('🔍 Searching for Blast Mode templates in Firestore...')

    const templatesRef = db.collection('email_templates')
    const snapshot = await templatesRef.get()

    if (snapshot.empty) {
      console.log('📭 No templates found in Firestore.')
      process.exit(0)
    }

    let found = 0
    let deleted = 0

    for (const doc of snapshot.docs) {
      const data = doc.data()

      // Check if name or slug contains "blast" or "blast-mode"
      const nameMatch = data.name?.toLowerCase().includes('blast')
      const slugMatch = data.slug?.toLowerCase().includes('blast')

      if (nameMatch || slugMatch) {
        found++
        console.log(`\n📧 Found template:`)
        console.log(`   ID: ${doc.id}`)
        console.log(`   Name: ${data.name}`)
        console.log(`   Slug: ${data.slug}`)
        console.log(`   Status: ${data.status}`)
        console.log(`   Category: ${data.category}`)

        // Delete it
        await doc.ref.delete()
        deleted++
        console.log(`   ✅ Deleted!`)
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Total templates: ${snapshot.size}`)
    console.log(`   Blast Mode templates found: ${found}`)
    console.log(`   Deleted: ${deleted}`)

    if (deleted > 0) {
      console.log(`\n✅ Successfully deleted ${deleted} Blast Mode template(s) from Firestore.`)
      console.log(`\n💡 Refresh your admin dashboard to see the changes.`)
    } else {
      console.log(`\n❌ No Blast Mode templates found to delete.`)
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

deleteBlastModeTemplates()
