// Test ElevenLabs TTS
const fetch = require('node-fetch');

async function testElevenLabs() {
  try {
    // Use longer text to trigger ElevenLabs (>10 characters)
    const response = await fetch('http://localhost:3002/api/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'こんにちは、今日はいい天気ですね。一緒に日本語を勉強しましょう。',
        language: 'ja',
        voice: 'ja-JP'
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

testElevenLabs();