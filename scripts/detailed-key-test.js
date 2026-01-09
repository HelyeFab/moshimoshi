#!/usr/bin/env node
/**
 * Detailed API Key Testing - Get more info on failing keys
 */

const https = require('https');
require('dotenv').config({ path: '.env.production.local' });

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
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

async function testElevenLabsDetailed() {
  console.log('\n=== ElevenLabs Detailed Test ===');
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  console.log('Key present:', !!key);
  console.log('Key prefix:', key?.substring(0, 10) + '...');

  try {
    const response = await makeRequest({
      hostname: 'api.elevenlabs.io',
      path: '/v1/user',
      method: 'GET',
      headers: {
        'xi-api-key': key
      }
    });

    console.log('Status:', response.statusCode);
    console.log('Response:', response.body);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

async function testResendDetailed() {
  console.log('\n=== Resend Detailed Test ===');
  const key = process.env.RESEND_API_KEY?.trim();
  console.log('Key present:', !!key);
  console.log('Key prefix:', key?.substring(0, 10) + '...');

  try {
    const response = await makeRequest({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    console.log('Status:', response.statusCode);
    console.log('Response:', response.body);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

async function testNewsAPIDetailed() {
  console.log('\n=== NewsAPI Detailed Test ===');
  const key = process.env.NEWSAPI_API_KEY?.trim();
  console.log('Key present:', !!key);
  console.log('Key length:', key?.length);

  try {
    const response = await makeRequest({
      hostname: 'newsapi.org',
      path: `/v2/top-headlines?country=us&apiKey=${key}&pageSize=1`,
      method: 'GET'
    });

    console.log('Status:', response.statusCode);
    console.log('Response:', response.body);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

async function main() {
  await testElevenLabsDetailed();
  await testResendDetailed();
  await testNewsAPIDetailed();
}

main().catch(console.error);
