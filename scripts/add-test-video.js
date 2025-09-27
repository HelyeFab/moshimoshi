#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://moshimoshi-de237.firebaseio.com'
});

const db = admin.firestore();

async function addTestVideo() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';
  const videoId = 'test_video_123';
  const docId = `${userId}_${videoId}`;

  const testVideo = {
    userId: userId,
    videoId: videoId,
    videoUrl: 'https://www.youtube.com/watch?v=test_video_123',
    videoTitle: 'Test Japanese Lesson Video',
    thumbnailUrl: 'https://i.ytimg.com/vi/test_video_123/maxresdefault.jpg',
    channelName: 'Japanese Learning Channel',
    lastWatched: admin.firestore.Timestamp.now(),
    firstWatched: admin.firestore.Timestamp.now(),
    watchCount: 5,
    totalWatchTime: 3600, // 1 hour in seconds
    duration: 900, // 15 minutes video
    metadata: {
      language: 'ja',
      difficulty: 'intermediate',
      tags: ['grammar', 'conversation']
    },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  };

  try {
    console.log('Adding test video to userYouTubeHistory collection...');
    console.log('Document ID:', docId);
    console.log('User ID:', userId);

    await db.collection('userYouTubeHistory').doc(docId).set(testVideo);

    console.log('✅ Successfully added test video!');
    console.log('Video details:', {
      videoId: testVideo.videoId,
      videoTitle: testVideo.videoTitle,
      watchCount: testVideo.watchCount,
      totalWatchTime: testVideo.totalWatchTime
    });

    // Verify it was saved
    const savedDoc = await db.collection('userYouTubeHistory').doc(docId).get();
    if (savedDoc.exists) {
      console.log('✅ Verified: Video exists in Firebase');
    } else {
      console.log('❌ Warning: Could not verify video was saved');
    }

  } catch (error) {
    console.error('Error adding test video:', error);
  } finally {
    process.exit(0);
  }
}

addTestVideo();