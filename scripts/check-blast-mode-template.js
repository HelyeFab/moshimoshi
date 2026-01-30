/**
 * Check Blast Mode template CSS in Firestore
 */

const admin = require('firebase-admin')
const path = require('path')

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

async function checkTemplate() {
  try {
    const snapshot = await db.collection('email_templates')
      .where('slug', '==', 'blast-mode-announcement')
      .get()

    if (snapshot.empty) {
      console.log('❌ No Blast Mode template found')
      process.exit(1)
    }

    const doc = snapshot.docs[0]
    const data = doc.data()

    console.log('📧 Template Found:')
    console.log(`   ID: ${doc.id}`)
    console.log(`   Name: ${data.name}`)
    console.log(`   Status: ${data.status}`)

    // Check if HTML has inline styles
    const hasInlineStyles = data.htmlContent?.includes('style=')
    const hasStyleTag = data.htmlContent?.includes('<style')
    const hasMetaTags = data.htmlContent?.includes('<meta')

    console.log('\n🔍 CSS Check:')
    console.log(`   Has inline styles: ${hasInlineStyles ? '✅' : '❌'}`)
    console.log(`   Has <style> tag: ${hasStyleTag ? '✅' : '❌'}`)
    console.log(`   Has meta tags: ${hasMetaTags ? '✅' : '❌'}`)

    if (!hasInlineStyles) {
      console.log('\n⚠️  WARNING: No inline styles found in HTML!')
      console.log('   The template may have been edited and styles removed.')
      console.log('\n📝 First 500 chars of HTML:')
      console.log(data.htmlContent?.substring(0, 500))
    } else {
      console.log('\n✅ Template has CSS - styles should be rendering.')
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkTemplate()
