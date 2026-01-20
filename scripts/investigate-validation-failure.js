const admin = require('firebase-admin');
const path = require('path');
const { z } = require('zod');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Import the current schema to test
let StoryPageSchema;
try {
  const schemas = require('../src/lib/ai/schemas/story-schemas.ts');
  StoryPageSchema = schemas.StoryPageSchema;
  console.log('✅ Successfully loaded StoryPageSchema from TypeScript');
} catch (e) {
  console.log('⚠️  Cannot load TypeScript schema directly, creating test schema');
  StoryPageSchema = z.object({
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
}

async function investigateValidationFailure() {
  console.log('=== Investigating Schema Validation Failure ===\n');

  // 1. Test the schema with problematic data
  console.log('1. TESTING SCHEMA WITH ACTUAL PROBLEMATIC DATA\n');

  const problematicPage = {
    pageNumber: 3,
    text: "陸（りく）と愛子（あいこ）は公園（こうえん）で武（たけし）に会（あ）いました。",
    // textWithFurigana: MISSING!
    translation: "Riku and Aiko met Takeshi at the park.",
    imagePrompt: "Scene at a park",
    vocabularyNotes: [],
    grammarNotes: [],
  };

  console.log('Testing page data WITHOUT textWithFurigana:');
  console.log(JSON.stringify(problematicPage, null, 2));
  console.log('');

  const result = StoryPageSchema.safeParse(problematicPage);

  if (result.success) {
    console.log('❌ CRITICAL: Schema validation PASSED when it should have FAILED!');
    console.log('This means the schema is not enforcing the required field.');
    console.log('');
  } else {
    console.log('✅ Schema validation correctly FAILED');
    console.log('Errors:', result.error.errors);
    console.log('');
  }

  // 2. Check if .optional() or .passthrough() is present
  console.log('2. CHECKING SCHEMA DEFINITION\n');

  console.log('Schema shape:', Object.keys(StoryPageSchema.shape || {}));
  console.log('');

  // Test with textWithFurigana present
  const correctPage = {
    ...problematicPage,
    textWithFurigana: '<ruby>陸<rt>りく</rt></ruby>と<ruby>愛子<rt>あいこ</rt></ruby>',
  };

  const correctResult = StoryPageSchema.safeParse(correctPage);
  console.log('Testing page data WITH textWithFurigana:');
  console.log('Result:', correctResult.success ? '✅ PASSED' : '❌ FAILED');
  if (!correctResult.success) {
    console.log('Errors:', correctResult.error.errors);
  }
  console.log('');

  // 3. Check actual generated story data
  console.log('3. CHECKING ACTUAL GENERATED STORY DATA\n');

  const storyDoc = await db.collection('stories').doc('story_1768694424281_scheduler-system').get();

  if (storyDoc.exists) {
    const storyData = storyDoc.data();
    const page3 = storyData.pages?.[2]; // 0-indexed

    console.log('Actual Page 3 from Firestore:');
    console.log('Fields present:', Object.keys(page3 || {}));
    console.log('Has textWithFurigana:', 'textWithFurigana' in (page3 || {}));
    console.log('');

    if (page3) {
      const validationResult = StoryPageSchema.safeParse(page3);
      console.log('Validating actual Firestore data against current schema:');
      console.log('Result:', validationResult.success ? '✅ PASSED' : '❌ FAILED');
      if (!validationResult.success) {
        console.log('Errors:', validationResult.error.errors);
      }
      console.log('');
    }
  }

  // 4. Check generation logs for validation errors
  console.log('4. CHECKING FOR VALIDATION ERRORS IN LOGS\n');

  try {
    const logsSnapshot = await db.collection('story_generation_logs')
      .where('storyId', '==', 'story_1768694424281_scheduler-system')
      .limit(1)
      .get();

    if (!logsSnapshot.empty) {
      const logData = logsSnapshot.docs[0].data();
      console.log('Generation log status:', logData.success ? '✅ SUCCESS' : '❌ FAILED');
      console.log('Logged errors:', logData.errors || 'None');
      console.log('Logged warnings:', logData.warnings || 'None');
    }
  } catch (e) {
    console.log('Could not query generation logs:', e.message);
  }
  console.log('');

  // 5. Test with various field combinations
  console.log('5. TESTING SCHEMA WITH VARIOUS FIELD COMBINATIONS\n');

  const testCases = [
    {
      name: 'All fields present',
      data: correctPage,
      shouldPass: true,
    },
    {
      name: 'Missing textWithFurigana',
      data: { ...correctPage, textWithFurigana: undefined },
      shouldPass: false,
    },
    {
      name: 'Empty textWithFurigana',
      data: { ...correctPage, textWithFurigana: '' },
      shouldPass: false,
    },
    {
      name: 'Missing text',
      data: { ...correctPage, text: undefined },
      shouldPass: false,
    },
    {
      name: 'Extra fields (should be ignored)',
      data: { ...correctPage, extraField: 'value' },
      shouldPass: true,
    },
  ];

  testCases.forEach(testCase => {
    const result = StoryPageSchema.safeParse(testCase.data);
    const passed = result.success;
    const expected = testCase.shouldPass;
    const correct = passed === expected;

    console.log(`${correct ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASSED' : 'FAILED'} (expected: ${expected ? 'PASS' : 'FAIL'})`);
    if (!correct && !result.success) {
      console.log('   Errors:', result.error.errors.map(e => e.message).join(', '));
    }
  });

  console.log('');
  console.log('=== Investigation Complete ===');
}

investigateValidationFailure()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Investigation failed:', e);
    process.exit(1);
  });
