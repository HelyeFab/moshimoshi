/**
 * Setup Supporting Characters for "Moshi Goes to Japan"
 *
 * Uploads character sheets and creates Firestore documents for:
 * - Sensei (Panda mentor)
 * - Yuki (Sloth best friend)
 * - Koa (Koala adventure friend)
 *
 * Run: node scripts/setup-supporting-characters.js
 */

const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json')
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'moshimoshi-de237',
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  })
}

const db = admin.firestore()
const storage = admin.storage().bucket()

// Character definitions with their local image files
const CHARACTERS = [
  {
    id: 'sensei-panda',
    localImagePath: 'moshi-comics/Gemini_Generated_Image_1g7tvt1g7tvt1g7t.png',
    name: 'Sensei',
    nameJa: '先生',
    role: 'mentor',
    description:
      'Sensei is a wise and kind elderly panda who serves as Moshi\'s guide in Japan. ' +
      'With years of experience and deep knowledge of Japanese culture, Sensei helps Moshi ' +
      'understand traditions, etiquette, and the deeper meanings behind everyday experiences. ' +
      'Though sometimes stern, Sensei has a warm heart and genuinely cares about Moshi\'s growth.',
    visualDescription:
      'Elderly giant panda with distinctive black and white fur, a long white beard giving him a wise appearance. ' +
      'Wears a traditional brown haori (jacket) over a blue kimono with white trim. ' +
      'Carries a wooden bo staff. Round body, gentle wise eyes, distinguished appearance. ' +
      'Kawaii style but with a dignified, sensei-like presence.',
    personality:
      'Wise, patient, knowledgeable about Japanese culture and traditions, occasionally stern but caring, ' +
      'enjoys tea ceremonies and meditation, speaks in a calm measured way, offers guidance through stories and proverbs',
    speakingStyle: 'Formal and wise, uses polite Japanese forms, often includes proverbs or life lessons',
    catchphrase: 'Remember, young one... (覚えておきなさい、若者よ...)',
    isMascot: false,
    colorPalette: [
      '#FFFFFF', // White fur
      '#2C3E50', // Black fur
      '#8B4513', // Brown haori
      '#4A90A4', // Blue kimono
      '#D4A574', // Wooden staff
      '#E8E8E8', // White beard
    ],
    props: ['wooden bo staff', 'tea set', 'scroll', 'Japanese fan'],
    tags: ['mentor', 'panda', 'sensei', 'wise', 'traditional'],
    usedInEpisodes: [],
  },
  {
    id: 'yuki-sloth',
    localImagePath: 'moshi-comics/Gemini_Generated_Image_1pwxsb1pwxsb1pwx.png',
    name: 'Yuki',
    nameJa: 'ゆき',
    role: 'friend',
    description:
      'Yuki is a gentle and easygoing sloth who becomes Moshi\'s best friend in Japan. ' +
      'Though slow-moving, Yuki has a unique way of noticing beautiful details that others miss. ' +
      'Yuki helps Moshi slow down and appreciate the moment, teaching the value of mindfulness ' +
      'and finding joy in simple things.',
    visualDescription:
      'Adorable brown sloth with fluffy light brown fur and a cream-colored face with distinctive dark eye markings. ' +
      'Has a warm, sleepy smile and relaxed posture. Wears a green backpack for carrying snacks. ' +
      'Three-toed hands, small rounded ears, gentle droopy eyes. ' +
      'Kawaii style, soft and cuddly appearance, always looks content.',
    personality:
      'Relaxed, observant, appreciates small beautiful things, loves napping and snacks (especially leaves), ' +
      'moves slowly but thinks deeply, offers calm perspective, easily confused but takes it in stride',
    speakingStyle: 'Slow and thoughtful, casual Japanese, often pauses mid-sentence, uses simple words',
    catchphrase: 'Hmm... let\'s take it slow... (うーん...ゆっくりいこう...)',
    isMascot: false,
    colorPalette: [
      '#A0826D', // Brown fur
      '#F5E6D3', // Cream face
      '#5D4037', // Dark markings
      '#4CAF50', // Green backpack
      '#8BC34A', // Light green straps
      '#3E2723', // Dark brown claws
    ],
    props: ['green backpack', 'hammock', 'compass', 'leaf snacks'],
    tags: ['friend', 'sloth', 'relaxed', 'mindful', 'best-friend'],
    usedInEpisodes: [],
  },
  {
    id: 'koa-koala',
    localImagePath: 'moshi-comics/Gemini_Generated_Image_fyp7npfyp7npfyp7.png',
    name: 'Koa',
    nameJa: 'コア',
    role: 'friend',
    description:
      'Koa is an adventurous and curious koala who loves exploring new places with Moshi. ' +
      'Originally from Australia, Koa brings a unique outsider perspective to Japan, ' +
      'often making comparisons and discoveries that locals might overlook. ' +
      'Energetic but prone to getting sleepy, Koa is always ready for the next adventure.',
    visualDescription:
      'Cute gray koala with fluffy gray fur and a white/cream chest. Large round fluffy ears with white fur inside. ' +
      'Big black nose, bright curious eyes. Wears a brown adventure backpack with green straps. ' +
      'Compact body, short limbs, expressive face. ' +
      'Kawaii style, looks adventurous and ready to explore.',
    personality:
      'Adventurous, curious, enthusiastic about new experiences, sometimes gets sleepy at inconvenient times, ' +
      'loves trying new foods, asks lots of questions, brave but sometimes acts before thinking',
    speakingStyle: 'Energetic and casual, mixes in occasional Australian expressions, enthusiastic tone',
    catchphrase: 'Let\'s go explore! (探検しよう！)',
    isMascot: false,
    colorPalette: [
      '#9E9E9E', // Gray fur
      '#FAFAFA', // White chest
      '#424242', // Dark gray accents
      '#795548', // Brown backpack
      '#4CAF50', // Green straps
      '#212121', // Black nose
    ],
    props: ['brown backpack', 'eucalyptus leaf', 'sleeping bag', 'boomerang'],
    tags: ['friend', 'koala', 'adventurous', 'curious', 'explorer'],
    usedInEpisodes: [],
  },
]

/**
 * Upload character image to Firebase Storage and get public URL
 */
async function uploadCharacterImage(character) {
  const localPath = path.join(__dirname, '..', character.localImagePath)

  if (!fs.existsSync(localPath)) {
    throw new Error(`Character image not found: ${localPath}`)
  }

  const imageBuffer = fs.readFileSync(localPath)
  const storagePath = `characters/${character.id}/model-sheet.png`

  console.log(`  Uploading ${character.name} image to ${storagePath}...`)

  const file = storage.file(storagePath)
  await file.save(imageBuffer, {
    metadata: {
      contentType: 'image/png',
      metadata: {
        characterId: character.id,
        characterName: character.name,
        uploadedAt: new Date().toISOString(),
      },
    },
  })

  await file.makePublic()
  const publicUrl = `https://storage.googleapis.com/${storage.name}/${storagePath}`

  const sizeKB = (imageBuffer.length / 1024).toFixed(1)
  console.log(`  Uploaded: ${publicUrl} (${sizeKB} KB)`)
  return { publicUrl, sizeKB: parseFloat(sizeKB) }
}

/**
 * Create or update character document in Firestore
 * Note: We don't store base64 in Firestore due to size limits (1MB max).
 * The scheduler fetches from URL and converts to base64 at runtime.
 */
async function saveCharacterToFirestore(character, imageUrl, imageSizeKB) {
  const docRef = db.collection('saved_characters').doc(character.id)
  const now = new Date()

  const characterDoc = {
    id: character.id,
    name: character.name,
    nameJa: character.nameJa,
    role: character.role,
    description: character.description,
    visualDescription: character.visualDescription,
    personality: character.personality,
    speakingStyle: character.speakingStyle || null,
    catchphrase: character.catchphrase || null,
    isMascot: character.isMascot,
    referenceImageUrl: imageUrl,
    // Note: referenceImageData is NOT stored here due to Firestore's 1MB limit.
    // The scheduler fetches from URL and converts to base64 at runtime.
    referenceImageMeta: {
      storageUrl: imageUrl,
      storagePath: `characters/${character.id}/model-sheet.png`,
      originalSizeKB: imageSizeKB,
      format: 'png',
    },
    colorPalette: character.colorPalette,
    props: character.props || [],
    tags: character.tags,
    usedInEpisodes: character.usedInEpisodes,
    createdAt: now,
    createdBy: 'setup-script',
    updatedAt: now,
  }

  await docRef.set(characterDoc)
  console.log(`  Saved ${character.name} to Firestore: saved_characters/${character.id}`)
}

/**
 * Update comic series with supporting character IDs
 */
async function updateComicSeries() {
  const seriesRef = db.collection('comic_series').doc('moshi-goes-to-japan')
  const seriesDoc = await seriesRef.get()

  if (!seriesDoc.exists) {
    console.log('  Comic series not found, skipping series update')
    return
  }

  const supportingCharacterIds = CHARACTERS.map(c => c.id)

  await seriesRef.update({
    supportingCharacterIds,
    updatedAt: new Date(),
  })

  console.log(`  Updated comic series with supporting characters: ${supportingCharacterIds.join(', ')}`)
}

/**
 * Update Moshi character to include role field
 */
async function updateMoshiCharacter() {
  const moshiRef = db.collection('saved_characters').doc('moshi-master')
  const moshiDoc = await moshiRef.get()

  if (!moshiDoc.exists) {
    console.log('  Moshi character not found, skipping update')
    return
  }

  await moshiRef.update({
    role: 'protagonist',
    speakingStyle: 'Casual and friendly, uses simple Japanese, often expresses excitement',
    catchphrase: 'Sugoi! (すごい！)',
    props: ['blue backpack'],
    updatedAt: new Date(),
  })

  console.log('  Updated Moshi character with new fields')
}

/**
 * Main setup function
 */
async function setupSupportingCharacters() {
  console.log('='.repeat(60))
  console.log('Setting up Supporting Characters for "Moshi Goes to Japan"')
  console.log('='.repeat(60))

  try {
    // Process each character
    for (const character of CHARACTERS) {
      console.log(`\nProcessing ${character.name} (${character.nameJa})...`)

      // Upload image
      const { publicUrl, sizeKB } = await uploadCharacterImage(character)

      // Save to Firestore
      await saveCharacterToFirestore(character, publicUrl, sizeKB)

      console.log(`  ✅ ${character.name} setup complete!`)
    }

    // Update Moshi with new fields
    console.log('\nUpdating Moshi character with new fields...')
    await updateMoshiCharacter()

    // Update comic series
    console.log('\nUpdating comic series with supporting characters...')
    await updateComicSeries()

    console.log('\n' + '='.repeat(60))
    console.log('✅ All supporting characters set up successfully!')
    console.log('='.repeat(60))

    // Summary
    console.log('\nCharacter Summary:')
    console.log('  - Moshi (もし) - Protagonist - Red Panda')
    for (const char of CHARACTERS) {
      console.log(`  - ${char.name} (${char.nameJa}) - ${char.role} - ${char.tags[1]}`)
    }

    console.log('\nFirestore Collections Updated:')
    console.log('  - saved_characters/moshi-master (updated)')
    for (const char of CHARACTERS) {
      console.log(`  - saved_characters/${char.id} (created)`)
    }
    console.log('  - comic_series/moshi-goes-to-japan (updated)')

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the setup
setupSupportingCharacters()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
