/**
 * Test Comic Scheduler - Simulates Cloud Function behavior
 *
 * This script mimics exactly what the Cloud Function does:
 * 1. Gets next episode from queue (or uses auto-cycle)
 * 2. Loads character references
 * 3. Calls the API for each generation step
 *
 * Usage: node scripts/test-comic-scheduler.js [--prod]
 *   --prod: Use production URL (moshimoshi.app) instead of localhost
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();

// Configuration
const USE_PROD = process.argv.includes('--prod');
const APP_URL = USE_PROD ? 'https://moshimoshi.app' : 'http://localhost:3000';
const ADMIN_KEY = 'comic-scheduler-2025'; // Same default as Cloud Function
const MOSHI_SERIES_ID = 'moshi-goes-to-japan';

console.log(`\n🎬 Comic Scheduler Test`);
console.log(`   URL: ${APP_URL}`);
console.log(`   Key: ${ADMIN_KEY}\n`);

/**
 * Call the comic API with admin key
 */
async function callComicAPI(endpoint, body) {
  const url = `${APP_URL}${endpoint}`;
  console.log(`   → ${endpoint} (${body.step || 'publish'})`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText.substring(0, 200)}`);
  }

  return response.json();
}

/**
 * Get next episode from queue
 */
async function getNextFromQueue() {
  const snapshot = await db
    .collection('comic_generation_queue')
    .where('status', '==', 'pending')
    .orderBy('priority', 'asc')
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    theme: data.theme,
    location: data.location,
    characterIds: data.characterIds || ['moshi-master'],
    jlptLevel: data.jlptLevel || 'N5',
  };
}

/**
 * Load character references
 */
async function loadCharacters(characterIds) {
  const characters = [];

  for (const characterId of characterIds) {
    const charDoc = await db.collection('saved_characters').doc(characterId).get();
    if (!charDoc.exists) {
      console.log(`   ⚠️  Character ${characterId} not found`);
      continue;
    }

    const data = charDoc.data();
    let imageData = data.referenceImageData || '';

    // Fetch from URL if no base64
    if (!imageData && data.referenceImageUrl) {
      console.log(`   📷 Fetching ${data.name} image...`);
      const response = await fetch(data.referenceImageUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        imageData = buffer.toString('base64');
        console.log(`      ${(imageData.length / 1024).toFixed(1)} KB`);
      }
    }

    characters.push({
      id: characterId,
      name: data.name,
      nameJa: data.nameJa || '',
      role: data.role || 'friend',
      visualDescription: data.visualDescription || '',
      personality: data.personality || '',
      speakingStyle: data.speakingStyle || '',
      referenceImageData: imageData,
    });
  }

  return characters;
}

/**
 * Main generation flow
 */
async function generateComicEpisode() {
  const startTime = Date.now();

  try {
    // Step 0: Check queue
    console.log('📋 Checking generation queue...');
    const queueItem = await getNextFromQueue();

    let theme, location, jlptLevel, characterIds;

    if (queueItem) {
      console.log(`   Found: "${queueItem.theme}" at ${queueItem.location}`);
      theme = queueItem.theme;
      location = queueItem.location;
      jlptLevel = queueItem.jlptLevel;
      characterIds = queueItem.characterIds;

      // Mark as processing
      await db.collection('comic_generation_queue').doc(queueItem.id).update({
        status: 'processing',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      console.log('   Queue empty, using default theme');
      theme = 'temple';
      location = 'Senso-ji Temple';
      jlptLevel = 'N5';
      characterIds = ['moshi-master', 'sensei-panda'];
    }

    // Step 1: Load characters
    console.log('\n👥 Loading characters...');
    const characters = await loadCharacters(characterIds);
    console.log(`   Loaded: ${characters.map(c => c.name).join(', ')}`);

    // Calculate total payload size
    const totalSize = characters.reduce((sum, c) => sum + (c.referenceImageData?.length || 0), 0);
    console.log(`   Total payload: ${(totalSize / 1024).toFixed(1)} KB`);

    if (totalSize > 4 * 1024 * 1024) {
      throw new Error(`Payload too large: ${(totalSize / 1024 / 1024).toFixed(1)} MB (max 4MB)`);
    }

    // Build character sheet and refs
    const mainChar = characters.find(c => c.role === 'protagonist') || characters[0];
    const supportingChars = characters.filter(c => c.id !== mainChar?.id);

    const characterSheet = {
      mainCharacter: mainChar ? {
        id: mainChar.id,
        name: mainChar.name,
        nameJa: mainChar.nameJa,
        visualDescription: mainChar.visualDescription,
        personality: mainChar.personality,
        speakingStyle: mainChar.speakingStyle,
      } : null,
      supportingCharacters: supportingChars.map(c => ({
        id: c.id,
        name: c.name,
        nameJa: c.nameJa,
        role: c.role,
        visualDescription: c.visualDescription,
        personality: c.personality,
        speakingStyle: c.speakingStyle,
      })),
      allCharacters: characters.map(c => ({
        id: c.id,
        name: c.name,
        nameJa: c.nameJa,
        role: c.role,
      })),
    };

    const characterRefs = characters.map(c => ({
      id: c.id,
      name: c.name,
      nameJa: c.nameJa,
      role: c.role,
      visualDescription: c.visualDescription,
      personality: c.personality,
      speakingStyle: c.speakingStyle,
      referenceImageData: c.referenceImageData,
    }));

    // Step 2: Generate outline
    console.log('\n📝 Step 1/8: Generating outline...');
    const outlineResult = await callComicAPI('/api/admin/comics/generate', {
      step: 'outline',
      seriesId: MOSHI_SERIES_ID,
      theme,
      location,
      jlptLevel,
      characterSheet,
      characterRefs,
    });

    if (!outlineResult.success || !outlineResult.draftId) {
      throw new Error('Failed to generate outline');
    }

    const draftId = outlineResult.draftId;
    const panelCount = outlineResult.panelCount || 6;
    console.log(`   ✅ Draft created: ${draftId} (${panelCount} panels)`);

    // Step 3: Generate dialogues
    console.log('\n💬 Step 2/8: Generating dialogues...');
    const dialogueResult = await callComicAPI('/api/admin/comics/generate', {
      step: 'dialogues',
      draftId,
      jlptLevel,
    });

    if (!dialogueResult.success) {
      throw new Error('Failed to generate dialogues');
    }
    console.log('   ✅ Dialogues created');

    // Step 4: Generate panel images
    console.log('\n🎨 Step 3/8: Generating panel images...');
    let imagesGenerated = 0;
    let imagesFailed = 0;

    for (let panelNum = 1; panelNum <= panelCount; panelNum++) {
      process.stdout.write(`   Panel ${panelNum}/${panelCount}...`);

      try {
        const imageResult = await callComicAPI('/api/admin/comics/generate', {
          step: 'panel_image',
          draftId,
          panelNumber: panelNum,
          characterRefs,
        });

        if (imageResult.success) {
          imagesGenerated++;
          console.log(' ✅');
        } else {
          imagesFailed++;
          console.log(' ⚠️');
        }
      } catch (imgError) {
        imagesFailed++;
        console.log(` ❌ ${imgError.message.substring(0, 50)}`);
      }
    }

    console.log(`   Generated: ${imagesGenerated}/${panelCount}`);

    // Step 5: Extract vocabulary
    console.log('\n📚 Step 4/8: Extracting vocabulary...');
    try {
      await callComicAPI('/api/admin/comics/generate', {
        step: 'vocabulary',
        draftId,
        jlptLevel,
      });
      console.log('   ✅ Vocabulary extracted');
    } catch (e) {
      console.log('   ⚠️ Vocabulary failed, continuing...');
    }

    // Step 6: Generate cultural notes
    console.log('\n🏯 Step 5/8: Generating cultural notes...');
    try {
      await callComicAPI('/api/admin/comics/generate', {
        step: 'cultural_notes',
        draftId,
        location,
      });
      console.log('   ✅ Cultural notes created');
    } catch (e) {
      console.log('   ⚠️ Cultural notes failed, continuing...');
    }

    // Step 7: Generate quiz
    console.log('\n❓ Step 6/8: Generating quiz...');
    try {
      await callComicAPI('/api/admin/comics/generate', {
        step: 'quiz',
        draftId,
        jlptLevel,
      });
      console.log('   ✅ Quiz created');
    } catch (e) {
      console.log('   ⚠️ Quiz failed, continuing...');
    }

    // Step 8: Generate audio
    console.log('\n🔊 Step 7/8: Generating audio...');
    try {
      await callComicAPI('/api/admin/comics/generate', {
        step: 'audio',
        draftId,
      });
      console.log('   ✅ Audio generated');
    } catch (e) {
      console.log('   ⚠️ Audio failed, continuing...');
    }

    // Step 9: Publish
    console.log('\n📤 Step 8/8: Publishing episode...');
    const publishResult = await callComicAPI('/api/admin/comics/publish', {
      draftId,
    });

    const duration = Date.now() - startTime;
    const episodeId = publishResult.episodeId;

    // Update queue item if used
    if (queueItem) {
      await db.collection('comic_generation_queue').doc(queueItem.id).update({
        status: 'completed',
        episodeId,
      });
    }

    console.log('\n' + '═'.repeat(50));
    console.log('🎉 SUCCESS!');
    console.log(`   Episode ID: ${episodeId}`);
    console.log(`   Draft ID: ${draftId}`);
    console.log(`   Images: ${imagesGenerated}/${panelCount}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('═'.repeat(50) + '\n');

    return { success: true, episodeId, draftId, duration };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.log('\n' + '═'.repeat(50));
    console.log('❌ FAILED!');
    console.log(`   Error: ${error.message}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('═'.repeat(50) + '\n');

    return { success: false, error: error.message, duration };
  }
}

// Run
generateComicEpisode()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
