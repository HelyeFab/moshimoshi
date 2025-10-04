// Test TTS API directly
const fetch = require('node-fetch');

async function testTTS() {
  try {
    const response = await fetch('http://localhost:3001/api/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'こんにちは',
        language: 'ja',
        voice: 'ja-JP'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error response:', error);
    } else {
      const data = await response.json();
      console.log('Success:', data);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testTTS();