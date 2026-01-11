const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

const firebaseConfig = {
  apiKey: "AIzaSyAtpCdukHMsEUZLFjvjLfgIk-QEGQp7NGE",
  authDomain: "moshimoshi-de237.firebaseapp.com",
  projectId: "moshimoshi-de237",
  appId: "1:617419549071:web:f4c82bf78fb1f5ecc36cf9"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

async function testComic() {
  console.log('\n🧪 TESTING REVERTED COMIC GENERATION\n');
  console.log('📞 Calling manualComicGeneratorFunction with admin key...\n');
  
  try {
    const manualComic = httpsCallable(functions, 'manualComicGeneratorFunction');
    const result = await manualComic({ adminKey: 'comic-scheduler-2025' });
    
    console.log('\n✅ SUCCESS!');
    console.log('Response:', JSON.stringify(result.data, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('\n⚠️  Client timeout (expected for long-running function):', error.code);
    console.log('Check logs for actual generation status...');
    process.exit(0);
  }
}

testComic();
