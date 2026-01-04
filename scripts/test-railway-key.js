const https = require('https');

const apiKey = process.env.MODAL_API_KEY || 'ABpCKvpQru292DdXC5wm2tPbS6wZR3edeqlqt6A';

console.log('🔑 Testing Railway API Key:', apiKey.substring(0, 10) + '...');
console.log('');

// Test 1: Health endpoint
console.log('Test 1: Health endpoint');
https.get('https://nhk-api-proxy-production.up.railway.app/health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`   Status: ${res.statusCode}`);
    console.log(`   Response: ${data}`);
    console.log('');

    // Test 2: News endpoint WITH correct auth
    console.log('Test 2: News endpoint (with API key)');
    const options = {
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey.trim()
      }
    };

    const url = 'https://nhk-api-proxy-production.up.railway.app/news?startDate=2025-12-26T00:00:00Z&endDate=2025-12-28T00:00:00Z';

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Response: ${data.substring(0, 300)}`);
        console.log('');

        // Test 3: News endpoint WITHOUT auth
        console.log('Test 3: News endpoint (NO API key - should return 401/403)');
        https.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response: ${data}`);
            console.log('');

            // Test 4: Wrong key
            console.log('Test 4: News endpoint (WRONG API key - should return 401/403)');
            const wrongOptions = {
              headers: {
                'Accept': 'application/json',
                'X-API-Key': 'wrong-key-12345'
              }
            };

            https.get(url, wrongOptions, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                console.log(`   Status: ${res.statusCode}`);
                console.log(`   Response: ${data}`);
                console.log('');
                console.log('✅ Test complete!');
                console.log('');
                console.log('Summary:');
                console.log('- If Test 2 returns 200 but empty array: API is working, no articles in date range');
                console.log('- If Test 2 returns 502: Upstream NHK Easy API is down or unreachable');
                console.log('- If Test 2 returns 401/403: API key is wrong or missing');
                console.log('- If Test 3 and Test 4 return different codes than Test 2: Auth is working correctly');
              });
            });
          });
        });
      });
    }).on('error', (error) => {
      console.error('   Error:', error.message);
    });
  });
}).on('error', (error) => {
  console.error('   Error:', error.message);
});
