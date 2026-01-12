"use strict";
/**
 * Backfill Word Explanations for Existing Books
 *
 * Generates comprehensive word explanations for published books
 * that don't already have them in the book_word_explanations collection.
 *
 * Usage:
 *   npm run backfill:books -- --dry-run        # Preview what will be done
 *   npm run backfill:books                     # Actually generate word explanations
 *   npm run backfill:books -- --book book_123  # Backfill specific book only
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const module_1 = __importDefault(require("module"));
// Ensure @/* path aliases resolve when running compiled JS from functions/
const nodeModule = module_1.default;
const originalResolve = nodeModule._resolveFilename;
nodeModule._resolveFilename = function (request, parent, isMain, options) {
    if (typeof request === 'string' && request.startsWith('@/')) {
        const repoRoot = path_1.default.resolve(process.cwd(), '..');
        const compiledPath = path_1.default.join(repoRoot, 'functions', 'lib', 'src', request.slice(2));
        const sourcePath = path_1.default.join(repoRoot, 'src', request.slice(2));
        const target = fs_1.default.existsSync(`${compiledPath}.js`) ? compiledPath : sourcePath;
        return originalResolve.call(this, target, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
};
// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(serviceAccountPath);
        process.env.FIREBASE_ADMIN_PROJECT_ID =
            process.env.FIREBASE_ADMIN_PROJECT_ID || serviceAccount.project_id;
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL =
            process.env.FIREBASE_ADMIN_CLIENT_EMAIL || serviceAccount.client_email;
        process.env.FIREBASE_ADMIN_PRIVATE_KEY =
            process.env.FIREBASE_ADMIN_PRIVATE_KEY || serviceAccount.private_key;
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
    else {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const serviceAccount = require('../../../moshimoshi-service-account.json');
            process.env.FIREBASE_ADMIN_PROJECT_ID =
                process.env.FIREBASE_ADMIN_PROJECT_ID || serviceAccount.project_id;
            process.env.FIREBASE_ADMIN_CLIENT_EMAIL =
                process.env.FIREBASE_ADMIN_CLIENT_EMAIL || serviceAccount.client_email;
            process.env.FIREBASE_ADMIN_PRIVATE_KEY =
                process.env.FIREBASE_ADMIN_PRIVATE_KEY || serviceAccount.private_key;
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
        catch (error) {
            const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ||
                process.env.GOOGLE_CLOUD_PROJECT ||
                process.env.GCLOUD_PROJECT;
            console.warn('[BackfillBooks] No service account file found, falling back to application default credentials');
            admin.initializeApp(Object.assign({ credential: admin.credential.applicationDefault() }, (projectId ? { projectId } : {})));
        }
    }
}
const db = admin.firestore();
// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const bookArgIndex = args.indexOf('--book');
const specificBookId = bookArgIndex !== -1 ? args[bookArgIndex + 1] : null;
const minCountArgIndex = args.indexOf('--min-count');
const minCount = minCountArgIndex !== -1 ? parseInt(args[minCountArgIndex + 1], 10) : null;
async function checkWordExplanationsExist(bookId) {
    var _a;
    const wordDoc = await db.collection('book_word_explanations').doc(bookId).get();
    if (!wordDoc.exists)
        return false;
    if (minCount === null || Number.isNaN(minCount))
        return true;
    const wordCount = (_a = wordDoc.data()) === null || _a === void 0 ? void 0 : _a.wordCount;
    if (typeof wordCount !== 'number')
        return false;
    return wordCount >= minCount;
}
function getBookSortDate(book) {
    var _a, _b, _c, _d;
    const publishedAt = (_b = (_a = book.publishedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a).getTime();
    if (publishedAt)
        return publishedAt;
    const createdAt = (_d = (_c = book.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c).getTime();
    return createdAt || 0;
}
async function generateWordExplanationsForBook(bookId, book) {
    const title = book.title || bookId;
    console.log(`\n📚 Book ${bookId}: ${title}`);
    // Check if already exists
    const alreadyExists = await checkWordExplanationsExist(bookId);
    if (alreadyExists) {
        console.log('  ✓ Word explanations already exist - SKIPPING');
        return { skipped: true, bookId, title };
    }
    const content = book.content || '';
    if (!content || content.trim().length === 0) {
        console.log('  ⚠️  No content found in book - SKIPPING');
        return { skipped: true, bookId, title, reason: 'no content' };
    }
    const textPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
    console.log(`  Text extracted: ${textPreview}`);
    console.log(`  Total text length: ${content.length} characters`);
    console.log(`  JLPT Level: ${book.jlptLevel || 'N5'}`);
    if (isDryRun) {
        console.log('  [DRY RUN] Would generate word explanations');
        return { dryRun: true, bookId, title, textLength: content.length };
    }
    try {
        console.log('  🔄 Generating word explanations...');
        const { precomputeWordExplanations } = await Promise.resolve().then(() => __importStar(require('../../../src/lib/ai/precompute/wordPrecompute')));
        const result = await precomputeWordExplanations({
            contentId: bookId,
            contentType: 'book',
            text: content,
            limit: 1000,
            jlptLevel: (book.jlptLevel || 'N5'),
        });
        console.log(`  ✅ SUCCESS! Generated ${result.total} word explanations`);
        console.log(`     - New: ${result.generated}`);
        console.log(`     - Cached: ${result.cached}`);
        return {
            success: true,
            bookId,
            title,
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
            bookId,
            title,
            error: errorMessage,
        };
    }
}
async function backfillBookWordExplanations() {
    console.log('\n🚀 Book Word Explanations Backfill Script\n');
    console.log('Mode:', isDryRun ? '🔍 DRY RUN (preview only)' : '✍️  LIVE (will generate explanations)');
    if (specificBookId) {
        console.log(`Target: Book ${specificBookId} only\n`);
    }
    else {
        console.log('Target: All published books\n');
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
    if (specificBookId) {
        const bookDoc = await db.collection('books').doc(specificBookId).get();
        if (!bookDoc.exists) {
            console.log(`\n❌ Book not found: ${specificBookId}`);
            process.exit(1);
        }
        const book = bookDoc.data();
        const result = await generateWordExplanationsForBook(bookDoc.id, book);
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
        const booksSnapshot = await db.collection('books').get();
        if (booksSnapshot.empty) {
            console.log('\n❌ No books found');
            process.exit(0);
        }
        const books = booksSnapshot.docs
            .map(doc => ({ id: doc.id, data: doc.data() }))
            .filter(({ data }) => data.status === 'published')
            .sort((a, b) => getBookSortDate(a.data) - getBookSortDate(b.data));
        if (books.length === 0) {
            console.log('\n❌ No published books found');
            process.exit(0);
        }
        console.log(`\nFound ${books.length} published book(s)\n`);
        for (const book of books) {
            results.total++;
            const result = await generateWordExplanationsForBook(book.id, book.data);
            results.details.push(result);
            if (result.skipped)
                results.skipped++;
            else if (result.dryRun)
                results.dryRun++;
            else if (result.success)
                results.success++;
            else if (result.failed)
                results.failed++;
            // Small delay between books to avoid rate limits
            if (!isDryRun && !result.skipped) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    console.log('\n' + '─'.repeat(60));
    console.log('\n📊 BACKFILL SUMMARY\n');
    console.log(`Total books processed: ${results.total}`);
    console.log(`  ✓ Skipped (already exists): ${results.skipped}`);
    if (isDryRun) {
        console.log(`  🔍 Would generate: ${results.dryRun}`);
    }
    else {
        console.log(`  ✅ Successfully generated: ${results.success}`);
        console.log(`  ❌ Failed: ${results.failed}`);
    }
    if (results.failed > 0) {
        console.log('\n❌ Failed books:');
        results.details
            .filter(r => r.failed)
            .forEach(r => {
            console.log(`  - ${r.bookId} (${r.title || 'Untitled'}): ${r.error}`);
        });
    }
    console.log('\n✨ Book word explanations backfill complete!');
}
backfillBookWordExplanations().catch(error => {
    console.error('\n❌ Backfill script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=backfillBookWordExplanations.js.map