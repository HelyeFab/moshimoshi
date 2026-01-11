const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

async function callManualGeneration() {
  console.log('\n🧪 CALLING MANUAL COMIC GENERATOR FUNCTION\n');
  
  try {
    const functions = admin.functions();
    const callable = functions.httpsCallable('manualComicGeneratorFunction');
    
    console.log('📞 Invoking manualComicGeneratorFunction...');
    const result = await callable({ test: true });
    
    console.log('\n✅ Function Response:', JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error('\n❌ Function Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
  
  process.exit(0);
}

callManualGeneration();
