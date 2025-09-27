#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://moshimoshi-de237.firebaseio.com'
  });
}

const db = admin.firestore();

async function testGetVideos() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';
  const docId = `${userId}_test_video_123`;

  try {
    console.log('Fetching specific video document...');
    console.log('Collection: userYouTubeHistory');
    console.log('Document ID:', docId);
    console.log('');

    // Get specific document
    const docSnapshot = await db.collection('userYouTubeHistory').doc(docId).get();

    if (docSnapshot.exists) {
      const data = docSnapshot.data();
      console.log('✅ Video found!');
      console.log('');
      console.log('Video Details:');
      console.log('  Title:', data.videoTitle);
      console.log('  Video ID:', data.videoId);
      console.log('  URL:', data.videoUrl);
      console.log('  Channel:', data.channelName);
      console.log('  Watch Count:', data.watchCount);
      console.log('  Total Watch Time:', data.totalWatchTime, 'seconds');
      console.log('  Duration:', data.duration, 'seconds');
      console.log('  Last Watched:', data.lastWatched?.toDate());
      console.log('  First Watched:', data.firstWatched?.toDate());
      console.log('  Metadata:', JSON.stringify(data.metadata, null, 2));
    } else {
      console.log('❌ Video not found');
    }

    // Try simpler query without ordering
    console.log('\n\nFetching all videos for user (without ordering)...');
    const querySnapshot = await db
      .collection('userYouTubeHistory')
      .where('userId', '==', userId)
      .limit(50)
      .get();

    console.log(`Found ${querySnapshot.size} total videos for user`);

    querySnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\nVideo ${index + 1}: ${data.videoTitle}`);
      console.log(`  Document ID: ${doc.id}`);
      console.log(`  Video ID: ${data.videoId}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testGetVideos();