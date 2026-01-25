/**
 * Direct repair script for drafts with missing page data
 * Calls OpenAI directly without needing web server
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../moshimoshi-service-account.json'), 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
});

// Story Page Schema (from story-schemas.ts)
const StoryPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1),
  textWithFurigana: z.string().min(1),
  translation: z.string().min(1),
  imagePrompt: z.string(),
  vocabularyNotes: z.array(z.object({
    word: z.string(),
    note: z.string(),
  })),
  grammarNotes: z.array(z.object({
    pattern: z.string(),
    explanation: z.string(),
  })),
});

const DRAFT_ID = process.argv[2] || 'draft_1769299765109_scheduler-system';

const JLPT_GUIDELINES = {
  N5: `
    - Use only basic hiragana/katakana and ~80 kanji
    - Simple present/past tense (です/ます, でした/ました)
    - Basic particles: は, が, を, に, で, の, と, も
    - Sentence patterns: ～があります/います, ～がすきです, ～をします
    - Keep sentences under 15 words`,
  N4: `
    - Use ~300 kanji
    - Te-form connections, ～ている, ～たい
    - Conditional: ～たら, ～ば
    - Giving/receiving: ～てあげる/もらう/くれる
    - Keep sentences under 20 words`,
  N3: `
    - Use ~600 kanji
    - Passive, causative, causative-passive
    - Complex conditionals: ～としても, ～ものなら
    - Various expressions: ～ようにする, ～ことになる
    - Keep sentences under 25 words`,
};

async function generatePage(draft, pageNumber) {
  const jlptLevel = draft.jlptLevel || 'N5';
  const characterSheet = draft.characterSheet;
  const outline = draft.outline;
  const pageOutline = outline.pages[pageNumber - 1];

  const systemPrompt = 'You are an expert in writing Japanese learning materials. You create natural, engaging text appropriate for specific JLPT levels.';

  const userPrompt = `Generate page ${pageNumber} of the Japanese learning story:

Character Sheet:
${JSON.stringify(characterSheet, null, 2)}

Page Outline:
${JSON.stringify(pageOutline, null, 2)}

JLPT Level: ${jlptLevel}
${JLPT_GUIDELINES[jlptLevel] || JLPT_GUIDELINES.N5}

Generate the actual story text for this page following these requirements:
1. Japanese text with natural flow
2. Use vocabulary and grammar appropriate for ${jlptLevel}
3. Make it engaging and educational
4. Include the key vocabulary and grammar points from the outline
5. Text should be 3-5 sentences for N5, 4-6 for N4, 5-8 for N3+

Response format (JSON only):
{
  "pageNumber": ${pageNumber},
  "text": "Japanese text for the page (plain text, no furigana)",
  "textWithFurigana": "Same text but with furigana in HTML ruby tags <ruby>漢字<rt>かんじ</rt></ruby>",
  "translation": "Natural English translation",
  "vocabularyNotes": [{"word": "word", "note": "explanation"}],
  "grammarNotes": [{"pattern": "pattern", "explanation": "explanation"}],
  "imagePrompt": "Detailed prompt for DALL-E including character descriptions and visual style"
}`;

  console.log(`  Calling OpenAI for page ${pageNumber}...`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: zodResponseFormat(StoryPageSchema, 'story_page')
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(response);
  const validated = StoryPageSchema.parse(parsed);

  console.log(`  ✅ OpenAI returned valid page data`);
  console.log(`     Tokens used: ${completion.usage?.total_tokens}`);

  return validated;
}

async function repairDraft() {
  console.log(`Repairing draft: ${DRAFT_ID}`);
  console.log('');

  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    console.error('   Run: export OPENAI_API_KEY=your_key_here');
    process.exit(1);
  }

  // Get draft
  const draftDoc = await db.collection('ai_story_drafts').doc(DRAFT_ID).get();
  if (!draftDoc.exists) {
    console.error('❌ Draft not found');
    process.exit(1);
  }

  const draft = draftDoc.data();
  console.log('Draft status:', draft.status);
  console.log('JLPT Level:', draft.jlptLevel);
  console.log('Page count:', draft.pageCount);
  console.log('Theme:', draft.theme);
  console.log('');

  // Check which pages need repair
  const pages = draft.pages || [];
  const pagesToRepair = [];

  for (let i = 0; i < draft.pageCount; i++) {
    const page = pages[i];
    if (!page || !page.textWithFurigana || !page.translation) {
      pagesToRepair.push(i + 1);
    }
  }

  if (pagesToRepair.length === 0) {
    console.log('✅ All pages are complete! No repair needed.');
    return;
  }

  console.log(`Pages to repair: ${pagesToRepair.join(', ')}`);
  console.log('');

  // Re-generate each damaged page
  const repairedPages = [...pages];

  for (const pageNum of pagesToRepair) {
    console.log(`Regenerating page ${pageNum}/${draft.pageCount}...`);

    try {
      const pageData = await generatePage(draft, pageNum);

      // Preserve any existing data like audioUrl
      const existingPage = pages[pageNum - 1] || {};
      repairedPages[pageNum - 1] = {
        ...pageData,
        audioUrl: existingPage.audioUrl, // Keep existing audio
      };

      console.log(`  ✅ Page ${pageNum} regenerated`);
      console.log(`     text: ${pageData.text.substring(0, 50)}...`);
      console.log(`     translation: ${pageData.translation.substring(0, 50)}...`);
      console.log(`     textWithFurigana: Present (${pageData.textWithFurigana.length} chars)`);
      console.log('');

    } catch (error) {
      console.error(`  ❌ Page ${pageNum} failed:`, error.message);
    }
  }

  // Update Firestore
  console.log('Saving repaired pages to Firestore...');
  await db.collection('ai_story_drafts').doc(DRAFT_ID).update({
    pages: repairedPages,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    repairNote: `Pages ${pagesToRepair.join(', ')} regenerated at ${new Date().toISOString()}`,
  });

  console.log('✅ Firestore updated');
  console.log('');

  // Verify
  console.log('Verifying repair...');
  const verifyDoc = await db.collection('ai_story_drafts').doc(DRAFT_ID).get();
  const verifyData = verifyDoc.data();
  const verifyPages = verifyData.pages || [];

  let allGood = true;
  for (let i = 0; i < draft.pageCount; i++) {
    const page = verifyPages[i];
    const hasRequired = page && page.textWithFurigana && page.translation;
    const status = hasRequired ? '✅' : '❌';
    console.log(`Page ${i + 1}: ${status}`);
    if (!hasRequired) allGood = false;
  }

  console.log('');
  if (allGood) {
    console.log('✅ All pages repaired successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Deploy the audio endpoint fix');
    console.log('2. Trigger publish-draft API to publish the story');
  } else {
    console.log('⚠️ Some pages still need repair.');
  }
}

repairDraft().catch(e => {
  console.error('Repair failed:', e);
  process.exit(1);
});
