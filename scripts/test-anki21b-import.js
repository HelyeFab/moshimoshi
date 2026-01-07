/**
 * Test script for anki21b import
 * Tests parsing of Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg
 */

const fs = require('fs');
const path = require('path');

async function testAnki21bImport() {
  console.log('=== Testing anki21b Import ===\n');

  const filePath = '/home/beano/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg';

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    process.exit(1);
  }

  const stats = fs.statSync(filePath);
  console.log('📁 File:', path.basename(filePath));
  console.log('📊 Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('');

  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    console.log('✅ File read successfully');
    console.log('📦 Buffer size:', fileBuffer.length, 'bytes');
    console.log('');

    // Import the parser (needs to be dynamic since it's TypeScript)
    // We'll use the built version if available, or compile on the fly
    const { execSync } = require('child_process');

    console.log('🔧 Compiling TypeScript parser...');

    // Create a temporary test file that imports and uses the parser
    const testCode = `
import { AnkiParser } from '../src/lib/anki/parser';

const fs = require('fs');

async function test() {
  try {
    const fileBuffer = fs.readFileSync('${filePath}');
    console.log('\\n🔍 Attempting to parse anki21b file...');
    console.log('');

    const result = await AnkiParser.parseApkg(fileBuffer);

    console.log('\\n✅ SUCCESS! File parsed successfully!');
    console.log('');
    console.log('📊 Parse Results:');
    console.log('  - Deck name:', result.deckName);
    console.log('  - Total cards:', result.cards?.length || 0);
    console.log('  - Has media:', result.media ? Object.keys(result.media).length : 0, 'files');
    console.log('');

    if (result.cards && result.cards.length > 0) {
      console.log('📇 Sample card (first card):');
      const firstCard = result.cards[0];
      console.log('  - Front:', firstCard.front?.substring(0, 100) || 'N/A');
      console.log('  - Back:', firstCard.back?.substring(0, 100) || 'N/A');
      console.log('');
    }

    console.log('🎉 anki21b format is now supported!');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\\n❌ FAILED to parse file');
    console.error('');
    console.error('Error:', error.message);
    console.error('');

    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

test();
`;

    // Write temporary test file
    const tmpTestFile = path.join(__dirname, 'tmp-anki21b-test.ts');
    fs.writeFileSync(tmpTestFile, testCode);

    console.log('✅ Test file created');
    console.log('🚀 Running parser...');
    console.log('');

    // Run with ts-node
    execSync(`npx ts-node ${tmpTestFile}`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Cleanup
    fs.unlinkSync(tmpTestFile);

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);

    if (error.stdout) {
      console.log('\nStdout:', error.stdout.toString());
    }
    if (error.stderr) {
      console.error('\nStderr:', error.stderr.toString());
    }

    process.exit(1);
  }
}

testAnki21bImport();
