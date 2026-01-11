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

async function testFunction() {
  console.log('\n🧪 CALLING manualComicGeneratorFunction\n');
  
  try {
    const manualComic = httpsCallable(functions, 'manualComicGeneratorFunction');
    console.log('📞 Invoking function (this may take 5-10 minutes)...\n');
    
    const result = await manualComic({});
    
    console.log('\n✅ SUCCESS! Function executed without errors');
    console.log('Response:', JSON.stringify(result.data, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Function failed:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.details) console.error('Details:', error.details);
    process.exit(1);
  }
}

testFunction();
