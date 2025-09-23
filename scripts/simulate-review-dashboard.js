#!/usr/bin/env node

// Simulates what the Review Dashboard should show based on actual Firebase data
const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function simulateReviewDashboard(userId) {
  console.log(`\n=== Simulating Review Dashboard for user: ${userId} ===\n`);

  const items = [];

  try {
    // 1. Fetch from review_history (we know this has data)
    console.log('Fetching review history...');
    const historyRef = db.collection('users').doc(userId).collection('review_history');
    const historySnapshot = await historyRef.limit(50).get();

    const uniqueItems = new Map();

    historySnapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.contentType || 'hiragana'}_${data.contentId}`;

      if (!uniqueItems.has(key)) {
        const contentType = (data.contentType === 'hiragana' || data.contentType === 'katakana') ? 'kana' : (data.contentType || 'kana');

        uniqueItems.set(key, {
          id: key,
          contentType: contentType,
          primaryDisplay: data.contentId || data.content || '',
          secondaryDisplay: data.meaning || data.reading || '',
          status: 'learning',
          lastReviewedAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          nextReviewAt: new Date(), // Due now
          srsLevel: 0,
          accuracy: data.correct ? 1 : 0,
          reviewCount: 1,
          correctCount: data.correct ? 1 : 0,
          tags: [],
          source: contentType === 'kana' ? 'Hiragana & Katakana' : 'General'
        });
      }
    });

    items.push(...uniqueItems.values());

    // 2. Check progress documents
    console.log('\nFetching progress documents...');
    const progressRef = db.collection('users').doc(userId).collection('progress');
    const progressSnapshot = await progressRef.get();

    progressSnapshot.forEach(doc => {
      const docData = doc.data();

      // Handle the special user ID document with items
      if (doc.id === userId && docData.items) {
        Object.entries(docData.items).forEach(([contentId, data]) => {
          const key = `kana_${contentId}`;
          if (!uniqueItems.has(key)) {
            items.push({
              id: key,
              contentType: 'kana',
              primaryDisplay: contentId,
              secondaryDisplay: data.meaning || data.reading || '',
              status: data.status || 'not-started',
              lastReviewedAt: data.lastReviewedAt ? new Date(data.lastReviewedAt) : null,
              nextReviewAt: new Date(),
              srsLevel: 0,
              accuracy: data.accuracy || 0,
              reviewCount: data.viewCount || 0,
              correctCount: data.correctCount || 0,
              tags: [],
              source: 'Hiragana & Katakana'
            });
          }
        });
      }
    });

    console.log('\n=== WHAT THE REVIEW DASHBOARD SHOULD SHOW ===\n');

    // Stats summary
    const stats = {
      totalStudied: items.length,
      totalLearning: items.filter(i => i.status === 'learning').length,
      totalNotStarted: items.filter(i => i.status === 'not-started').length,
      dueNow: items.filter(i => i.nextReviewAt <= new Date()).length,
    };

    console.log('STATS CARDS:');
    console.log(`  📊 Total Studied: ${stats.totalStudied} items`);
    console.log(`  📚 Currently Learning: ${stats.totalLearning} items`);
    console.log(`  🆕 Not Started: ${stats.totalNotStarted} items`);
    console.log(`  ⏰ Due Now: ${stats.dueNow} items`);

    console.log('\nSTUDIED ITEMS TAB - Should show these items:');
    console.log('─'.repeat(50));

    items.slice(0, 10).forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.primaryDisplay} (${item.secondaryDisplay || 'no meaning'})`);
      console.log(`   Type: ${item.contentType}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Last Review: ${item.lastReviewedAt ? item.lastReviewedAt.toLocaleString() : 'Never'}`);
      console.log(`   Accuracy: ${Math.round(item.accuracy * 100)}%`);
    });

    if (items.length > 10) {
      console.log(`\n... and ${items.length - 10} more items`);
    }

    if (items.length === 0) {
      console.log('❌ NO DATA TO DISPLAY - The dashboard would be empty');
    }

    return items;

  } catch (error) {
    console.error('Error simulating dashboard:', error);
  }

  process.exit(0);
}

const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
simulateReviewDashboard(userId);