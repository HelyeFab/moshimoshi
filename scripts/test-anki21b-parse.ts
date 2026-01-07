/**
 * Test script for anki21b import - Direct parser test
 */

import { AnkiParser } from '../src/lib/anki/parser';
import * as fs from 'fs';

async function testAnki21bParse() {
  console.log('=== Testing anki21b Parse ===\n');

  const filePath = '/home/beano/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg';

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    process.exit(1);
  }

  const stats = fs.statSync(filePath);
  console.log('📁 File: Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg');
  console.log('📊 Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('');

  try {
    // Read the file as Buffer
    const fileBuffer = fs.readFileSync(filePath);
    console.log('✅ File read successfully');
    console.log('📦 Buffer size:', fileBuffer.length, 'bytes');
    console.log('');

    console.log('🔍 Attempting to parse anki21b file...');
    console.log('');

    // Use the internal parseInMemory method directly
    const deck = await (AnkiParser as any).parseInMemory(fileBuffer);

    console.log('✅ SUCCESS! File parsed successfully!');
    console.log('');
    console.log('📊 Parse Results:');
    console.log('  - Deck name:', deck.meta?.name || 'N/A');
    console.log('  - Total notes:', deck.notes?.length || 0);
    console.log('  - Media files:', deck.mediaFiles?.length || 0);
    console.log('');

    if (deck.notes && deck.notes.length > 0) {
      console.log('📇 Sample note (first note):');
      const firstNote = deck.notes[0];
      console.log('  - ID:', firstNote.id);
      console.log('  - Fields count:', firstNote.fields?.length || 0);
      console.log('  - Tags:', firstNote.tags?.join(', ') || 'none');
      console.log('');

      if (firstNote.fields && firstNote.fields.length > 0) {
        console.log('  Field samples:');
        firstNote.fields.slice(0, 3).forEach((field: string, i: number) => {
          const preview = field.substring(0, 80).replace(/\n/g, ' ');
          console.log(`    [${i}]:`, preview + (field.length > 80 ? '...' : ''));
        });
        console.log('');
      }
    }

    console.log('🎉 anki21b format is now supported!');
    console.log('✨ The simple fix worked - no protobuf parsing needed!');
    console.log('');

    process.exit(0);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ FAILED to parse file');
    console.error('');
    console.error('Error:', error.message);
    console.error('');

    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
      console.error('');
    }

    console.log('ℹ️  This means we need to implement protobuf parsing for this file.');
    console.log('');

    process.exit(1);
  }
}

testAnki21bParse();
