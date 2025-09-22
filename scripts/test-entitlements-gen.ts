#!/usr/bin/env node

/**
 * Test script for entitlements code generation
 * Verifies that the generated files match the schema
 */

import * as fs from 'fs';
import * as path from 'path';

// Read the schema and generated files
const schemaPath = path.join(process.cwd(), 'config', 'features.v1.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// Test results
let passed = 0;
let failed = 0;

function test(name: string, condition: boolean) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

console.log('🧪 Testing entitlements code generation...\n');

// Test 1: All files exist
const files = [
  'src/types/FeatureId.ts',
  'src/lib/access/permissionMap.ts',
  'src/lib/features/registry.ts',
  'src/lib/entitlements/policy.ts'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  test(`File exists: ${file}`, fs.existsSync(filePath));
});

// Test 2: FeatureId.ts contains correct feature IDs
const featureIdPath = path.join(process.cwd(), 'src/types/FeatureId.ts');
const featureIdContent = fs.readFileSync(featureIdPath, 'utf-8');
test('FeatureId.ts contains hiragana_practice', featureIdContent.includes("'hiragana_practice'"));
test('FeatureId.ts contains katakana_practice', featureIdContent.includes("'katakana_practice'"));

// Test 3: permissionMap.ts contains plan types
const permissionMapPath = path.join(process.cwd(), 'src/lib/access/permissionMap.ts');
const permissionMapContent = fs.readFileSync(permissionMapPath, 'utf-8');
test('permissionMap.ts contains guest plan', permissionMapContent.includes("'guest'"));
test('permissionMap.ts contains free plan', permissionMapContent.includes("'free'"));
test('permissionMap.ts contains premium_monthly plan', permissionMapContent.includes("'premium_monthly'"));
test('permissionMap.ts contains premium_yearly plan', permissionMapContent.includes("'premium_yearly'"));

// Test 4: Stripe price mapping
test('permissionMap.ts contains Stripe price mapping', permissionMapContent.includes('STRIPE_PRICE_TO_PLAN'));
test('permissionMap.ts maps price_monthly_xxx', permissionMapContent.includes("'price_monthly_xxx': 'premium_monthly'"));
test('permissionMap.ts maps price_yearly_yyy', permissionMapContent.includes("'price_yearly_yyy': 'premium_yearly'"));

// Test 5: registry.ts contains feature definitions
const registryPath = path.join(process.cwd(), 'src/lib/features/registry.ts');
const registryContent = fs.readFileSync(registryPath, 'utf-8');
test('registry.ts contains FEATURE_REGISTRY', registryContent.includes('FEATURE_REGISTRY'));
test('registry.ts contains getFeature function', registryContent.includes('function getFeature'));

// Test 6: policy.ts contains limits
const policyPath = path.join(process.cwd(), 'src/lib/entitlements/policy.ts');
const policyContent = fs.readFileSync(policyPath, 'utf-8');
test('policy.ts contains PLAN_LIMITS', policyContent.includes('PLAN_LIMITS'));
test('policy.ts contains getLimit function', policyContent.includes('function getLimit'));
test('policy.ts contains isUnlimited function', policyContent.includes('function isUnlimited'));
test('policy.ts contains getEffectiveLimit function', policyContent.includes('function getEffectiveLimit'));

// Test 7: Check limits match schema
test('policy.ts contains correct guest daily limit (3)', policyContent.includes('"hiragana_practice": 3'));
test('policy.ts contains correct free daily limit (5)', policyContent.includes('"hiragana_practice": 5'));
test('policy.ts contains correct premium limit (-1)', policyContent.includes('"hiragana_practice": -1'));

// Results
console.log('\n📊 Test Results:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Code generation is working correctly.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please check the code generation.');
  process.exit(1);
}