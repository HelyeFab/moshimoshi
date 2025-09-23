#!/usr/bin/env node

/**
 * Script to verify and fix user data isolation issues
 * Run this to ensure proper user-specific storage is in place
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

// This script should be run in the browser console for localStorage access
const browserScript = `
// User Data Isolation Verification Script
(function() {
  console.clear();
  console.log('%c🔒 User Data Isolation Verification', 'font-size: 18px; font-weight: bold; color: #4A90E2');
  console.log('='.repeat(60));

  // Check current user
  const getCurrentUser = () => {
    // Try to get user from various possible sources
    const authData = localStorage.getItem('auth-user');
    if (authData) {
      try {
        return JSON.parse(authData);
      } catch (e) {}
    }
    return null;
  };

  const currentUser = getCurrentUser();
  if (currentUser) {
    console.log('%c✓ Current User:', 'color: green; font-weight: bold', currentUser.uid || currentUser.email || 'Unknown');
  } else {
    console.log('%c⚠ No user currently logged in', 'color: orange; font-weight: bold');
  }

  console.log('\\n📊 Storage Analysis:');
  console.log('-'.repeat(40));

  // Categorize all localStorage keys
  const allKeys = Object.keys(localStorage);
  const categories = {
    legacy: [],
    userSpecific: [],
    other: []
  };

  allKeys.forEach(key => {
    if (key === 'moshimoshi_study_lists' || key === 'moshimoshi_saved_study_items') {
      categories.legacy.push(key);
    } else if (key.includes('moshimoshi_study_lists_') || key.includes('moshimoshi_saved_study_items_')) {
      categories.userSpecific.push(key);
    } else if (key.includes('moshimoshi')) {
      categories.other.push(key);
    }
  });

  // Report findings
  if (categories.legacy.length > 0) {
    console.log('%c❌ CRITICAL SECURITY ISSUES FOUND:', 'color: red; font-size: 14px; font-weight: bold');
    console.log('%cLegacy non-user-specific keys detected:', 'color: red');
    categories.legacy.forEach(key => {
      const data = localStorage.getItem(key);
      let itemCount = 0;
      try {
        const parsed = JSON.parse(data);
        itemCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
      } catch (e) {}
      console.log('  •', key, '(' + itemCount + ' items)');
      console.log('%c    ⚠ This allows any user to see data from previous users!', 'color: orange; font-size: 11px');
    });

    console.log('\\n%c🔧 RECOMMENDED FIX:', 'color: blue; font-weight: bold');
    console.log('Run this command to clean up legacy data:');
    console.log('%clocalStorage.removeItem("moshimoshi_study_lists"); localStorage.removeItem("moshimoshi_saved_study_items");',
      'background: #f0f0f0; padding: 5px; font-family: monospace');
  } else {
    console.log('%c✅ No legacy keys found (Good!)', 'color: green; font-weight: bold');
  }

  if (categories.userSpecific.length > 0) {
    console.log('\\n%c✓ User-specific storage keys:', 'color: green; font-weight: bold');
    const userIds = new Set();
    categories.userSpecific.forEach(key => {
      const userId = key.split('_').pop();
      userIds.add(userId);
      const data = localStorage.getItem(key);
      let itemCount = 0;
      try {
        const parsed = JSON.parse(data);
        itemCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
      } catch (e) {}
      const isCurrent = currentUser && key.includes(currentUser.uid);
      const marker = isCurrent ? ' ← Current User' : '';
      console.log('  •', key, '(' + itemCount + ' items)' + marker);
    });

    if (userIds.size > 1) {
      console.log('%c\\n⚠ Multiple user data found in browser', 'color: orange');
      console.log('User IDs:', Array.from(userIds).join(', '));
      console.log('This is normal if multiple users have used this browser.');
    }
  }

  // Check for data cross-contamination
  console.log('\\n🔍 Checking for cross-user data contamination...');
  let contaminationFound = false;

  categories.userSpecific.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      const keyUserId = key.split('_').pop();

      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          if (item.userId && item.userId !== keyUserId) {
            contaminationFound = true;
            console.error('%c❌ Data contamination found!', 'color: red; font-weight: bold');
            console.error('  Key:', key, '(expects userId:', keyUserId + ')');
            console.error('  Item', index, 'has userId:', item.userId);
          }
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  if (!contaminationFound) {
    console.log('%c✅ No cross-user contamination detected', 'color: green');
  }

  // Summary and recommendations
  console.log('\\n' + '='.repeat(60));
  console.log('%c📋 Summary:', 'font-size: 14px; font-weight: bold');

  const issues = [];
  if (categories.legacy.length > 0) {
    issues.push('• Remove legacy non-user-specific keys');
  }
  if (contaminationFound) {
    issues.push('• Fix cross-user data contamination');
  }
  if (userIds && userIds.size > 1 && currentUser) {
    issues.push('• Consider clearing data for logged-out users');
  }

  if (issues.length > 0) {
    console.log('%cIssues to address:', 'color: orange; font-weight: bold');
    issues.forEach(issue => console.log(issue));
  } else {
    console.log('%c✅ All checks passed! User data is properly isolated.', 'color: green; font-size: 14px; font-weight: bold');
  }

  // Provide cleanup function
  window.cleanupUserData = function() {
    console.log('\\n🧹 Starting cleanup...');

    // Remove legacy keys
    ['moshimoshi_study_lists', 'moshimoshi_saved_study_items'].forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log('  Removed legacy key:', key);
      }
    });

    // Remove data for non-current users
    if (currentUser) {
      categories.userSpecific.forEach(key => {
        if (!key.includes(currentUser.uid)) {
          localStorage.removeItem(key);
          console.log('  Removed old user data:', key);
        }
      });
    }

    console.log('%c✅ Cleanup complete!', 'color: green; font-weight: bold');
  };

  if (issues.length > 0) {
    console.log('\\n💡 To fix all issues, run: %ccleanupUserData()', 'background: #f0f0f0; padding: 2px 5px; font-family: monospace');
  }

})();
`;

console.log('📝 User Data Isolation Verification Script\n');
console.log('This script helps verify that user data is properly isolated in localStorage.\n');
console.log('To run the verification:\n');
console.log('1. Open your browser\'s DevTools Console (F12)');
console.log('2. Copy and paste the following script:');
console.log('─'.repeat(60));
console.log(browserScript);
console.log('─'.repeat(60));
console.log('\nThe script will:');
console.log('  • Check for legacy non-user-specific keys');
console.log('  • Verify user-specific storage is in use');
console.log('  • Detect any cross-user data contamination');
console.log('  • Provide a cleanup function if needed');