/**
 * Test if the API endpoints work correctly
 * Simulates what the browser does
 */

const USER_UID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function testAPIs() {
  console.log('\n🧪 Testing API Endpoints\n');
  console.log('━'.repeat(70) + '\n');

  const baseURL = 'http://localhost:3000'; // Adjust if your dev server is on a different port

  console.log('Note: This test requires your dev server to be running.');
  console.log('Make sure you are logged in as the test user in your browser.\n');

  console.log('1️⃣  Testing GET /api/user/village-layout\n');

  try {
    const layoutRes = await fetch(`${baseURL}/api/user/village-layout`, {
      headers: {
        'Cookie': 'session=...' // Would need actual session cookie
      }
    });

    console.log('   Status:', layoutRes.status);
    const layoutData = await layoutRes.json();
    console.log('   Response:', JSON.stringify(layoutData, null, 2));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
    console.log('   (This is expected if dev server is not running)');
  }

  console.log('\n2️⃣  Testing GET /api/user/onboarding\n');

  try {
    const onboardingRes = await fetch(`${baseURL}/api/user/onboarding`, {
      headers: {
        'Cookie': 'session=...'
      }
    });

    console.log('   Status:', onboardingRes.status);
    const onboardingData = await onboardingRes.json();
    console.log('   Response:', JSON.stringify(onboardingData, null, 2));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
    console.log('   (This is expected if dev server is not running)');
  }

  console.log('\n━'.repeat(70));
  console.log('\nNote: This test cannot authenticate without a real browser session.');
  console.log('Instead, check the browser DevTools Network tab:\n');
  console.log('1. Open DevTools (F12)');
  console.log('2. Go to Network tab');
  console.log('3. Visit /dashboard');
  console.log('4. Look for these requests:');
  console.log('   - /api/user/village-layout');
  console.log('   - /api/user/onboarding');
  console.log('5. Check their responses\n');
  console.log('━'.repeat(70) + '\n');
}

testAPIs();
