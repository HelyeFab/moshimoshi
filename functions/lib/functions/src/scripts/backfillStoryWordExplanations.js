"use strict";
/**
 * Backfill Word Explanations for Existing Stories
 *
 * Generates comprehensive word explanations for published stories
 * that don't already have them in the story_word_explanations collection.
 *
 * Usage:
 *   npm run backfill:stories -- --dry-run         # Preview what will be done
 *   npm run backfill:stories                      # Actually generate word explanations
 *   npm run backfill:stories -- --story story_123 # Backfill a specific story
 *   npm run backfill:stories -- --force           # Regenerate even if doc exists
 *   npm run backfill:stories -- --start-after story_123 # Resume after a story id
 *   npm run backfill:stories -- --limit 5         # Process only N stories
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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
// Load local env for scripts (project id + keys)
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: '.env.local' });
if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
    (_a = process.env).GCLOUD_PROJECT || (_a.GCLOUD_PROJECT = process.env.FIREBASE_ADMIN_PROJECT_ID);
    (_b = process.env).GOOGLE_CLOUD_PROJECT || (_b.GOOGLE_CLOUD_PROJECT = process.env.FIREBASE_ADMIN_PROJECT_ID);
}
// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
    else {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const serviceAccount = require('../../../moshimoshi-service-account.json');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
        catch (error) {
            const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ||
                process.env.GOOGLE_CLOUD_PROJECT ||
                process.env.GCLOUD_PROJECT;
            console.warn('[BackfillStories] No service account file found, falling back to application default credentials');
            admin.initializeApp(Object.assign({ credential: admin.credential.applicationDefault() }, (projectId ? { projectId } : {})));
        }
    }
}
const db = admin.firestore();
// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const storyArgIndex = args.indexOf('--story');
const specificStoryId = storyArgIndex !== -1 ? args[storyArgIndex + 1] : null;
const startAfterIndex = args.indexOf('--start-after');
const startAfterStoryId = startAfterIndex !== -1 ? args[startAfterIndex + 1] : null;
const limitIndex = args.indexOf('--limit');
const limitCount = limitIndex !== -1 ? parseInt(args[limitIndex + 1] || '0', 10) : 2;
function extractStoryText(storyData) {
    if (!storyData.pages || !Array.isArray(storyData.pages)) {
        return '';
    }
    return storyData.pages
        .map(page => page.text || page.textJa || '')
        .filter(text => text.length > 0)
        .join('\n');
}
async function checkWordExplanationsExist(storyId) {
    const wordDoc = await db.collection('story_word_explanations').doc(storyId).get();
    return wordDoc.exists;
}
async function generateWordExplanationsForStory(storyId, story) {
    var _a;
    const title = story.title || storyId;
    console.log(`\n📘 Story ${storyId}: ${title}`);
    // Check if already exists
    const alreadyExists = await checkWordExplanationsExist(storyId);
    if (alreadyExists) {
        if (!isForce) {
            console.log('  ✓ Word explanations already exist - SKIPPING');
            return { skipped: true, storyId, title };
        }
        console.log('  ⚠️  Word explanations exist - FORCE REGENERATE');
        if (!isDryRun) {
            await db.collection('story_word_explanations').doc(storyId).delete();
        }
    }
    // Extract text from story pages
    const storyText = extractStoryText(story);
    if (!storyText || storyText.trim().length === 0) {
        console.log('  ⚠️  No text found in story pages - SKIPPING');
        return { skipped: true, storyId, title, reason: 'no text' };
    }
    const textPreview = storyText.substring(0, 100) + (storyText.length > 100 ? '...' : '');
    console.log(`  Text extracted: ${textPreview}`);
    console.log(`  Total text length: ${storyText.length} characters`);
    const jlptLevel = (story.jlptLevel || 'N4');
    const isBeginner = jlptLevel === 'N5' || jlptLevel === 'N4';
    const topWordLimitMap = {
        N3: 150,
        N2: 120,
        N1: 100,
    };
    const limit = isBeginner ? undefined : (_a = topWordLimitMap[jlptLevel]) !== null && _a !== void 0 ? _a : 100;
    console.log(`  JLPT Level: ${jlptLevel} (${isBeginner ? 'all filtered words' : `top ${limit}`})`);
    if (isDryRun) {
        console.log('  [DRY RUN] Would generate word explanations');
        return { dryRun: true, forced: alreadyExists && isForce, storyId, title, textLength: storyText.length };
    }
    // Generate word explanations
    try {
        console.log('  🔄 Generating word explanations...');
        const { generateStoryWordExplanations } = await Promise.resolve().then(() => __importStar(require('../utils/storyWordExplanationPreGenerator')));
        const result = await generateStoryWordExplanations(storyId, storyText, limit, isBeginner ? { includeParticles: true, minLength: 1 } : undefined);
        console.log(`  ✅ SUCCESS! Generated ${result.wordCount} word explanations`);
        await db.collection('stories').doc(storyId).update({
            wordExplanationsStatus: 'complete',
            wordExplanationsCount: result.wordCount,
            wordExplanationsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            wordExplanationsFailedAt: admin.firestore.FieldValue.delete(),
            wordExplanationsError: admin.firestore.FieldValue.delete(),
        });
        return {
            success: true,
            forced: alreadyExists && isForce,
            storyId,
            title,
            total: result.wordCount,
            generated: result.wordCount,
            cached: 0,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ FAILED: ${errorMessage}`);
        return {
            failed: true,
            storyId,
            title,
            error: errorMessage,
        };
    }
}
function getStorySortDate(story) {
    var _a, _b, _c, _d;
    const publishedAt = (_b = (_a = story.publishedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a).getTime();
    if (publishedAt)
        return publishedAt;
    const createdAt = (_d = (_c = story.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c).getTime();
    return createdAt || 0;
}
async function backfillStoryWordExplanations() {
    console.log('\n🚀 Story Word Explanations Backfill Script\n');
    console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate explanations)');
    console.log('Force:', isForce ? '✅ enabled' : '❌ disabled');
    if (specificStoryId) {
        console.log(`Target: Story ${specificStoryId} only\n`);
    }
    else {
        console.log('Target: All published stories\n');
    }
    console.log('─'.repeat(60));
    const results = {
        total: 0,
        skipped: 0,
        dryRun: 0,
        success: 0,
        failed: 0,
        details: [],
    };
    if (specificStoryId) {
        const storyDoc = await db.collection('stories').doc(specificStoryId).get();
        if (!storyDoc.exists) {
            console.log(`\n❌ Story not found: ${specificStoryId}`);
            process.exit(1);
        }
        const story = storyDoc.data();
        const result = await generateWordExplanationsForStory(storyDoc.id, story);
        results.details.push(result);
        results.total = 1;
        if (result.skipped)
            results.skipped++;
        else if (result.dryRun)
            results.dryRun++;
        else if (result.success)
            results.success++;
        else if (result.failed)
            results.failed++;
    }
    else {
        const storiesSnapshot = await db.collection('stories').get();
        if (storiesSnapshot.empty) {
            console.log('\n❌ No stories found');
            process.exit(0);
        }
        const stories = storiesSnapshot.docs
            .map(doc => ({ id: doc.id, data: doc.data() }))
            .filter(({ data }) => data.status === 'published')
            .sort((a, b) => getStorySortDate(a.data) - getStorySortDate(b.data));
        if (stories.length === 0) {
            console.log('\n❌ No published stories found');
            process.exit(0);
        }
        console.log(`\nFound ${stories.length} published story(ies)\n`);
        let skipping = !!startAfterStoryId;
        let processedCount = 0;
        for (const story of stories) {
            if (skipping) {
                if (story.id === startAfterStoryId) {
                    skipping = false;
                }
                continue;
            }
            if (limitCount > 0 && processedCount >= limitCount) {
                console.log(`\nReached limit (${limitCount}) - stopping early.`);
                break;
            }
            results.total++;
            const result = await generateWordExplanationsForStory(story.id, story.data);
            results.details.push(result);
            if (result.skipped)
                results.skipped++;
            else if (result.dryRun)
                results.dryRun++;
            else if (result.success)
                results.success++;
            else if (result.failed)
                results.failed++;
            processedCount++;
            // Small delay between stories to avoid rate limits
            if (!isDryRun && !result.skipped) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    // Print summary
    console.log('\n' + '─'.repeat(60));
    console.log('\n📊 BACKFILL SUMMARY\n');
    console.log(`Total stories processed: ${results.total}`);
    console.log(`  ✓ Skipped (already exists): ${results.skipped}`);
    if (isDryRun) {
        console.log(`  🔍 Would generate: ${results.dryRun}`);
    }
    else {
        console.log(`  ✅ Successfully generated: ${results.success}`);
        console.log(`  ❌ Failed: ${results.failed}`);
    }
    if (results.failed > 0) {
        console.log('\n❌ Failed stories:');
        results.details
            .filter(r => r.failed)
            .forEach(r => {
            console.log(`  - ${r.storyId} (${r.title || 'Untitled'}): ${r.error}`);
        });
    }
    console.log('\n✨ Story word explanations backfill complete!');
}
backfillStoryWordExplanations().catch(error => {
    console.error('\n❌ Backfill script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=backfillStoryWordExplanations.js.map