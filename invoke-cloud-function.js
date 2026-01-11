/**
 * Invoke Cloud Function Directly
 * Uses Google Auth to call the production manualComicGeneratorFunction
 */

const { GoogleAuth } = require('google-auth-library');
const https = require('https');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./moshimoshi-service-account.json'));
const projectId = serviceAccount.project_id;
const region = 'us-central1';
const functionName = 'manualComicGeneratorFunction';
const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025';

console.log('🚀 Invoking Cloud Function\n');
console.log('Function:', functionName);
console.log('Project:', projectId);
console.log('Region:', region);
console.log('\n' + '='.repeat(60) + '\n');

async function invokeFunction() {
  try {
    const auth = new GoogleAuth({
      keyFile: './moshimoshi-service-account.json',
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken || !accessToken.token) {
      throw new Error('Failed to get access token');
    }

    const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
    console.log('Calling:', url, '\n');

    // For Cloud Functions v2 callable functions, the payload format is:
    // { data: { ...your data... } }
    const payload = {
      data: {
        adminKey: adminKey
      }
    };

    const postData = JSON.stringify(payload);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${accessToken.token}`
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('Status:', res.statusCode);
          console.log('Response:', data, '\n');

          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data);

              // Cloud Functions v2 callable wraps the response in a 'result' field
              const actualResult = result.result || result;

              if (actualResult.success) {
                console.log('🎉 Success! Comic generation started\n');
                console.log('Episode ID:', actualResult.episodeId);
                console.log('Episode Number:', actualResult.episodeNumber);
                console.log('Theme:', actualResult.theme);
                console.log('Location:', actualResult.location);
                console.log('\n📊 Monitor progress in Firebase Console or logs');
              } else {
                console.log('⚠️  Generation failed:', actualResult.error);
              }

              resolve(actualResult);
            } catch (e) {
              console.log('Raw response (not JSON):', data);
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

invokeFunction()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Cloud Function invocation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error.message);
    process.exit(1);
  });
