#!/usr/bin/env node
/**
 * API Key Validator - Tests all production API keys
 * READ-ONLY - Does not modify anything
 */

const https = require('https');
const http = require('http');

// Load production environment
require('dotenv').config({ path: '.env.production.local' });

const results = [];

function log(service, status, message) {
  results.push({ service, status, message });
  console.log(`[${status}] ${service}: ${message}`);
}

// Helper to make HTTPS requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'http:' ? http : https;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Test OpenAI API
async function testOpenAI() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    log('OpenAI', 'SKIP', 'No API key found');
    return;
  }

  try {
    const response = await makeRequest({
      hostname: 'api.openai.com',
      path: '/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.statusCode === 200) {
      log('OpenAI', 'VALID', 'API key is valid');
    } else if (response.statusCode === 401) {
      log('OpenAI', 'INVALID', 'API key is invalid or expired');
    } else {
      log('OpenAI', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('OpenAI', 'ERROR', error.message);
  }
}

// Test Gemini API
async function testGemini() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    log('Gemini (Google AI)', 'SKIP', 'No API key found');
    return;
  }

  try {
    const response = await makeRequest({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models?key=${key}`,
      method: 'GET'
    });

    if (response.statusCode === 200) {
      log('Gemini (Google AI)', 'VALID', 'API key is valid');
    } else if (response.statusCode === 400 || response.statusCode === 401 || response.statusCode === 403) {
      log('Gemini (Google AI)', 'INVALID', 'API key is invalid or restricted');
    } else {
      log('Gemini (Google AI)', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('Gemini (Google AI)', 'ERROR', error.message);
  }
}

// Test Google Cloud TTS
async function testGoogleTTS() {
  const key = process.env.GOOGLE_CLOUD_TTS_API_KEY?.trim();
  if (!key) {
    log('Google Cloud TTS', 'SKIP', 'No API key found');
    return;
  }

  try {
    const response = await makeRequest({
      hostname: 'texttospeech.googleapis.com',
      path: `/v1/voices?key=${key}`,
      method: 'GET'
    });

    if (response.statusCode === 200) {
      log('Google Cloud TTS', 'VALID', 'API key is valid');
    } else if (response.statusCode === 400 || response.statusCode === 403) {
      log('Google Cloud TTS', 'INVALID', 'API key is invalid or restricted');
    } else {
      log('Google Cloud TTS', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('Google Cloud TTS', 'ERROR', error.message);
  }
}

// Test Google Vision
async function testGoogleVision() {
  const key = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!key) {
    log('Google Vision', 'SKIP', 'No API key found');
    return;
  }

  // Google Vision uses the same key validation as other Google APIs
  try {
    const response = await makeRequest({
      hostname: 'vision.googleapis.com',
      path: `/v1/images:annotate?key=${key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ requests: [] }));

    if (response.statusCode === 200) {
      log('Google Vision', 'VALID', 'API key is valid');
    } else if (response.statusCode === 400 || response.statusCode === 403) {
      log('Google Vision', 'INVALID', 'API key is invalid or restricted');
    } else {
      log('Google Vision', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('Google Vision', 'ERROR', error.message);
  }
}

// Test ElevenLabs
async function testElevenLabs() {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    log('ElevenLabs', 'SKIP', 'No API key found');
    return;
  }

  try {
    const response = await makeRequest({
      hostname: 'api.elevenlabs.io',
      path: '/v1/user',
      method: 'GET',
      headers: {
        'xi-api-key': key
      }
    });

    if (response.statusCode === 200) {
      log('ElevenLabs', 'VALID', 'API key is valid');
    } else if (response.statusCode === 401) {
      log('ElevenLabs', 'INVALID', 'API key is invalid');
    } else {
      log('ElevenLabs', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('ElevenLabs', 'ERROR', error.message);
  }
}

// Test Stripe
async function testStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    log('Stripe', 'SKIP', 'No API key found');
    return;
  }

  try {
    const auth = Buffer.from(key + ':').toString('base64');
    const response = await makeRequest({
      hostname: 'api.stripe.com',
      path: '/v1/balance',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (response.statusCode === 200) {
      log('Stripe', 'VALID', 'API key is valid');
    } else if (response.statusCode === 401) {
      log('Stripe', 'INVALID', 'API key is invalid');
    } else {
      log('Stripe', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('Stripe', 'ERROR', error.message);
  }
}

// Test NewsAPI
async function testNewsAPI() {
  const key = process.env.NEWSAPI_API_KEY?.trim();
  if (!key) {
    log('NewsAPI', 'SKIP', 'No API key found');
    return;
  }

  try {
    const response = await makeRequest({
      hostname: 'newsapi.org',
      path: `/v2/top-headlines?country=us&apiKey=${key}&pageSize=1`,
      method: 'GET'
    });

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      if (data.status === 'ok') {
        log('NewsAPI', 'VALID', 'API key is valid');
      } else {
        log('NewsAPI', 'ERROR', data.message || 'Unknown error');
      }
    } else if (response.statusCode === 401) {
      log('NewsAPI', 'INVALID', 'API key is invalid');
    } else {
      log('NewsAPI', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('NewsAPI', 'ERROR', error.message);
  }
}

// Test Resend
async function testResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    log('Resend', 'SKIP', 'No API key found');
    return;
  }

  try {
    const response = await makeRequest({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.statusCode === 200) {
      log('Resend', 'VALID', 'API key is valid');
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      log('Resend', 'INVALID', 'API key is invalid');
    } else {
      log('Resend', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('Resend', 'ERROR', error.message);
  }
}

// Test Upstash Redis
async function testUpstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    log('Upstash Redis', 'SKIP', 'No credentials found');
    return;
  }

  try {
    const urlObj = new URL(url);
    const response = await makeRequest({
      hostname: urlObj.hostname,
      path: '/ping',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.statusCode === 200) {
      log('Upstash Redis', 'VALID', 'Credentials are valid');
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      log('Upstash Redis', 'INVALID', 'Credentials are invalid');
    } else {
      log('Upstash Redis', 'ERROR', `Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    log('Upstash Redis', 'ERROR', error.message);
  }
}

// Test Cloudflare R2
async function testCloudflareR2() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  if (!accessKeyId || !secretAccessKey) {
    log('Cloudflare R2', 'SKIP', 'No credentials found');
    return;
  }

  // R2 uses S3-compatible API, but testing requires AWS SDK
  // We'll just check if keys are present and formatted correctly
  if (accessKeyId.length > 10 && secretAccessKey.length > 30) {
    log('Cloudflare R2', 'PRESENT', 'Credentials are present (cannot validate without SDK)');
  } else {
    log('Cloudflare R2', 'WARNING', 'Credentials seem malformed');
  }
}

// Main execution
async function main() {
  console.log('\n=== API Key Validation Report ===\n');
  console.log('Testing production API keys...\n');

  await testOpenAI();
  await testGemini();
  await testGoogleTTS();
  await testGoogleVision();
  await testElevenLabs();
  await testStripe();
  await testNewsAPI();
  await testResend();
  await testUpstash();
  await testCloudflareR2();

  console.log('\n=== Summary ===\n');

  const validKeys = results.filter(r => r.status === 'VALID').length;
  const invalidKeys = results.filter(r => r.status === 'INVALID').length;
  const errorKeys = results.filter(r => r.status === 'ERROR').length;
  const skippedKeys = results.filter(r => r.status === 'SKIP').length;
  const presentKeys = results.filter(r => r.status === 'PRESENT').length;

  console.log(`✓ Valid: ${validKeys}`);
  console.log(`✗ Invalid: ${invalidKeys}`);
  console.log(`⚠ Errors: ${errorKeys}`);
  console.log(`○ Skipped: ${skippedKeys}`);
  console.log(`? Present (unverified): ${presentKeys}`);
  console.log(`\nTotal tested: ${results.length}`);

  if (invalidKeys > 0 || errorKeys > 0) {
    console.log('\n⚠️  ACTION REQUIRED: Some API keys need attention!');
    process.exit(1);
  } else {
    console.log('\n✓ All tested API keys are valid!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
