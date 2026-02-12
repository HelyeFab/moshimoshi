/**
 * Download all comic images from Firebase Storage
 *
 * Downloads:
 *   - Panel images from each comic episode (from Firestore imageUrl fields)
 *   - Any comic-related files from Firebase Storage bucket
 *
 * Output structure:
 *   ./comic-images-download/
 *     ├── panels/
 *     │   ├── moshi-goes-to-japan-ep001/
 *     │   │   ├── panel-01.webp
 *     │   │   ├── panel-02.webp
 *     │   │   └── ...
 *     │   └── .../
 *     └── storage/
 *         └── (files from Firebase Storage comics/ prefix)
 *
 * Usage:
 *   node scripts/download-comic-images.js
 *   node scripts/download-comic-images.js --output ./my-folder
 *   node scripts/download-comic-images.js --panels-only    # Skip storage bucket download
 *   node scripts/download-comic-images.js --storage-only   # Skip Firestore panel URLs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse args
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : path.join(__dirname, '..', 'comic-images-download');
const panelsOnly = args.includes('--panels-only');
const storageOnly = args.includes('--storage-only');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    proto.get(url, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadUrl(response.headers.location, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

function getExtFromUrl(url) {
  try {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath);
    return ext || '.webp';
  } catch {
    return '.webp';
  }
}

async function downloadPanelImages() {
  console.log('\n=== Downloading Panel Images from Firestore ===\n');

  const snapshot = await db.collection('comics').get();
  console.log(`Found ${snapshot.size} comics in Firestore\n`);

  if (snapshot.empty) {
    console.log('No comics found.');
    return { total: 0, downloaded: 0, failed: 0 };
  }

  const panelsDir = path.join(outputDir, 'panels');
  ensureDir(panelsDir);

  let totalImages = 0;
  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  // Sort comics by episode id for consistent ordering
  const comics = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const comic of comics) {
    const episodeDir = path.join(panelsDir, comic.id);
    ensureDir(episodeDir);

    console.log(`\n📖 ${comic.id} - "${comic.title || 'Untitled'}"`);

    // Download cover image if exists
    if (comic.coverImageUrl) {
      totalImages++;
      const ext = getExtFromUrl(comic.coverImageUrl);
      const coverPath = path.join(episodeDir, `cover${ext}`);

      if (fs.existsSync(coverPath)) {
        console.log(`  ⏩ cover (already exists)`);
        skipped++;
      } else {
        try {
          await downloadUrl(comic.coverImageUrl, coverPath);
          const size = (fs.statSync(coverPath).size / 1024).toFixed(1);
          console.log(`  ✅ cover (${size} KB)`);
          downloaded++;
        } catch (err) {
          console.log(`  ❌ cover - ${err.message}`);
          failed++;
        }
      }
    }

    // Download panel images
    if (comic.panels && comic.panels.length > 0) {
      for (let i = 0; i < comic.panels.length; i++) {
        const panel = comic.panels[i];
        const imageUrl = panel.imageUrl || panel.image;

        if (!imageUrl) {
          console.log(`  ⚠️  panel-${String(i + 1).padStart(2, '0')} - no image URL`);
          continue;
        }

        totalImages++;
        const ext = getExtFromUrl(imageUrl);
        const panelPath = path.join(episodeDir, `panel-${String(i + 1).padStart(2, '0')}${ext}`);

        if (fs.existsSync(panelPath)) {
          console.log(`  ⏩ panel-${String(i + 1).padStart(2, '0')} (already exists)`);
          skipped++;
          continue;
        }

        try {
          await downloadUrl(imageUrl, panelPath);
          const size = (fs.statSync(panelPath).size / 1024).toFixed(1);
          console.log(`  ✅ panel-${String(i + 1).padStart(2, '0')} (${size} KB)`);
          downloaded++;
        } catch (err) {
          console.log(`  ❌ panel-${String(i + 1).padStart(2, '0')} - ${err.message}`);
          failed++;
        }
      }
    } else {
      console.log(`  ⚠️  No panels array`);
    }
  }

  console.log(`\n--- Panel Download Summary ---`);
  console.log(`  Total images: ${totalImages}`);
  console.log(`  Downloaded:   ${downloaded}`);
  console.log(`  Skipped:      ${skipped} (already exist)`);
  console.log(`  Failed:       ${failed}`);

  return { total: totalImages, downloaded, failed, skipped };
}

async function downloadStorageBucketImages() {
  console.log('\n=== Downloading Comic Files from Storage Bucket ===\n');

  const storageDir = path.join(outputDir, 'storage');
  ensureDir(storageDir);

  // List all files with comics-related prefixes
  const prefixes = ['comics/', 'comic-panels/', 'comic-images/', 'comic_'];
  let allFiles = [];

  for (const prefix of prefixes) {
    try {
      const [files] = await bucket.getFiles({ prefix });
      if (files.length > 0) {
        console.log(`Found ${files.length} files under "${prefix}"`);
        allFiles = allFiles.concat(files);
      }
    } catch (err) {
      // prefix doesn't exist, skip
    }
  }

  // Also check root-level files that might be comic images
  try {
    const [rootFiles] = await bucket.getFiles();
    const comicRootFiles = rootFiles.filter(f => {
      const name = f.name.toLowerCase();
      return name.includes('comic') || name.includes('panel') || name.includes('moshi-goes');
    });
    if (comicRootFiles.length > 0) {
      console.log(`Found ${comicRootFiles.length} comic-related files at root level`);
      allFiles = allFiles.concat(comicRootFiles);
    }
  } catch (err) {
    console.log(`Warning: Could not list root files - ${err.message}`);
  }

  // Deduplicate by file name
  const seen = new Set();
  allFiles = allFiles.filter(f => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });

  console.log(`\nTotal unique comic files in storage: ${allFiles.length}\n`);

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of allFiles) {
    // Skip directories (files ending with /)
    if (file.name.endsWith('/')) continue;

    const destPath = path.join(storageDir, file.name);
    ensureDir(path.dirname(destPath));

    if (fs.existsSync(destPath)) {
      skipped++;
      continue;
    }

    try {
      await file.download({ destination: destPath });
      const size = (fs.statSync(destPath).size / 1024).toFixed(1);
      console.log(`  ✅ ${file.name} (${size} KB)`);
      downloaded++;
    } catch (err) {
      console.log(`  ❌ ${file.name} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n--- Storage Download Summary ---`);
  console.log(`  Total files:  ${allFiles.length}`);
  console.log(`  Downloaded:   ${downloaded}`);
  console.log(`  Skipped:      ${skipped} (already exist)`);
  console.log(`  Failed:       ${failed}`);

  return { total: allFiles.length, downloaded, failed, skipped };
}

async function main() {
  console.log('🖼️  Comic Image Downloader');
  console.log(`Output directory: ${outputDir}`);
  ensureDir(outputDir);

  const results = {};

  if (!storageOnly) {
    results.panels = await downloadPanelImages();
  }

  if (!panelsOnly) {
    results.storage = await downloadStorageBucketImages();
  }

  console.log('\n========================================');
  console.log('         DOWNLOAD COMPLETE');
  console.log('========================================');
  console.log(`Output: ${outputDir}`);

  if (results.panels) {
    console.log(`\nPanels (from Firestore URLs):`);
    console.log(`  ${results.panels.downloaded} downloaded, ${results.panels.skipped || 0} skipped, ${results.panels.failed} failed`);
  }
  if (results.storage) {
    console.log(`\nStorage bucket files:`);
    console.log(`  ${results.storage.downloaded} downloaded, ${results.storage.skipped || 0} skipped, ${results.storage.failed} failed`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
