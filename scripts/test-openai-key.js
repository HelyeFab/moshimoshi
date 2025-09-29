#!/usr/bin/env node

/**
 * Simple test to verify OpenAI API key
 */

require('dotenv').config({ path: '.env.local' });

async function testAPIKey() {
  const apiKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ No API key found in environment variables');
    console.log('Please set OPEN_AI_API_KEY or OPENAI_API_KEY in .env.local');
    return;
  }

  console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
  console.log('📡 Testing connection to OpenAI...\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "API key works!" in JSON format with a field called "status"' }
        ],
        max_tokens: 50,
        temperature: 0.3
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ API Key is valid and working!');
      console.log('📦 Response:', JSON.stringify(data.choices[0].message.content, null, 2));
      console.log('\n📊 Usage:', {
        model: data.model,
        tokens: data.usage
      });
    } else {
      console.error('❌ API Key validation failed:');
      console.error('Status:', response.status);
      console.error('Error:', data.error);

      if (data.error?.code === 'invalid_api_key') {
        console.log('\n⚠️  Your API key appears to be invalid or expired.');
        console.log('Please get a new API key from: https://platform.openai.com/api-keys');
      } else if (data.error?.code === 'insufficient_quota') {
        console.log('\n⚠️  Your OpenAI account has insufficient quota.');
        console.log('Please add credits at: https://platform.openai.com/account/billing');
      }
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.log('\nPlease check your internet connection and try again.');
  }
}

testAPIKey();