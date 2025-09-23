#!/usr/bin/env node

// Test the review API endpoints directly
const fetch = require('node-fetch');

async function testEndpoints() {
  const baseUrl = 'http://localhost:3001';

  // Note: This won't have a session cookie, so it will return guest/empty data
  // But we can at least see if the endpoint is working

  console.log('Testing API endpoints...\n');

  try {
    // Test studied items endpoint
    console.log('1. Testing /api/review/progress/studied');
    const studiedResponse = await fetch(`${baseUrl}/api/review/progress/studied?type=all&limit=50`);
    const studiedData = await studiedResponse.json();
    console.log('   Status:', studiedResponse.status);
    console.log('   Response:', JSON.stringify(studiedData, null, 2).substring(0, 500));

    // Test stats endpoint
    console.log('\n2. Testing /api/review/stats');
    const statsResponse = await fetch(`${baseUrl}/api/review/stats`);
    const statsData = await statsResponse.json();
    console.log('   Status:', statsResponse.status);
    console.log('   Response:', JSON.stringify(statsData, null, 2).substring(0, 500));

  } catch (error) {
    console.error('Error testing endpoints:', error);
  }
}

testEndpoints();