/**
 * Manual Comic Generation Trigger
 *
 * Triggers the Firebase Cloud Function directly to generate a new comic episode
 */

const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025';

console.log('🚀 Triggering Manual Comic Generation\n');
console.log('=' .repeat(60));

async function triggerGeneration() {
  try {
    // Call the generateComicEpisode logic directly via the generation queue
    console.log('\n📝 Adding generation request to queue...\n');

    // Add a manual request to the generation queue
    const queueRef = db.collection('comic_generation_queue').doc();
    await queueRef.set({
      requestedBy: 'manual-trigger',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
      priority: 'high',
      theme: null, // Let scheduler auto-cycle
      location: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Queue entry created: ${queueRef.id}`);
    console.log('\n📊 Current queue status:');

    const queueSnapshot = await db.collection('comic_generation_queue')
      .where('status', '==', 'pending')
      .get();

    console.log(`   Pending requests: ${queueSnapshot.size}`);

    console.log('\n💡 Next Steps:');
    console.log('   The weekly scheduler will pick up this request');
    console.log('   OR you can trigger the Cloud Function manually:\n');
    console.log('   firebase functions:shell');
    console.log('   > scheduledComicGeneratorFunction()\n');

    console.log('=' .repeat(60));
    console.log('\n✅ Manual trigger queued successfully!');
    console.log('   Queue ID:', queueRef.id);
    console.log('\n⏱️  The generation will start on the next scheduler run');
    console.log('   or you can invoke the Cloud Function directly.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

triggerGeneration();
