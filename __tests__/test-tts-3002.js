// Test TTS API directly
const fetch = require('node-fetch');

async function testTTS() {
  try {
    const response = await fetch('http://localhost:3002/api/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'こんにちは',
        language: 'ja',
        voice: 'ja-JP'  // This should now be handled correctly
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error response:', error);
    } else {
      const data = await response.json();
      console.log('Success! TTS working with provider:', data.data?.provider);
      console.log('Audio URL:', data.data?.audioUrl ? 'Received' : 'Not received');
      console.log('Cached:', data.data?.cached);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testTTS();