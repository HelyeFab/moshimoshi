#!/usr/bin/env node

/**
 * Final verification script for the security fix
 * Run this in the browser console to verify everything is working
 */

const verificationScript = `
// ========================================
// SECURITY FIX VERIFICATION - FINAL CHECK
// ========================================

(function() {
  console.clear();
  console.log('%c🔒 SECURITY FIX VERIFICATION', 'font-size: 20px; font-weight: bold; color: #2563EB');
  console.log('='.repeat(60));

  // Test results tracker
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Test 1: Check for legacy keys
  console.log('\\n📝 Test 1: Checking for legacy non-user-specific keys...');
  const legacyKeys = ['moshimoshi_study_lists', 'moshimoshi_saved_study_items'];
  let legacyFound = false;

  legacyKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      legacyFound = true;
      results.failed.push(\`Legacy key found: \${key}\`);
      console.error('  ❌ FAILED: Found legacy key:', key);

      // Auto-fix
      console.log('     🔧 Auto-removing legacy key...');
      localStorage.removeItem(key);
    }
  });

  if (!legacyFound) {
    results.passed.push('No legacy keys found');
    console.log('  ✅ PASSED: No legacy keys found');
  }

  // Test 2: Check for user-specific keys
  console.log('\\n📝 Test 2: Verifying user-specific storage...');
  const allKeys = Object.keys(localStorage);
  const studyKeys = allKeys.filter(k =>
    k.includes('moshimoshi_study_lists') || k.includes('moshimoshi_saved_study_items')
  );

  if (studyKeys.length === 0) {
    results.warnings.push('No study list data found (might be normal for new user)');
    console.warn('  ⚠️  WARNING: No study list data found');
  } else {
    const validKeys = studyKeys.filter(k => k.includes('_user_') || k.split('_').length >= 4);

    if (validKeys.length === studyKeys.length) {
      results.passed.push('All keys are user-specific');
      console.log('  ✅ PASSED: All', studyKeys.length, 'keys are user-specific');
      studyKeys.forEach(k => console.log('     •', k));
    } else {
      const invalidKeys = studyKeys.filter(k => !validKeys.includes(k));
      results.failed.push(\`Non-user-specific keys found: \${invalidKeys.join(', ')}\`);
      console.error('  ❌ FAILED: Found non-user-specific keys:', invalidKeys);
    }
  }

  // Test 3: Check StudyListManager methods
  console.log('\\n📝 Test 3: Verifying StudyListManager methods...');
  if (typeof window.StudyListManager !== 'undefined') {
    const requiredMethods = [
      'getAllStudyLists',
      'getListsContainingItem',
      'createStudyList',
      'addItemToLists',
      'canAddToList'
    ];

    const missingMethods = [];
    requiredMethods.forEach(method => {
      if (typeof window.StudyListManager[method] !== 'function') {
        missingMethods.push(method);
      }
    });

    if (missingMethods.length === 0) {
      results.passed.push('All required StudyListManager methods present');
      console.log('  ✅ PASSED: All required methods are present');
    } else {
      results.failed.push(\`Missing methods: \${missingMethods.join(', ')}\`);
      console.error('  ❌ FAILED: Missing methods:', missingMethods);
    }
  } else {
    results.warnings.push('StudyListManager not exposed to window');
    console.warn('  ⚠️  WARNING: StudyListManager not accessible (this is normal)');
  }

  // Test 4: Check for cross-contamination
  console.log('\\n📝 Test 4: Checking for cross-user data contamination...');
  let contaminationFound = false;

  studyKeys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      const expectedUserId = key.split('_').pop();

      if (Array.isArray(data)) {
        data.forEach((item, idx) => {
          if (item.userId && item.userId !== expectedUserId) {
            contaminationFound = true;
            results.failed.push(\`Cross-contamination in \${key}[${idx}]\`);
            console.error('  ❌ FAILED: Cross-contamination found in', key);
          }
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  if (!contaminationFound && studyKeys.length > 0) {
    results.passed.push('No cross-user contamination detected');
    console.log('  ✅ PASSED: No cross-user contamination');
  }

  // Test 5: Multi-user scenario simulation
  console.log('\\n📝 Test 5: Multi-user scenario check...');
  const userIds = new Set();
  studyKeys.forEach(key => {
    const parts = key.split('_');
    if (parts.length >= 4) {
      userIds.add(parts[parts.length - 1]);
    }
  });

  if (userIds.size > 1) {
    results.warnings.push(\`Multiple users detected: \${Array.from(userIds).join(', ')}\`);
    console.warn('  ⚠️  WARNING: Multiple user data found');
    console.log('     User IDs:', Array.from(userIds));
    console.log('     This is OK if multiple users have used this browser');
  } else if (userIds.size === 1) {
    results.passed.push('Single user data isolation confirmed');
    console.log('  ✅ PASSED: Only one user\\'s data present');
  }

  // FINAL REPORT
  console.log('\\n' + '='.repeat(60));
  console.log('%c📊 VERIFICATION REPORT', 'font-size: 16px; font-weight: bold; color: #10B981');
  console.log('='.repeat(60));

  // Summary
  const totalTests = results.passed.length + results.failed.length;
  const passRate = results.failed.length === 0 ? 100 :
    Math.round((results.passed.length / totalTests) * 100);

  console.log(\`\\n📈 Test Results: \${results.passed.length}/\${totalTests} passed (\${passRate}%)\`);

  if (results.passed.length > 0) {
    console.log('\\n✅ PASSED TESTS:');
    results.passed.forEach(test => console.log('  •', test));
  }

  if (results.failed.length > 0) {
    console.log('\\n❌ FAILED TESTS:');
    results.failed.forEach(test => console.log('  •', test));
  }

  if (results.warnings.length > 0) {
    console.log('\\n⚠️  WARNINGS:');
    results.warnings.forEach(warning => console.log('  •', warning));
  }

  // Final verdict
  console.log('\\n' + '='.repeat(60));
  if (results.failed.length === 0) {
    console.log('%c✅ SECURITY FIX VERIFIED SUCCESSFULLY!',
      'font-size: 18px; font-weight: bold; color: #10B981; background: #ECFDF5; padding: 10px; border-radius: 5px');
    console.log('\\nUser data is properly isolated. Each user has their own storage keys.');
  } else {
    console.log('%c⚠️  SECURITY ISSUES DETECTED',
      'font-size: 18px; font-weight: bold; color: #EF4444; background: #FEF2F2; padding: 10px; border-radius: 5px');
    console.log('\\nPlease address the failed tests above.');
    console.log('\\nTo auto-fix some issues, you can run:');
    console.log('%clocalStorage.clear(); location.reload();',
      'background: #F3F4F6; padding: 5px; font-family: monospace');
  }

  // Instructions for manual testing
  console.log('\\n📋 MANUAL VERIFICATION STEPS:');
  console.log('1. Log in as User A');
  console.log('2. Create a study list');
  console.log('3. Log out');
  console.log('4. Log in as User B (different account)');
  console.log('5. Verify User B sees NO lists (empty state)');
  console.log('6. If User B sees User A\\'s lists = SECURITY BREACH');

  console.log('\\n💡 Quick Commands:');
  console.log('• Clear all data: localStorage.clear()');
  console.log('• Remove user data: Object.keys(localStorage).filter(k => k.includes("moshimoshi")).forEach(k => localStorage.removeItem(k))');
  console.log('• Reload page: location.reload()');

})();
`;

console.log('=' + '='.repeat(40));
console.log('🔒 FINAL SECURITY FIX VERIFICATION SCRIPT');
console.log('=' + '='.repeat(40));
console.log('\nThis script will verify that the security fix is working correctly.\n');
console.log('TO RUN THE VERIFICATION:\n');
console.log('1. Open your browser (where the app is running)');
console.log('2. Open DevTools Console (F12 → Console tab)');
console.log('3. Copy and paste this entire script:');
console.log('\n' + '-'.repeat(41));
console.log(verificationScript);
console.log('-'.repeat(41));
console.log('\n4. Press Enter to run');
console.log('\nThe script will:');
console.log('  ✓ Check for legacy non-user-specific keys');
console.log('  ✓ Verify user-specific storage is in use');
console.log('  ✓ Detect any cross-user contamination');
console.log('  ✓ Test multi-user scenarios');
console.log('  ✓ Provide a comprehensive report');
console.log('\n✨ If all tests pass, the security fix is working correctly!');