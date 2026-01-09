#!/usr/bin/env node

/**
 * Automated Translation Script using OpenAI API
 * Translates all missing keys for all locales to achieve 100% coverage
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BATCH_SIZE = 50; // Process 50 translations per API call
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay to avoid rate limits
const REVIEW_DIR = path.join(__dirname, 'translations-to-review');
const OUTPUT_DIR = path.join(__dirname, 'translated-output');

// Language names for better context
const LANGUAGE_NAMES = {
  ja: 'Japanese',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian'
};

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Call OpenAI API to translate a batch of strings
 */
async function translateBatch(texts, targetLanguage, context = '') {
  const languageName = LANGUAGE_NAMES[targetLanguage];

  const prompt = `You are a professional translator specializing in Japanese language learning applications.

Target Language: ${languageName}

Context: This is for "Moshimoshi", a comprehensive Japanese learning platform with features including:
- Flashcards and SRS (Spaced Repetition System)
- Kanji and vocabulary learning
- Reading materials (stories, news, books)
- Grammar and conjugation practice
- Games and interactive content
- Community features (Tea House Q&A forum)

Instructions:
1. Translate each English text to ${languageName}
2. Maintain the tone and context appropriate for a learning app
3. Keep any technical terms, brand names, or special formatting (like {{parameters}})
4. For UI elements, keep translations concise
5. Return ONLY a JSON array of translated strings in the same order

English texts to translate:
${JSON.stringify(texts, null, 2)}

Return format: ["translation 1", "translation 2", ...]`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Return only valid JSON arrays of translations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);

          if (response.error) {
            reject(new Error(`OpenAI API Error: ${response.error.message}`));
            return;
          }

          const content = response.choices[0].message.content.trim();

          // Try to parse the JSON array from the response
          let translations;
          try {
            // Remove markdown code blocks if present
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            translations = JSON.parse(cleanContent);
          } catch (e) {
            reject(new Error(`Failed to parse translations: ${content}`));
            return;
          }

          if (!Array.isArray(translations) || translations.length !== texts.length) {
            reject(new Error(`Expected ${texts.length} translations, got ${translations.length}`));
            return;
          }

          resolve(translations);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process translations for a single locale
 */
async function processLocale(locale) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${LANGUAGE_NAMES[locale]} (${locale})`);
  console.log('='.repeat(60));

  const inputFile = path.join(REVIEW_DIR, `${locale}.json`);
  const outputFile = path.join(OUTPUT_DIR, `${locale}-translated.json`);

  // Load the missing translations file
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  console.log(`Total missing keys: ${data.totalMissingKeys}`);

  // Prepare all translations to process
  const allTranslations = [];
  const sections = Object.keys(data.sections);

  for (const section of sections) {
    const sectionData = data.sections[section];
    const translations = sectionData.translations;

    for (const [key, value] of Object.entries(translations)) {
      allTranslations.push({
        key,
        section,
        english: value.english,
        translated: ''
      });
    }
  }

  console.log(`Processing ${allTranslations.length} translations in batches of ${BATCH_SIZE}...`);

  // Process in batches
  const totalBatches = Math.ceil(allTranslations.length / BATCH_SIZE);
  let processedCount = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, allTranslations.length);
    const batch = allTranslations.slice(batchStart, batchEnd);

    const batchNumber = i + 1;
    const progress = ((processedCount / allTranslations.length) * 100).toFixed(1);

    console.log(`\nBatch ${batchNumber}/${totalBatches} (${progress}% complete)`);
    console.log(`  Translating keys ${batchStart + 1}-${batchEnd}...`);

    try {
      const englishTexts = batch.map(item => item.english);
      const translations = await translateBatch(englishTexts, locale);

      // Apply translations
      for (let j = 0; j < batch.length; j++) {
        batch[j].translated = translations[j];
      }

      processedCount += batch.length;
      console.log(`  ✓ Successfully translated ${batch.length} keys`);

      // Save progress after each batch
      saveProgress(locale, allTranslations, outputFile);

      // Delay between batches to respect rate limits
      if (i < totalBatches - 1) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    } catch (error) {
      console.error(`  ✗ Error in batch ${batchNumber}:`, error.message);
      console.log(`  Saving progress and continuing...`);

      // Save what we have so far
      saveProgress(locale, allTranslations, outputFile);

      // Longer delay on error
      await sleep(DELAY_BETWEEN_BATCHES * 3);
    }
  }

  console.log(`\n✓ Completed ${locale}: ${processedCount}/${allTranslations.length} translations`);
  console.log(`  Output saved to: ${outputFile}`);

  return { locale, total: allTranslations.length, completed: processedCount };
}

/**
 * Save translation progress
 */
function saveProgress(locale, allTranslations, outputFile) {
  const output = {
    locale,
    languageName: LANGUAGE_NAMES[locale],
    generatedAt: new Date().toISOString(),
    totalKeys: allTranslations.length,
    completedKeys: allTranslations.filter(t => t.translated).length,
    translations: {}
  };

  // Group by section
  for (const item of allTranslations) {
    if (!output.translations[item.section]) {
      output.translations[item.section] = {};
    }
    output.translations[item.section][item.key] = {
      english: item.english,
      translated: item.translated
    };
  }

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Automated Translation System - OpenAI GPT-4o            ║');
  console.log('║   Target: 100% Coverage for All Locales                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Check for API key
  if (!OPENAI_API_KEY) {
    console.error('\n✗ Error: OPENAI_API_KEY environment variable not set');
    console.log('Please run: export OPENAI_API_KEY=your-api-key');
    process.exit(1);
  }

  console.log(`\nConfiguration:`);
  console.log(`  Model: GPT-4o`);
  console.log(`  Batch Size: ${BATCH_SIZE} keys per request`);
  console.log(`  Delay: ${DELAY_BETWEEN_BATCHES}ms between batches`);
  console.log(`  Output: ${OUTPUT_DIR}`);

  // Process all locales
  const locales = ['ja', 'de', 'es', 'fr', 'it'];
  const results = [];

  for (const locale of locales) {
    try {
      const result = await processLocale(locale);
      results.push(result);
    } catch (error) {
      console.error(`\n✗ Fatal error processing ${locale}:`, error);
      results.push({ locale, total: 0, completed: 0, error: error.message });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('TRANSLATION SUMMARY');
  console.log('='.repeat(60));

  let totalKeys = 0;
  let totalCompleted = 0;

  for (const result of results) {
    const status = result.completed === result.total ? '✓' : '⚠';
    const percentage = result.total > 0
      ? ((result.completed / result.total) * 100).toFixed(1)
      : '0.0';

    console.log(`${status} ${LANGUAGE_NAMES[result.locale]}: ${result.completed}/${result.total} (${percentage}%)`);

    totalKeys += result.total;
    totalCompleted += result.completed;
  }

  console.log('='.repeat(60));
  const overallPercentage = totalKeys > 0
    ? ((totalCompleted / totalKeys) * 100).toFixed(1)
    : '0.0';
  console.log(`TOTAL: ${totalCompleted}/${totalKeys} keys (${overallPercentage}%)`);
  console.log('='.repeat(60));

  console.log(`\nTranslated files saved to: ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Review the translations in translated-output/');
  console.log('2. Run integration script to add translations to locale files');
  console.log('3. Verify coverage with: node extract-missing-keys.js');
}

// Run the script
main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
