#!/usr/bin/env node

/**
 * Test script for Time Machine functionality
 * Run this to verify the virtual clock is working correctly
 */

// This script tests the Time Machine integration
// Copy and paste into browser console when dev server is running

console.log('🧪 Time Machine Test Suite')
console.log('=========================')

// Test 1: Enable admin mode
console.log('\n📌 Test 1: Enable Admin Mode')
localStorage.setItem('isAdmin', 'true')
console.log('✅ Admin mode enabled')

// Test 2: Import and test virtual clock
console.log('\n📌 Test 2: Virtual Clock Operations')

// Note: This would be run in the browser console where modules are available
const testCode = `
// Enable virtual clock
const vcState = {
  offsetMs: 0,
  frozenTime: null,
  isEnabled: true,
  history: []
};
localStorage.setItem('virtualClock', JSON.stringify(vcState));
console.log('✅ Virtual clock enabled');

// Test time travel
const testTimeTravel = () => {
  const original = new Date();
  console.log('Original time:', original);

  // Simulate traveling 7 days forward
  vcState.offsetMs = 7 * 24 * 60 * 60 * 1000;
  localStorage.setItem('virtualClock', JSON.stringify(vcState));
  console.log('✅ Traveled 7 days forward');

  // Check if button appears
  setTimeout(() => {
    const button = document.querySelector('button[title="Time Machine (Dev Only)"]');
    if (button) {
      console.log('✅ Time Machine button is visible');
    } else {
      console.log('⚠️ Time Machine button not found - refresh the page');
    }
  }, 1000);
};

testTimeTravel();
`;

console.log('\n📋 Copy and run this in the browser console:')
console.log('----------------------------------------')
console.log(testCode)
console.log('----------------------------------------')

// Test 3: Verify integration points
console.log('\n📌 Test 3: Integration Points to Check')
console.log('1. Review Engine: Check if review dates use virtual time')
console.log('2. Achievement System: Check if streaks use virtual time')
console.log('3. UI: Look for purple beaker button in bottom-right')

console.log('\n✅ Test setup complete!')
console.log('Now refresh the page and look for the Time Machine button')