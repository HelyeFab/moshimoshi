/**
 * Test anki21b file structure - improved version
 */

const fs = require('fs');
const JSZip = require('jszip');

async function testStructure() {
  console.log('=== Testing anki21b File Structure (v2) ===\n');

  const filePath = '/home/beano/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg';

  try {
    const fileBuffer = fs.readFileSync(filePath);
    console.log('✅ File read:', (fileBuffer.length / 1024 / 1024).toFixed(2), 'MB\n');

    const zip = await JSZip.loadAsync(fileBuffer);

    // Count files
    const allFiles = Object.keys(zip.files);
    console.log('📦 Total files in archive:', allFiles.length);
    console.log('');

    // Look for special files (collection, media, etc.)
    const specialFiles = allFiles.filter(name =>
      !(/^\d+$/.test(name)) // Not a pure number
    );

    console.log('📋 Special files (non-numeric):');
    specialFiles.forEach(name => {
      const file = zip.files[name];
      console.log('  -', name, `(${(file._data?.compressedSize || 0)} bytes)`);
    });
    console.log('');

    // Count numeric files (media)
    const mediaFiles = allFiles.filter(name => /^\d+$/.test(name));
    console.log('🖼️  Media files (numeric names):', mediaFiles.length);
    console.log('');

    // Check for collection files
    const hasAnki2 = !!zip.files['collection.anki2'];
    const hasAnki21 = !!zip.files['collection.anki21'];
    const hasAnki21b = !!zip.files['collection.anki21b'];

    console.log('🔍 Looking for collection files:');
    console.log('  - collection.anki2:', hasAnki2 ? '✅' : '❌');
    console.log('  - collection.anki21:', hasAnki21 ? '✅' : '❌');
    console.log('  - collection.anki21b:', hasAnki21b ? '✅' : '❌');
    console.log('');

    // Try to find collection file by checking file contents
    let collectionFile = null;
    let collectionName = null;

    for (const [name, file] of Object.entries(zip.files)) {
      if (name.startsWith('collection')) {
        collectionFile = file;
        collectionName = name;
        break;
      }
    }

    if (collectionFile) {
      console.log('📄 Found collection file:', collectionName);

      const collectionData = await collectionFile.async('uint8array');
      console.log('📊 Size:', (collectionData.length / 1024).toFixed(2), 'KB');
      console.log('');

      // Check header
      const header = new TextDecoder().decode(collectionData.slice(0, 16));
      console.log('🔍 Header analysis:');
      console.log('  Raw bytes:', Array.from(collectionData.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('  As text:', JSON.stringify(header));
      console.log('');

      // Check compression
      const isZstd = collectionData[0] === 0x28 && collectionData[1] === 0xB5 &&
                     collectionData[2] === 0x2F && collectionData[3] === 0xFD;
      const isSQLite = header.startsWith('SQLite format 3');

      console.log('📋 Format detection:');
      console.log('  - zstd compressed:', isZstd ? '✅' : '❌');
      console.log('  - SQLite direct:', isSQLite ? '✅' : '❌');
      console.log('');

      if (isZstd) {
        console.log('✅ File uses zstd compression');
        console.log('💡 Our parser already supports this!');
        console.log('💡 After zstd decompression, we should get a SQLite database');
      } else if (isSQLite) {
        console.log('✅ File is direct SQLite (uncompressed)');
        console.log('💡 Our parser can handle this too!');
      } else {
        console.log('⚠️  Unknown format - may need protobuf support');
      }
      console.log('');
    }

    // Check for media mapping file
    if (zip.files['media']) {
      console.log('📁 Found media mapping file');
      const mediaData = await zip.files['media'].async('string');
      console.log('📊 Media mapping size:', mediaData.length, 'bytes');
      console.log('📝 Media mapping preview:', mediaData.substring(0, 200));
      console.log('');
    }

    console.log('🎉 File structure analysis complete!');
    console.log('');
    console.log('📌 Summary:');
    console.log('  - This is a standard Anki .apkg file');
    console.log('  - Collection file:', collectionName || 'NOT FOUND');
    console.log('  - Media files:', mediaFiles.length);
    console.log('  - Our parser should be able to handle this!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testStructure();
