/**
 * Upload comic character sheets to Firebase Storage and create saved_characters documents
 *
 * Run with: npx ts-node scripts/upload-comic-characters.ts
 */

import * as admin from 'firebase-admin'
import * as fs from 'fs'
import * as path from 'path'

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json')
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found:', serviceAccountPath)
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app',
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

interface CharacterData {
  id: string
  name: string
  nameJa: string
  role: 'protagonist' | 'mentor' | 'friend' | 'supporting'
  visualDescription: string
  personality: string
  speakingStyle: string
  fileName: string | null
}

const characters: CharacterData[] = [
  {
    id: 'moshi-master',
    name: 'Moshi',
    nameJa: 'もし',
    role: 'protagonist',
    visualDescription: 'A cute red panda with fluffy reddish-brown fur, a bushy striped tail, and curious bright eyes. Wears a small blue backpack. Round face with distinctive red panda markings - white eyebrows and muzzle, dark eye patches.',
    personality: 'Curious, enthusiastic, eager to learn, sometimes gets nervous but always brave. Loves trying new things and making friends.',
    speakingStyle: 'Friendly and informal, uses simple Japanese suitable for beginners. Often expresses wonder and excitement. Uses polite forms when speaking to Sensei.',
    fileName: 'moshi.png',
  },
  {
    id: 'sensei-panda',
    name: 'Sensei',
    nameJa: '先生',
    role: 'mentor',
    visualDescription: 'A wise elderly giant panda with a long white beard. Wears a brown kimono/haori over blue-gray clothing with an obi. Often carries a wooden bo staff. Round panda face with gentle, knowing eyes.',
    personality: 'Wise, patient, traditional, occasionally stern but always caring. Loves tea ceremonies and teaching about Japanese culture and history.',
    speakingStyle: 'Speaks formally and uses traditional expressions. Often shares proverbs and cultural wisdom. Uses honorific language.',
    fileName: 'Gemini_Generated_Image_1g7tvt1g7tvt1g7t.png',
  },
  {
    id: 'yuki-sloth',
    name: 'Yuki',
    nameJa: 'ゆき',
    role: 'friend',
    visualDescription: 'A cute brown three-toed sloth with a cream-colored face and friendly smile. Wears a green backpack. Has long arms, small ears, and a perpetually relaxed expression. Fluffy brown fur.',
    personality: 'Relaxed, mindful, observant. Never rushes. Appreciates the simple things in life. Surprisingly insightful despite appearing sleepy.',
    speakingStyle: 'Speaks slowly and calmly. Uses casual Japanese. Often pauses mid-sentence. Makes observations others miss.',
    fileName: 'Gemini_Generated_Image_1pwxsb1pwxsb1pwx.png',
  },
  {
    id: 'koa-koala',
    name: 'Koa',
    nameJa: 'コア',
    role: 'friend',
    visualDescription: 'An adventurous gray koala with a white fluffy chest and belly. Large round fluffy ears with white inner fur. Wears a brown backpack with green straps. Has a distinctive black nose.',
    personality: 'Adventurous, energetic, brave, sometimes reckless. Loves exploring new places and trying exciting activities. Very loyal friend.',
    speakingStyle: 'Enthusiastic and casual. Uses exclamations often. Speaks quickly when excited. Uses friendly casual Japanese.',
    fileName: 'Gemini_Generated_Image_fyp7npfyp7npfyp7.png',
  },
]

async function uploadCharacter(char: CharacterData) {
  console.log(`\nProcessing ${char.name} (${char.id})...`)

  let imageUrl: string | null = null
  let base64Image: string | null = null

  // Upload image if fileName is provided
  if (char.fileName) {
    const imagePath = path.join(__dirname, '../moshi-comics', char.fileName)

    if (fs.existsSync(imagePath)) {
      console.log(`  Uploading image: ${char.fileName}`)

      // Read file and convert to base64
      const imageBuffer = fs.readFileSync(imagePath)
      base64Image = imageBuffer.toString('base64')

      // Upload to Firebase Storage
      const destination = `comics/characters/${char.id}.png`
      const file = bucket.file(destination)

      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/png',
          metadata: {
            characterId: char.id,
            characterName: char.name,
          },
        },
      })

      // Make the file publicly accessible
      await file.makePublic()

      // Get public URL
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`
      console.log(`  Uploaded to: ${imageUrl}`)
    } else {
      console.log(`  Warning: Image file not found: ${imagePath}`)
    }
  } else {
    console.log(`  No image file specified for ${char.name}`)
  }

  // Create/update Firestore document
  // Note: base64Image is too large for Firestore (>1MB), so we only store the URL
  // The comic generation code will fetch from Storage URL when needed
  const docData = {
    id: char.id,
    name: char.name,
    nameJa: char.nameJa,
    role: char.role,
    visualDescription: char.visualDescription,
    personality: char.personality,
    speakingStyle: char.speakingStyle,
    imageUrl: imageUrl,
    // base64Image stored separately - fetched on demand from Storage
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  await db.collection('saved_characters').doc(char.id).set(docData, { merge: true })
  console.log(`  Created/updated Firestore document: saved_characters/${char.id}`)
}

async function main() {
  console.log('=== Comic Character Upload Script ===\n')
  console.log(`Storage bucket: ${bucket.name}`)
  console.log(`Characters to process: ${characters.length}`)

  for (const char of characters) {
    await uploadCharacter(char)
  }

  console.log('\n=== Upload Complete ===')
  console.log('Characters are now available in:')
  console.log('  - Firebase Storage: comics/characters/{id}.png')
  console.log('  - Firestore: saved_characters/{id}')

  process.exit(0)
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})
