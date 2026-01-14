"use strict";
/**
 * Backfill Word Explanations for Existing Comic Episodes
 *
 * Generates comprehensive word explanations for all published comic episodes
 * that don't already have them in the word_explanations collection.
 *
 * Usage:
 *   npm run backfill:comics -- --dry-run      # Preview what will be done
 *   npm run backfill:comics                   # Actually generate word explanations
 *   npm run backfill:comics -- --episode 13   # Backfill specific episode only
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const wordPrecompute_1 = require("../../../src/lib/ai/precompute/wordPrecompute");
// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = require('../../../moshimoshi-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
const db = admin.firestore();
// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const specificEpisodeArg = args.find(arg => arg === '--episode');
const specificEpisode = specificEpisodeArg
    ? parseInt(args[args.indexOf('--episode') + 1])
    : null;
function extractComicText(comicData) {
    if (!comicData.panels || !Array.isArray(comicData.panels)) {
        return '';
    }
    const text = comicData.panels
        .map(panel => {
        var _a, _b;
        const dialogueText = ((_a = panel.dialogues) === null || _a === void 0 ? void 0 : _a.map(d => d.textJa || '').join(' ')) || '';
        const narrationText = ((_b = panel.narration) === null || _b === void 0 ? void 0 : _b.textJa) || '';
        return `${dialogueText} ${narrationText}`.trim();
    })
        .filter(text => text.length > 0)
        .join('\n');
    return text;
}
async function checkWordExplanationsExist(episodeId) {
    const wordDoc = await db.collection('comic_word_explanations').doc(episodeId).get();
    return wordDoc.exists;
}
async function markEpisodeWordExplanationsComplete(episodeId, wordCount) {
    await db.collection('comics').doc(episodeId).update({
        wordExplanationsStatus: 'complete',
        wordExplanationsCount: wordCount,
        wordExplanationsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        wordExplanationsFailedAt: admin.firestore.FieldValue.delete(),
        wordExplanationsError: admin.firestore.FieldValue.delete(),
    });
}
async function generateWordExplanationsForEpisode(comic, episodeNumber) {
    const episodeId = `moshi-goes-to-japan-ep${String(episodeNumber).padStart(3, '0')}`;
    console.log(`\n📝 Episode ${episodeNumber}: ${comic.title}`);
    // Check if already exists
    const alreadyExists = await checkWordExplanationsExist(episodeId);
    if (alreadyExists) {
        console.log('  ✓ Word explanations already exist - SKIPPING');
        return { skipped: true, episodeNumber };
    }
    // Extract text from comic
    const comicText = extractComicText(comic);
    if (!comicText || comicText.trim().length === 0) {
        console.log('  ⚠️  No text found in comic panels - SKIPPING');
        return { skipped: true, episodeNumber, reason: 'no text' };
    }
    const textPreview = comicText.substring(0, 100) + (comicText.length > 100 ? '...' : '');
    console.log(`  Text extracted: ${textPreview}`);
    console.log(`  Total text length: ${comicText.length} characters`);
    console.log(`  JLPT Level: ${comic.jlptLevel || 'N5'}`);
    if (isDryRun) {
        console.log('  [DRY RUN] Would generate word explanations');
        return { dryRun: true, episodeNumber, textLength: comicText.length };
    }
    // Generate word explanations
    try {
        console.log('  🔄 Generating word explanations...');
        const result = await (0, wordPrecompute_1.precomputeWordExplanations)({
            contentId: episodeId,
            contentType: 'comic',
            text: comicText,
            limit: 1000,
            jlptLevel: (comic.jlptLevel || 'N5'),
        });
        console.log(`  ✅ SUCCESS! Generated ${result.total} word explanations`);
        console.log(`     - New: ${result.generated}`);
        console.log(`     - Cached: ${result.cached}`);
        await markEpisodeWordExplanationsComplete(episodeId, result.total);
        return {
            success: true,
            episodeNumber,
            total: result.total,
            generated: result.generated,
            cached: result.cached,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ FAILED: ${errorMessage}`);
        return {
            failed: true,
            episodeNumber,
            error: errorMessage,
        };
    }
}
async function backfillComicWordExplanations() {
    console.log('\n🚀 Comic Word Explanations Backfill Script\n');
    console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate explanations)');
    if (specificEpisode) {
        console.log(`Target: Episode ${specificEpisode} only\n`);
    }
    else {
        console.log('Target: All published episodes\n');
    }
    console.log('─'.repeat(60));
    // Fetch all published comic episodes
    let query = db.collection('comics').orderBy('episodeNumber', 'asc');
    if (specificEpisode) {
        query = query.where('episodeNumber', '==', specificEpisode);
    }
    const comicsSnapshot = await query.get();
    if (comicsSnapshot.empty) {
        console.log('\n❌ No comic episodes found');
        process.exit(0);
    }
    console.log(`\nFound ${comicsSnapshot.size} comic episode(s)\n`);
    const results = {
        total: 0,
        skipped: 0,
        dryRun: 0,
        success: 0,
        failed: 0,
        details: [],
    };
    // Process each episode
    for (const doc of comicsSnapshot.docs) {
        results.total++;
        const comic = doc.data();
        const episodeNumber = comic.episodeNumber;
        const result = await generateWordExplanationsForEpisode(comic, episodeNumber);
        results.details.push(result);
        if (result.skipped)
            results.skipped++;
        else if (result.dryRun)
            results.dryRun++;
        else if (result.success)
            results.success++;
        else if (result.failed)
            results.failed++;
        // Small delay between episodes to avoid rate limits
        if (!isDryRun && !result.skipped) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    // Print summary
    console.log('\n' + '─'.repeat(60));
    console.log('\n📊 BACKFILL SUMMARY\n');
    console.log(`Total episodes processed: ${results.total}`);
    console.log(`  ✓ Skipped (already exists): ${results.skipped}`);
    if (isDryRun) {
        console.log(`  🔍 Would generate: ${results.dryRun}`);
    }
    else {
        console.log(`  ✅ Successfully generated: ${results.success}`);
        console.log(`  ❌ Failed: ${results.failed}`);
    }
    if (results.failed > 0) {
        console.log('\n❌ Failed episodes:');
        results.details
            .filter(r => r.failed)
            .forEach(r => {
            console.log(`  - Episode ${r.episodeNumber}: ${r.error}`);
        });
    }
    if (isDryRun && results.dryRun > 0) {
        console.log('\n💡 To actually generate word explanations, run without --dry-run flag:');
        console.log('   npm run backfill:comics');
    }
    else if (results.success > 0) {
        console.log('\n✨ Word explanations successfully backfilled!');
        console.log('\nYou can verify by checking the word_explanations collection in Firestore.');
    }
    console.log('\n');
    process.exit(0);
}
// Run the backfill
backfillComicWordExplanations().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=backfillComicWordExplanations.js.map