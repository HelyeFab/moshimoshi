// Test Google TTS API keys directly
const fetch = require('node-fetch');

async function testGoogleTTS(apiKey, keyName) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const requestBody = {
    input: { text: 'test' },
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Standard-A'
    },
    audioConfig: {
      audioEncoding: 'MP3'
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ ${keyName} - VALID - Audio content received`);
    } else {
      console.log(`❌ ${keyName} - INVALID - Error: ${data.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`❌ ${keyName} - FAILED - Network error: ${error.message}`);
  }
}

async function main() {
  console.log('Testing Google API Keys...\n');

  // Test first key (TTS key)
  await testGoogleTTS('AIzaSyDfETlyCtkm_-iM8p7G3fCaVqK4bu1wjsg', 'GOOGLE_CLOUD_TTS_API_KEY');

  // Test second key (Project key)
  await testGoogleTTS('AIzaSyDv55p5yfs7dQt5fGWv_mOpZu88Gmb9bKY', 'GOOGLE_CLOUD_PROJECT_API_KEY');
}

main();