#!/usr/bin/env node

// Comprehensive script to find ALL progress data across all collections
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findAllProgress(userId) {
  console.log(`\n=== Finding ALL progress data for user: ${userId} ===\n`);

  const allItems = new Map();

  try {
    // 1. Check kanaProgress collection
    console.log('1. Checking kanaProgress collection...');
    const kanaProgressRef = db.collection('kanaProgress').where('userId', '==', userId);
    const kanaProgressSnapshot = await kanaProgressRef.get();
    console.log(`   Found ${kanaProgressSnapshot.size} kanaProgress documents`);

    kanaProgressSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.hiragana) {
        Object.entries(data.hiragana).forEach(([char, progress]) => {
          if (progress && typeof progress === 'object') {
            allItems.set(`hiragana_${char}`, {
              type: 'kana',
              id: char,
              source: 'kanaProgress.hiragana',
              data: progress
            });
          }
        });
      }
      if (data.katakana) {
        Object.entries(data.katakana).forEach(([char, progress]) => {
          if (progress && typeof progress === 'object') {
            allItems.set(`katakana_${char}`, {
              type: 'kana',
              id: char,
              source: 'kanaProgress.katakana',
              data: progress
            });
          }
        });
      }
    });

    // 2. Check kanjiProgress collection
    console.log('\n2. Checking kanjiProgress collection...');
    const kanjiProgressRef = db.collection('kanjiProgress').where('userId', '==', userId);
    const kanjiProgressSnapshot = await kanjiProgressRef.get();
    console.log(`   Found ${kanjiProgressSnapshot.size} kanjiProgress documents`);

    kanjiProgressSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.progress) {
        Object.entries(data.progress).forEach(([kanji, prog]) => {
          if (prog && typeof prog === 'object') {
            allItems.set(`kanji_${kanji}`, {
              type: 'kanji',
              id: kanji,
              source: 'kanjiProgress',
              data: prog
            });
          }
        });
      }
    });

    // 3. Check vocabularyHistory collection
    console.log('\n3. Checking vocabularyHistory collection...');
    const vocabRef = db.collection('vocabularyHistory').where('userId', '==', userId);
    const vocabSnapshot = await vocabRef.get();
    console.log(`   Found ${vocabSnapshot.size} vocabularyHistory documents`);

    vocabSnapshot.forEach(doc => {
      const data = doc.data();
      allItems.set(`vocab_${doc.id}`, {
        type: 'vocabulary',
        id: data.word || doc.id,
        source: 'vocabularyHistory',
        data: data
      });
    });

    // 4. Check userProgress collection (legacy)
    console.log('\n4. Checking userProgress collection...');
    const userProgressRef = db.collection('userProgress').doc(userId);
    const userProgressDoc = await userProgressRef.get();

    if (userProgressDoc.exists) {
      const data = userProgressDoc.data();
      console.log('   Found userProgress document');

      // Check for kanji progress
      if (data.kanjiProgress) {
        Object.entries(data.kanjiProgress).forEach(([kanji, prog]) => {
          if (!allItems.has(`kanji_${kanji}`)) {
            allItems.set(`kanji_${kanji}`, {
              type: 'kanji',
              id: kanji,
              source: 'userProgress.kanjiProgress',
              data: prog
            });
          }
        });
      }

      // Check for vocabulary progress
      if (data.vocabularyProgress) {
        Object.entries(data.vocabularyProgress).forEach(([word, prog]) => {
          if (!allItems.has(`vocab_${word}`)) {
            allItems.set(`vocab_${word}`, {
              type: 'vocabulary',
              id: word,
              source: 'userProgress.vocabularyProgress',
              data: prog
            });
          }
        });
      }
    }

    // 5. Check studyLists collection
    console.log('\n5. Checking studyLists collection...');
    const studyListsRef = db.collection('studyLists').where('userId', '==', userId);
    const studyListsSnapshot = await studyListsRef.get();
    console.log(`   Found ${studyListsSnapshot.size} study lists`);

    // 6. Check achievements for study data
    console.log('\n6. Checking achievements collection...');
    const achievementsRef = db.collection('achievements').where('userId', '==', userId);
    const achievementsSnapshot = await achievementsRef.get();

    achievementsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.stats) {
        console.log(`   Achievement stats: ${JSON.stringify(data.stats)}`);
      }
    });

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY OF ALL PROGRESS DATA');
    console.log('='.repeat(60));

    const summary = {
      kana: 0,
      kanji: 0,
      vocabulary: 0,
      other: 0
    };

    allItems.forEach((item, key) => {
      if (item.type === 'kana') summary.kana++;
      else if (item.type === 'kanji') summary.kanji++;
      else if (item.type === 'vocabulary') summary.vocabulary++;
      else summary.other++;
    });

    console.log(`\nTotal unique items found: ${allItems.size}`);
    console.log(`  - Kana: ${summary.kana}`);
    console.log(`  - Kanji: ${summary.kanji}`);
    console.log(`  - Vocabulary: ${summary.vocabulary}`);
    console.log(`  - Other: ${summary.other}`);

    // Show sample items
    if (allItems.size > 0) {
      console.log('\nSample items (first 10):');
      let count = 0;
      allItems.forEach((item, key) => {
        if (count < 10) {
          console.log(`  ${count + 1}. [${item.type}] ${item.id} (from ${item.source})`);
          if (item.data) {
            const stats = item.data;
            if (stats.viewCount || stats.correctCount !== undefined) {
              console.log(`     Views: ${stats.viewCount || 0}, Correct: ${stats.correctCount || 0}, Last: ${stats.lastReviewedAt || 'never'}`);
            }
          }
          count++;
        }
      });
    }

    // Check why these aren't showing in the API
    console.log('\n' + '='.repeat(60));
    console.log('CHECKING API DATA STRUCTURE');
    console.log('='.repeat(60));

    // Check the actual progress subcollection
    const progressRef = db.collection('users').doc(userId).collection('progress');
    const progressSnapshot = await progressRef.get();

    console.log(`\nProgress subcollection has ${progressSnapshot.size} documents:`);
    progressSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.items ? Object.keys(data.items).length + ' items' : 'no items field'}`);
    });

  } catch (error) {
    console.error('Error finding progress:', error);
  }

  process.exit(0);
}

const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
findAllProgress(userId);