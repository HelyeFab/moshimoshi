const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testBothCaches() {
  try {
    console.log('🔍 Comparing TTS Cache vs Transcript Cache Systems\n');
    console.log('='.repeat(80));

    // Test TTS Cache
    console.log('\n📢 TTS CACHE SYSTEM:');
    console.log('-'.repeat(40));

    console.log('Collection name: tts_cache');
    console.log('Key structure: Hash of (text + provider + voice)');
    console.log('Server-side location: /src/lib/tts/cache.ts');
    console.log('Uses Firebase Admin SDK: ✅');

    const ttsCache = await db.collection('tts_cache').limit(5).get();
    console.log(`\nFound ${ttsCache.size} TTS cache entries`);

    if (!ttsCache.empty) {
      console.log('\nSample TTS cache structure:');
      const firstDoc = ttsCache.docs[0];
      const data = firstDoc.data();
      console.log('  Document ID:', firstDoc.id);
      console.log('  Fields:', Object.keys(data).join(', '));
      console.log('  Provider:', data.provider);
      console.log('  Voice:', data.voice);
      console.log('  Has Audio URL:', !!data.audioUrl);
      console.log('  Created At:', data.createdAt?.toDate());
      console.log('  Access Count:', data.accessCount);
    }

    // Test Transcript Cache
    console.log('\n\n📝 TRANSCRIPT CACHE SYSTEM:');
    console.log('-'.repeat(40));

    console.log('Collection name: transcriptCache');
    console.log('Key structure: youtube_{videoId}');
    console.log('Client-side location: /src/utils/transcriptCache.ts');
    console.log('Server-side location: /src/app/api/youtube/extract/route.ts');
    console.log('Uses Firebase Admin SDK: ✅ (in API route)');

    const transcriptCache = await db.collection('transcriptCache').limit(5).get();
    console.log(`\nFound ${transcriptCache.size} transcript cache entries`);

    if (!transcriptCache.empty) {
      console.log('\nSample transcript cache structure:');
      const firstDoc = transcriptCache.docs[0];
      const data = firstDoc.data();
      console.log('  Document ID:', firstDoc.id);
      console.log('  Fields:', Object.keys(data).join(', '));
      console.log('  Content Type:', data.contentType);
      console.log('  Language:', data.language);
      console.log('  Has Transcript:', !!data.transcript);
      console.log('  Has AI Formatted:', !!data.formattedTranscript);
      console.log('  Created At:', data.createdAt?.toDate());
      console.log('  Access Count:', data.accessCount);
    }

    // Key Differences
    console.log('\n\n🔄 KEY DIFFERENCES:');
    console.log('='.repeat(80));

    console.log('\n1. ARCHITECTURE APPROACH:');
    console.log('   TTS Cache:');
    console.log('   - Has dedicated cache service class (TTSCacheService)');
    console.log('   - Singleton pattern: export const ttsCache = new TTSCacheService()');
    console.log('   - Used in /src/lib/tts/service.ts via import');
    console.log('   - Clean separation of concerns');

    console.log('\n   Transcript Cache:');
    console.log('   - Mixed approach: client-side class + server-side functions');
    console.log('   - Client has TranscriptCacheManager class (not used server-side)');
    console.log('   - Server implements inline functions in API route');
    console.log('   - Less clean separation');

    console.log('\n2. CACHING LOGIC:');
    console.log('   TTS Cache:');
    console.log('   - Automatically updates access stats on read');
    console.log('   - Has sophisticated batch operations');
    console.log('   - Includes search and clear with filters');
    console.log('   - Better error handling with try-catch blocks');

    console.log('\n   Transcript Cache:');
    console.log('   - Manual access count updates in API route');
    console.log('   - Basic get/set operations');
    console.log('   - No batch operations or search');
    console.log('   - Less comprehensive error handling');

    console.log('\n3. DATA STRUCTURE:');
    console.log('   TTS Cache:');
    console.log('   - Normalized text field for matching');
    console.log('   - Storage path tracking');
    console.log('   - Size tracking for storage management');
    console.log('   - Type metadata (character/word/sentence/paragraph)');

    console.log('\n   Transcript Cache:');
    console.log('   - Raw and formatted transcript arrays');
    console.log('   - Video-specific metadata');
    console.log('   - No size tracking');
    console.log('   - Content type (youtube/audio/video)');

    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('='.repeat(80));

    console.log('\n1. REFACTOR TRANSCRIPT CACHE to match TTS pattern:');
    console.log('   - Create /src/lib/transcript/cache.ts with TranscriptCacheService class');
    console.log('   - Export singleton: export const transcriptCache = new TranscriptCacheService()');
    console.log('   - Use in API route: import { transcriptCache } from "@/lib/transcript/cache"');
    console.log('   - Remove client-side TranscriptCacheManager or make it call API endpoints');

    console.log('\n2. ADD MISSING FEATURES to transcript cache:');
    console.log('   - Automatic access stats update on read');
    console.log('   - Batch check for multiple videos');
    console.log('   - Search functionality');
    console.log('   - Storage size tracking');
    console.log('   - Clear with filters (by age, pattern, etc)');

    console.log('\n3. IMPROVE ERROR HANDLING:');
    console.log('   - Consistent try-catch blocks');
    console.log('   - Proper error logging');
    console.log('   - Return null/false instead of throwing for cache misses');

    console.log('\n4. CURRENT ISSUE:');
    console.log('   - Transcript cache is empty because AI processing fails (no OpenAI key)');
    console.log('   - Code only caches AI-processed transcripts (per user requirement)');
    console.log('   - TTS cache works because it doesn\'t depend on AI processing');

    console.log('\n✅ Analysis complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testBothCaches();