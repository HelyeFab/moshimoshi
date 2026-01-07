/**
 * Simple test to check anki21b file structure
 */

const fs = require('fs');
const JSZip = require('jszip');

async function testStructure() {
  console.log('=== Testing anki21b File Structure ===\n');

  const filePath = '/home/beano/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg';

  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    console.log('✅ File read:', (fileBuffer.length / 1024 / 1024).toFixed(2), 'MB\n');

    // Unzip
    const zip = await JSZip.loadAsync(fileBuffer);
    console.log('✅ ZIP loaded successfully\n');

    // List files
    console.log('📦 Files in archive:');
    Object.keys(zip.files).forEach(name => {
      console.log('  -', name);
    });
    console.log('');

    // Check for collection files
    const hasAnki2 = !!zip.files['collection.anki2'];
    const hasAnki21 = !!zip.files['collection.anki21'];
    const hasAnki21b = !!zip.files['collection.anki21b'];

    console.log('📋 Collection format:');
    console.log('  - collection.anki2:', hasAnki2 ? '✅' : '❌');
    console.log('  - collection.anki21:', hasAnki21 ? '✅' : '❌');
    console.log('  - collection.anki21b:', hasAnki21b ? '✅' : '❌');
    console.log('');

    // Check the actual collection file
    let collectionFile = null;
    let formatType = null;

    if (hasAnki21b) {
      collectionFile = zip.files['collection.anki21b'];
      formatType = 'anki21b';
    } else if (hasAnki21) {
      collectionFile = zip.files['collection.anki21'];
      formatType = 'anki21';
    } else if (hasAnki2) {
      collectionFile = zip.files['collection.anki2'];
      formatType = 'anki2';
    }

    if (collectionFile) {
      console.log('📄 Collection file found:', formatType);

      // Get file data
      const collectionData = await collectionFile.async('uint8array');
      console.log('📊 Collection size:', (collectionData.length / 1024).toFixed(2), 'KB');
      console.log('');

      // Check first bytes to identify compression
      const header = new TextDecoder().decode(collectionData.slice(0, 16));
      console.log('🔍 File header (first 16 bytes):');
      console.log('  Raw:', Array.from(collectionData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('  As text:', JSON.stringify(header));
      console.log('');

      // Check if it's zstd compressed (starts with 0x28 0xB5 0x2F 0xFD)
      const isZstd = collectionData[0] === 0x28 && collectionData[1] === 0xB5 &&
                     collectionData[2] === 0x2F && collectionData[3] === 0xFD;
      console.log('🗜️  Compression: ', isZstd ? 'zstd (modern)' : 'none (legacy or SQLite)');
      console.log('');

      if (isZstd) {
        console.log('✅ File uses zstd compression (same as anki21)');
        console.log('✅ Our parser already supports zstd decompression');
        console.log('');
        console.log('💡 Next step: Decompress and check if resulting SQLite is valid');
      }
    }

    console.log('\n🎉 File structure analysis complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testStructure();
