const http = require('http');

console.log('🚀 Starting Comic Generation via API\n');
console.log('Calling: http://localhost:3000/api/admin/comics/generate\n');

const postData = JSON.stringify({
  theme: null, // Auto-cycle
  location: null // Auto-cycle
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/comics/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Admin-Key': 'comic-scheduler-2025'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  console.log(`Status: ${res.statusCode}\n`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('Response:', JSON.stringify(result, null, 2));

      if (result.draftId) {
        console.log('\n✅ Comic generation started!');
        console.log('   Draft ID:', result.draftId);
        console.log('   Episode:', result.episodeNumber);
        console.log('   Theme:', result.theme);
        console.log('   Location:', result.location);
        console.log('\nℹ️  Generation is running. Check Firestore for progress updates.');
      } else if (result.error) {
        console.log('\n❌ Error:', result.error);
      }
    } catch (e) {
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.log('\nℹ️  Make sure the Next.js dev server is running: npm run dev');
  process.exit(1);
});

req.write(postData);
req.end();
