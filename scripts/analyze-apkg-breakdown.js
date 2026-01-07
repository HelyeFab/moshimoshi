/**
 * Analyze what makes up the 22MB .apkg file
 */

const fs = require('fs');
const JSZip = require('jszip');

async function analyzeApkg() {
  console.log('=== Analyzing .apkg File Breakdown ===\n');

  const filePath = '/home/beano/Downloads/Japanese_Core_2000_Step_01_Listening_Sentence_Vocab__Images.apkg';

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const totalSize = fileBuffer.length;

    console.log('Total file size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('');

    const zip = await JSZip.loadAsync(fileBuffer);

    let collectionSize = 0;
    let mediaSize = 0;
    let mediaCount = 0;

    for (const [name, file] of Object.entries(zip.files)) {
      const data = await file.async('uint8array');
      const size = data.length;

      if (name.startsWith('collection')) {
        collectionSize += size;
        console.log(`Collection file (${name}):`, (size / 1024).toFixed(2), 'KB');
      } else if (name === 'media') {
        console.log('Media mapping file:', size, 'bytes');
      } else if (/^\d+$/.test(name)) {
        // Numbered media file
        mediaSize += size;
        mediaCount++;
      }
    }

    console.log('');
    console.log('BREAKDOWN:');
    console.log('  Collection (card text data):', (collectionSize / 1024).toFixed(2), 'KB');
    console.log('  Media files (audio/images):', (mediaSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('  Media file count:', mediaCount);
    console.log('');
    console.log('WHERE IT GOES WHEN IMPORTED:');
    console.log('  → Firestore: ~' + (collectionSize / 1024).toFixed(2), 'KB (card TEXT only)');
    console.log('  → Firebase Storage: ~' + (mediaSize / 1024 / 1024).toFixed(2), 'MB (audio/images)');
    console.log('');
    console.log('This is why Firebase shows 465 KB - it only stores the TEXT!');
    console.log('The media files (' + (mediaSize / 1024 / 1024).toFixed(2), 'MB) go to Firebase Storage separately.');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

analyzeApkg();
