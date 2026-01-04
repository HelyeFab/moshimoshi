/**
 * Regenerate a specific panel for a comic episode
 * Usage: node scripts/regenerate-comic-panel.js <episodeId> <panelNumber>
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  });
}

const db = admin.firestore();

async function regeneratePanel(episodeId, panelNumber) {
  console.log(`🔧 Regenerating panel ${panelNumber} for episode ${episodeId}\n`);

  // 1. Get the published comic
  const comicDoc = await db.collection('comics').doc(episodeId).get();
  if (!comicDoc.exists) {
    console.error('❌ Comic not found');
    process.exit(1);
  }

  const comic = comicDoc.data();
  const panel = comic.panels[panelNumber - 1];

  if (!panel) {
    console.error(`❌ Panel ${panelNumber} not found`);
    process.exit(1);
  }

  console.log('📋 Current panel data:');
  console.log('Scene:', panel.sceneDescription);
  console.log('Characters:', panel.dialogues?.map(d => d.characterName).join(', '));
  console.log('Current image:', panel.imageUrl);
  console.log('');

  // 2. Get character references
  // Episode 8 is "Ramen Adventure" with Moshi and Yuki
  const characterIds = ['moshi-master', 'yuki-sloth'];
  console.log('📚 Loading character references:', characterIds.join(', '));

  const characterRefs = [];
  for (const charId of characterIds) {
    const charDoc = await db.collection('saved_characters').doc(charId).get();
    if (charDoc.exists) {
      const data = charDoc.data();
      characterRefs.push({
        id: charId,
        name: data.name,
        nameJa: data.nameJa,
        role: data.role,
        visualDescription: data.visualDescription,
        personality: data.personality,
        speakingStyle: data.speakingStyle,
        imageUrl: data.referenceImageUrl,
      });
      console.log(`  ✅ Loaded ${data.name} (${data.nameJa})`);
    }
  }

  if (characterRefs.length === 0) {
    console.error('❌ No character references found');
    process.exit(1);
  }

  console.log('');

  // 3. Create a temporary draft for regeneration
  const draftId = `comic_draft_regen_${Date.now()}`;
  console.log(`📝 Creating temporary draft: ${draftId}`);

  await db.collection('comic_drafts').doc(draftId).set({
    seriesId: comic.seriesId,
    episodeNumber: comic.episodeNumber,
    theme: comic.theme,
    location: comic.location,
    jlptLevel: comic.jlptLevel || 'N5',
    characterIds: characterIds,
    outline: {
      title: comic.title,
      titleJa: comic.titleJa,
    },
    characterSheet: {
      mainCharacter: characterRefs.find(c => c.id === 'moshi-master'),
      supportingCharacters: characterRefs.filter(c => c.id !== 'moshi-master'),
      allCharacters: characterRefs,
    },
    characterRefs: characterRefs.map(c => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
    })),
    panels: comic.panels,
    status: 'generating',
    currentStep: 'images',
    progress: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'regeneration-script',
  });

  console.log('✅ Draft created');
  console.log('');

  // 4. Call the generation API to regenerate the panel
  console.log(`🎨 Regenerating panel ${panelNumber}...`);
  console.log('This may take 30-60 seconds...');

  const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${appUrl}/api/admin/comics/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify({
        step: 'panel_image',
        draftId: draftId,
        panelNumber: panelNumber,
        characterRefs: characterRefs.map(c => ({
          id: c.id,
          name: c.name,
          imageUrl: c.imageUrl,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('');

    if (!result.success) {
      console.error('❌ Panel regeneration failed:', result.error);
      await db.collection('comic_drafts').doc(draftId).delete();
      process.exit(1);
    }

    console.log('✅ Panel regenerated successfully!');
    console.log('New image URL:', result.imageUrl);
    console.log('');

    // 5. Get the updated panel from the draft
    const updatedDraftDoc = await db.collection('comic_drafts').doc(draftId).get();
    const updatedDraft = updatedDraftDoc.data();
    const updatedPanel = updatedDraft.panels[panelNumber - 1];

    // 6. Update the published comic with the new panel
    console.log('💾 Updating published comic...');

    const updatedPanels = [...comic.panels];
    updatedPanels[panelNumber - 1] = {
      ...updatedPanels[panelNumber - 1],
      imageUrl: updatedPanel.imageUrl,
      imagePrompt: updatedPanel.imagePrompt,
    };

    await db.collection('comics').doc(episodeId).update({
      panels: updatedPanels,
      updatedAt: new Date(),
    });

    console.log('✅ Published comic updated');
    console.log('');

    // 7. Clean up draft
    await db.collection('comic_drafts').doc(draftId).delete();
    console.log('🧹 Temporary draft deleted');
    console.log('');

    console.log('🎉 Panel regeneration complete!');
    console.log('Old image:', panel.imageUrl);
    console.log('New image:', result.imageUrl);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during regeneration:', error.message);

    // Clean up draft
    try {
      await db.collection('comic_drafts').doc(draftId).delete();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Parse command line arguments
const episodeId = process.argv[2];
const panelNumber = parseInt(process.argv[3], 10);

if (!episodeId || !panelNumber || isNaN(panelNumber)) {
  console.error('Usage: node scripts/regenerate-comic-panel.js <episodeId> <panelNumber>');
  console.error('Example: node scripts/regenerate-comic-panel.js moshi-goes-to-japan-ep008 6');
  process.exit(1);
}

regeneratePanel(episodeId, panelNumber).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
