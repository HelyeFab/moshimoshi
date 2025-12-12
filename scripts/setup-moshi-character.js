/**
 * Setup Moshi Character Reference
 *
 * Creates the master character reference for "Moshi Goes to Japan" comic series.
 * This generates a character model sheet using Gemini and saves it to Firestore
 * in the saved_characters collection for use in episode generation.
 *
 * Run: node scripts/setup-moshi-character.js
 */

const admin = require('firebase-admin')
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

// Configuration
const MOSHI_CHARACTER_ID = 'moshi-master'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Moshi character definition
const MOSHI_CHARACTER = {
  id: MOSHI_CHARACTER_ID,
  name: 'Moshi',
  nameJa: 'もし',
  description:
    'Moshi is a curious and friendly red panda who has traveled from the bamboo forests to explore Japan. ' +
    'Small but brave, Moshi loves making new friends, trying Japanese food, and learning about Japanese culture. ' +
    'Despite sometimes getting confused or lost, Moshi always stays positive and finds a way through challenges.',
  visualDescription:
    'Adorable red panda (lesser panda) with distinctive rusty red-orange fur on the body and face, ' +
    'white markings on the face including white cheeks and eyebrows, dark reddish-brown fur on the legs and belly, ' +
    'long bushy ringed tail with alternating dark and light bands, small rounded ears with white tips, ' +
    'bright curious eyes, small black nose, cute expressive face. ' +
    'Wears a small blue backpack for adventures. Child-friendly kawaii design.',
  personality:
    'Curious, friendly, optimistic, sometimes confused but resourceful, loves food especially onigiri and takoyaki, ' +
    'easily excited by new experiences, polite and tries hard to speak Japanese correctly',
  visualStyle: 'Kawaii manga style, soft pastel colors, children\'s book illustration, clean lines, expressive',
  isMascot: true,
  colorPalette: [
    '#D35400', // Rusty orange-red fur
    '#FFFFFF', // White face markings
    '#5D4037', // Dark brown legs/belly
    '#3498DB', // Blue backpack
    '#2C3E50', // Dark tail bands
    '#F39C12', // Lighter orange accents
  ],
  tags: ['mascot', 'red-panda', 'main-character', 'moshi-goes-to-japan'],
  usedInEpisodes: [],
}

// Prompt for generating the character model sheet
const MODEL_SHEET_PROMPT = `Create a professional character design reference sheet for Moshi, a cute red panda mascot.

Character Details:
- Species: Red panda (lesser panda)
- Fur: Rusty red-orange body and face
- Face markings: White cheeks and eyebrows, small black nose
- Body: Dark reddish-brown fur on legs and belly
- Tail: Long, bushy, with alternating dark and light ring bands
- Ears: Small, rounded with white tips
- Eyes: Big, bright, curious and expressive
- Accessory: Small blue backpack

Art Style:
- Kawaii manga style
- Soft, friendly children's book illustration
- Clean lines
- Pastel colors with pops of warm orange
- Expressive and cute

This is a character model sheet showing the red panda character from multiple angles:
- Front view (standing, smiling)
- Side profile view
- 3/4 view (slightly turned)
- Close-up face with different expressions (happy, surprised, thinking)

Clean white background. Professional reference sheet layout for maintaining consistency across illustrations.`

/**
 * Generate character model sheet using Gemini
 */
async function generateModelSheet() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable not set')
  }

  const model = 'gemini-2.5-flash-image'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

  console.log('🎨 Generating Moshi character model sheet with Gemini...')
  console.log(`   Model: ${model}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: MODEL_SHEET_PROMPT }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`)
  }

  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find(p => p.inlineData)
  const textPart = parts.find(p => p.text)

  if (!imagePart) {
    throw new Error('No image generated by Gemini')
  }

  console.log('✅ Model sheet generated successfully')
  console.log(`   Image data size: ${imagePart.inlineData.data.length} characters`)
  if (textPart) {
    console.log(`   Gemini note: ${textPart.text.substring(0, 100)}...`)
  }

  return {
    imageData: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    revisedPrompt: textPart?.text,
  }
}

/**
 * Upload image to Firebase Storage
 */
async function uploadToStorage(base64Data, mimeType) {
  console.log('📤 Uploading to Firebase Storage...')

  const buffer = Buffer.from(base64Data, 'base64')
  const filename = `characters/${MOSHI_CHARACTER_ID}/model-sheet.png`

  const file = storage.file(filename)
  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        characterId: MOSHI_CHARACTER_ID,
        type: 'model-sheet',
        createdAt: new Date().toISOString(),
      },
    },
  })

  // Make the file publicly accessible
  await file.makePublic()

  const publicUrl = `https://storage.googleapis.com/${storage.name}/${filename}`
  console.log(`✅ Uploaded to: ${publicUrl}`)

  return publicUrl
}

/**
 * Save character to Firestore
 * Note: referenceImageData is stored in Storage (too large for Firestore 1MB limit)
 * The URL points to the Storage location for image generation
 */
async function saveCharacter(imageUrl, imageDataSize) {
  console.log('💾 Saving character to Firestore...')

  const now = admin.firestore.FieldValue.serverTimestamp()

  const characterDoc = {
    ...MOSHI_CHARACTER,
    referenceImageUrl: imageUrl,
    // Store metadata about the image, not the full base64 (too large for Firestore)
    referenceImageMeta: {
      storageUrl: imageUrl,
      storagePath: `characters/${MOSHI_CHARACTER_ID}/model-sheet.png`,
      originalSize: imageDataSize,
      format: 'png',
    },
    createdAt: now,
    createdBy: 'setup-script',
    updatedAt: now,
  }

  await db.collection('saved_characters').doc(MOSHI_CHARACTER_ID).set(characterDoc)

  console.log(`✅ Character saved with ID: ${MOSHI_CHARACTER_ID}`)
}

/**
 * Main setup function
 */
async function setup() {
  console.log('🐼 Moshi Character Setup Script')
  console.log('================================\n')

  try {
    // Check if character already exists
    const existingDoc = await db.collection('saved_characters').doc(MOSHI_CHARACTER_ID).get()

    if (existingDoc.exists) {
      const data = existingDoc.data()
      console.log('⚠️  Moshi character already exists!')
      console.log(`   Created: ${data.createdAt?.toDate?.() || 'unknown'}`)
      console.log(`   Has reference image: ${!!data.referenceImageData}`)
      console.log('')

      // Ask for confirmation to overwrite
      const readline = require('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const answer = await new Promise(resolve => {
        rl.question('Do you want to regenerate the character sheet? (y/N): ', resolve)
      })
      rl.close()

      if (answer.toLowerCase() !== 'y') {
        console.log('\n❌ Aborted. Character not modified.')
        process.exit(0)
      }

      console.log('')
    }

    // Step 1: Generate model sheet
    const { imageData, mimeType } = await generateModelSheet()

    // Step 2: Upload to Storage (required - image too large for Firestore)
    let imageUrl = ''
    try {
      imageUrl = await uploadToStorage(imageData, mimeType)
    } catch (uploadError) {
      console.error('❌ Storage upload failed:', uploadError.message)
      throw new Error('Storage upload is required for character images')
    }

    // Step 3: Save to Firestore (with URL reference, not base64)
    await saveCharacter(imageUrl, imageData.length)

    // Step 4: Verify
    console.log('\n🔍 Verifying setup...')
    const verifyDoc = await db.collection('saved_characters').doc(MOSHI_CHARACTER_ID).get()
    const verifyData = verifyDoc.data()

    console.log(`   ✅ Name: ${verifyData.name} (${verifyData.nameJa})`)
    console.log(`   ✅ Reference image URL: ${verifyData.referenceImageUrl ? 'Set' : 'Not set'}`)
    console.log(`   ✅ Storage path: ${verifyData.referenceImageMeta?.storagePath || 'N/A'}`)
    console.log(`   ✅ Color palette: ${verifyData.colorPalette?.length || 0} colors`)

    console.log('\n🎉 Moshi character setup complete!')
    console.log('\nThe comic scheduler can now use this character reference')
    console.log('for generating consistent comic panel images.\n')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run setup
setup()
