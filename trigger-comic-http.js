const https = require('https');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./moshimoshi-service-account.json'));
const projectId = serviceAccount.project_id;
const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025';

console.log('🚀 Triggering manual comic generation via HTTP...\n');
console.log(`Project ID: ${projectId}`);
console.log(`Using admin key: ${adminKey}\n`);

// For Cloud Functions v2 callable functions, we need to use the API endpoint
// But first, let's try using the direct invocation URL

const region = 'us-central1';
const functionName = 'manualComicGeneratorFunction';

// Get ID token for authentication
const { GoogleAuth } = require('google-auth-library');
const auth = new GoogleAuth({
  keyFile: './moshimoshi-service-account.json',
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

async function triggerFunction() {
  try {
    const client = await auth.getClient();
    const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
    
    console.log(`Calling: ${url}\n`);
    
    const accessToken = await client.getAccessToken();
    
    const postData = JSON.stringify({
      data: { adminKey }
    });
    
    const options = {
      hostname: `${region}-${projectId}.cloudfunctions.net`,
      path: `/${functionName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${accessToken.token}`
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}\n`);
        
        try {
          const result = JSON.parse(data);
          console.log('Response:', JSON.stringify(result, null, 2));
          
          if (result.result && result.result.success) {
            console.log(`\n🎉 Comic generation started!`);
            console.log(`   Episode ID: ${result.result.episodeId}`);
            console.log(`   Episode Number: ${result.result.episodeNumber}`);
            console.log(`   Theme: ${result.result.theme}`);
            console.log(`   Location: ${result.result.location}`);
          } else if (result.error) {
            console.log(`\n⚠️  Error: ${result.error.message}`);
          }
        } catch (e) {
          console.log('Raw response:', data);
        }
        
        process.exit(0);
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      process.exit(1);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

triggerFunction();
