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

  try {
    console.log('Fetching videos for user:', userId);
    console.log('From collection: userYouTubeHistory');
    console.log('');

    const querySnapshot = await db
      .collection('userYouTubeHistory')
      .where('userId', '==', userId)
      .orderBy('lastWatched', 'desc')
      .limit(50)
      .get();

    console.log(`Found ${querySnapshot.size} videos\n`);

    querySnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`Video ${index + 1}:`);
      console.log('  Document ID:', doc.id);
      console.log('  Title:', data.videoTitle);
      console.log('  Video ID:', data.videoId);
      console.log('  URL:', data.videoUrl);
      console.log('  Watch Count:', data.watchCount);
      console.log('  Total Watch Time:', data.totalWatchTime, 'seconds');
      console.log('  Last Watched:', data.lastWatched?.toDate());
      console.log('');
    });

    if (querySnapshot.size === 0) {
      console.log('No videos found for this user.');
    }

  } catch (error) {
    console.error('Error fetching videos:', error);
  } finally {
    process.exit(0);
  }
}

testGetVideos();