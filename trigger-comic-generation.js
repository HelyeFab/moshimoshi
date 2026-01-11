const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const projectId = serviceAccount.project_id;
const region = 'us-central1';
const functionName = 'manualComicGeneratorFunction';

console.log('🚀 Triggering manual comic generation...\n');

async function triggerGeneration() {
  try {
    // Get the admin key from environment or use default
    const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025';
    
    // Call the Cloud Function
    const functions = admin.functions();
    const callable = functions.httpsCallable(functionName);
    
    console.log(`Calling function: ${functionName}`);
    console.log(`Project: ${projectId}`);
    console.log(`Region: ${region}\n`);
    
    const result = await callable({ adminKey });
    
    console.log('✅ Function call successful!\n');
    console.log('Response:', JSON.stringify(result.data, null, 2));
    
    if (result.data.success) {
      console.log(`\n🎉 Comic generation started!`);
      console.log(`   Episode ID: ${result.data.episodeId}`);
      console.log(`   Episode Number: ${result.data.episodeNumber}`);
      console.log(`   Theme: ${result.data.theme}`);
      console.log(`   Location: ${result.data.location}`);
    } else {
      console.log(`\n⚠️  Generation failed: ${result.data.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error triggering generation:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  } finally {
    process.exit(0);
  }
}

triggerGeneration();
