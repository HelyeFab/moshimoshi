const https = require('https');
const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

async function getIdToken() {
  // Create a custom token and exchange for ID token
  const customToken = await admin.auth().createCustomToken('test-user-for-comic-trigger');
  return customToken; // Note: This is not the ID token, just showing the approach
}

async function triggerFunction() {
  console.log('\n🧪 TRIGGERING MANUAL COMIC GENERATOR VIA HTTP\n');
  
  const url = 'https://manualcomicgeneratorfunction-3e5hktglsa-uc.a.run.app';
  
  console.log('📞 Making HTTP POST request to function...');
  console.log('URL:', url);
  console.log('\n⏳ This will take 5-10 minutes for a full comic...\n');
  
  const postData = JSON.stringify({ data: {} });
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    },
    timeout: 900000 // 15 min
  };
  
  const req = https.request(url, options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\n\n✅ Response received:');
      console.log('Status:', res.statusCode);
      console.log('Body:', data);
      process.exit(0);
    });
  });
  
  req.on('error', (error) => {
    console.error('\n❌ Request failed:', error.message);
    process.exit(1);
  });
  
  req.on('timeout', () => {
    console.error('\n⏱️ Request timed out');
    req.destroy();
    process.exit(1);
  });
  
  req.write(postData);
  req.end();
}

triggerFunction();
