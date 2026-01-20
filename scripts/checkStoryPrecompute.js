const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const kuromoji = require('kuromoji');

dotenv.config({ path: path.resolve('.env.local') });

const {
  FIREBASE_ADMIN_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY,
} = process.env;

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error('Missing Firebase Admin env vars (check .env.local)');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

function buildTokenizer() {
  const dictPaths = [
    path.resolve(__dirname, 'node_modules/kuromoji/dict'),
    path.resolve(__dirname, '../node_modules/kuromoji/dict'),
  ];

  const dictPath = dictPaths.find(p => {
    try {
      return require('fs').existsSync(p);
    } catch {
      return false;
    }
  });

  if (!dictPath) {
    throw new Error('Kuromoji dictionary not found');
  }

  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: dictPath }).build((err, tokenizer) => {
      if (err) return reject(err);
      resolve(tokenizer);
    });
  });
}

async function extractJapaneseWords(text, options) {
  const tokenizer = await buildTokenizer();
  const tokens = tokenizer.tokenize(text || '');
  const includeParticles = options && options.includeParticles === true;
  const minLength = typeof (options && options.minLength) === 'number'
    ? options.minLength
    : includeParticles
      ? 1
      : 2;

  const isJapaneseToken = word => /[\u3040-\u30ff\u4e00-\u9fff]/.test(word);

  const words = tokens
    .map(token => token.basic_form || token.surface_form)
    .filter(Boolean)
    .filter(word => isJapaneseToken(word))
    .filter(word => word.length >= minLength);

  const seen = new Set();
  const unique = [];
  for (const word of words) {
    const key = String(word).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(word);
    }
  }
  return unique;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const storyArg = args.find(arg => arg.startsWith('--story='));
  const storyId = storyArg && storyArg.split('=')[1];
  if (!storyId) {
    console.error('Usage: node checkStoryPrecompute.js --story=STORY_ID');
    process.exit(1);
  }
  return { storyId };
}

async function main() {
  const { storyId } = parseArgs();
  const storyDoc = await db.collection('stories').doc(storyId).get();
  if (!storyDoc.exists) {
    console.log('Story not found');
    return;
  }

  const story = storyDoc.data() || {};
  const pages = Array.isArray(story.pages) ? story.pages : [];
  const fullText = pages.map(p => (p && p.text) || '').filter(Boolean).join(' ');

  const preDoc = await db.collection('story_word_explanations').doc(storyId).get();
  if (!preDoc.exists) {
    console.log('No precompute doc');
    return;
  }

  const pre = preDoc.data() || {};
  const words = Array.isArray(pre.words) ? pre.words : [];
  const extracted = await extractJapaneseWords(fullText, { includeParticles: true, minLength: 1 });
  const precomputeWordSet = new Set(words.map(w => String(w.word || '').toLowerCase()).filter(Boolean));
  const missing = extracted.filter(w => !precomputeWordSet.has(String(w).toLowerCase()));

  console.log(
    JSON.stringify(
      {
        storyId,
        title: story.title,
        jlptLevel: story.jlptLevel,
        pages: pages.length,
        textLength: fullText.length,
        precomputeWords: words.length,
        extractedWords: extracted.length,
        missingWords: missing.length,
        missingSample: missing.slice(0, 30),
        precomputeVersion: pre.precomputeVersion,
        precomputeOptions: pre.precomputeOptions,
      },
      null,
      2
    )
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
