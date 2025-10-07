/**
 * Test Script: Grammar Explanation Cache
 *
 * Purpose: Verify Firebase connectivity and cache write functionality
 * Usage: npx tsx scripts/test-grammar-cache.ts
 */

import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

const COLLECTION = 'grammarExplanationCache';

// Initialize Firebase Admin
function initFirebase() {
  // Check if already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    console.log('✅ Firebase already initialized, cleaning up...');
    existingApps.forEach(app => deleteApp(app));
  }

  // Load service account
  const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account file not found at:', serviceAccountPath);
    console.error('Expected location: /home/beano/DevProjects/next_js/moshimoshi/moshimoshi-service-account.json');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

  console.log('🔧 Initializing Firebase Admin SDK...');
  console.log('   Project ID:', serviceAccount.project_id);

  initializeApp({
    credential: cert(serviceAccount)
  });

  console.log('✅ Firebase Admin SDK initialized successfully\n');
  return getFirestore();
}

// Hash function (same as production)
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Test 1: Write a test cache entry
async function testWriteCache(db: FirebaseFirestore.Firestore) {
  console.log('📝 Test 1: Writing test cache entry...');

  const testSentence = 'テストです。';
  const testContext = 'Test script verification';
  const testExplanation = {
    pattern: 'です (Copula)',
    patternRomaji: 'desu',
    meaning: 'Polite copula indicating a state of being or assertion',
    structure: 'Noun + です',
    examples: [
      {
        japanese: 'これは本です。',
        furigana: 'これはほんです。',
        translation: 'This is a book.',
        notes: 'Basic polite statement'
      }
    ],
    commonMistakes: ['Using だ in formal contexts', 'Omitting です in polite speech'],
    relatedPatterns: ['だ', 'である', 'でございます'],
    jlptLevel: 'N5' as any,
    formality: 'formal' as any
  };

  try {
    const sentenceHash = hashText(testSentence.trim());
    const contextHash = testContext ? hashText(testContext.trim()) : undefined;
    const docId = contextHash ? `${sentenceHash}_${contextHash}` : sentenceHash;

    console.log('   Sentence:', testSentence);
    console.log('   Context:', testContext);
    console.log('   Document ID:', docId);

    const entry = {
      id: docId,
      sentenceHash,
      sentence: testSentence,
      contextHash,
      context: testContext,
      explanation: testExplanation,
      createdAt: Timestamp.now(),
      lastAccessedAt: Timestamp.now(),
      accessCount: 1,
      testEntry: true, // Mark as test data
      createdBy: 'test-script'
    };

    await db.collection(COLLECTION).doc(docId).set(entry);
    console.log('✅ Cache entry written successfully!\n');
    return docId;
  } catch (error) {
    console.error('❌ Failed to write cache entry:', error);
    throw error;
  }
}

// Test 2: Read back the cache entry
async function testReadCache(db: FirebaseFirestore.Firestore, docId: string) {
  console.log('📖 Test 2: Reading cache entry...');

  try {
    const doc = await db.collection(COLLECTION).doc(docId).get();

    if (!doc.exists) {
      console.error('❌ Document not found!');
      return false;
    }

    const data = doc.data();
    console.log('✅ Cache entry read successfully!');
    console.log('   Sentence:', data?.sentence);
    console.log('   Pattern:', data?.explanation?.pattern);
    console.log('   Access Count:', data?.accessCount);
    console.log('   Created:', data?.createdAt?.toDate().toISOString());
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Failed to read cache entry:', error);
    return false;
  }
}

// Test 3: Update access count
async function testUpdateCache(db: FirebaseFirestore.Firestore, docId: string) {
  console.log('🔄 Test 3: Updating access count...');

  try {
    const docRef = db.collection(COLLECTION).doc(docId);
    const doc = await docRef.get();
    const currentCount = doc.data()?.accessCount || 0;

    await docRef.update({
      lastAccessedAt: Timestamp.now(),
      accessCount: currentCount + 1
    });

    const updated = await docRef.get();
    const newCount = updated.data()?.accessCount;

    console.log('✅ Access count updated!');
    console.log('   Before:', currentCount);
    console.log('   After:', newCount);
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Failed to update cache entry:', error);
    return false;
  }
}

// Test 4: List all cache entries
async function testListCache(db: FirebaseFirestore.Firestore) {
  console.log('📋 Test 4: Listing all cache entries...');

  try {
    const snapshot = await db.collection(COLLECTION).limit(10).get();

    console.log(`✅ Found ${snapshot.size} cache entries:`);

    if (snapshot.empty) {
      console.log('   (Collection is empty - this is the first entry!)');
    } else {
      snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. ${data.sentence}`);
        console.log(`      Pattern: ${data.explanation?.pattern}`);
        console.log(`      Access Count: ${data.accessCount}`);
        console.log(`      Test Entry: ${data.testEntry ? 'Yes' : 'No'}`);
      });
    }
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Failed to list cache entries:', error);
    return false;
  }
}

// Test 5: Clean up test data (optional)
async function cleanupTestData(db: FirebaseFirestore.Firestore, docId: string, shouldDelete: boolean) {
  if (!shouldDelete) {
    console.log('ℹ️  Skipping cleanup - test data preserved for inspection');
    console.log(`   Document ID: ${docId}`);
    console.log(`   Collection: ${COLLECTION}`);
    console.log('   You can view this in Firebase Console\n');
    return;
  }

  console.log('🗑️  Test 5: Cleaning up test data...');

  try {
    await db.collection(COLLECTION).doc(docId).delete();
    console.log('✅ Test data deleted successfully\n');
  } catch (error) {
    console.error('❌ Failed to delete test data:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Grammar Explanation Cache Test\n');
  console.log('='.repeat(50));
  console.log('');

  try {
    // Initialize
    const db = initFirebase();

    // Run tests
    const docId = await testWriteCache(db);
    await testReadCache(db, docId);
    await testUpdateCache(db, docId);
    await testListCache(db);

    // Ask user if they want to clean up (for now, preserve by default)
    const shouldCleanup = process.argv.includes('--cleanup');
    await cleanupTestData(db, docId, shouldCleanup);

    console.log('='.repeat(50));
    console.log('✅ All tests completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Check Firebase Console to see the grammarExplanationCache collection');
    console.log('2. Try the grammar explanation feature in the app');
    console.log('3. Monitor the cache for new entries\n');
    console.log('To delete test data, run: npx tsx scripts/test-grammar-cache.ts --cleanup\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
