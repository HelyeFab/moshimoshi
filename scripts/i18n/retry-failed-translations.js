#!/usr/bin/env node

/**
 * Retry Failed Translations
 * Retries translations that failed in the previous run
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BATCH_SIZE = 20; // Smaller batches for retry
const DELAY_BETWEEN_BATCHES = 2000; // Longer delay for reliability
const OUTPUT_DIR = path.join(__dirname, 'translated-output');

const LANGUAGE_NAMES = {
  ja: 'Japanese',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian'
};

/**
 * Call OpenAI API to translate a batch of strings
 */
async function translateBatch(texts, targetLanguage) {
  const languageName = LANGUAGE_NAMES[targetLanguage];

  const prompt = `You are a professional translator for "Moshimoshi", a Japanese learning platform.

Target Language: ${languageName}

Instructions:
1. Translate each English text to ${languageName}
2. Keep technical terms, brand names, and {{parameters}} unchanged
3. Maintain appropriate tone for a learning app
4. Return ONLY a JSON array of translated strings in the same order

English texts:
${JSON.stringify(texts, null, 2)}

Return format: ["translation 1", "translation 2", ...]`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Return only valid JSON arrays.'
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
          const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          const translations = JSON.parse(cleanContent);

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry failed translations for a locale
 */
async function retryLocale(locale) {
  const filePath = path.join(OUTPUT_DIR, `${locale}-translated.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`  ✗ No file found for ${locale}`);
    return { locale, retried: 0, succeeded: 0 };
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const missingTranslations = [];

  // Find all missing translations
  for (const section of Object.keys(data.translations)) {
    for (const [key, value] of Object.entries(data.translations[section])) {
      if (!value.translated || value.translated === '') {
        missingTranslations.push({
          section,
          key,
          english: value.english
        });
      }
    }
  }

  if (missingTranslations.length === 0) {
    console.log(`  ✓ No missing translations for ${locale}`);
    return { locale, retried: 0, succeeded: 0 };
  }

  console.log(`  Found ${missingTranslations.length} missing translations`);
  console.log(`  Retrying in batches of ${BATCH_SIZE}...`);

  const totalBatches = Math.ceil(missingTranslations.length / BATCH_SIZE);
  let successCount = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, missingTranslations.length);
    const batch = missingTranslations.slice(batchStart, batchEnd);

    console.log(`  Batch ${i + 1}/${totalBatches}: Translating ${batch.length} keys...`);

    try {
      const englishTexts = batch.map(item => item.english);
      const translations = await translateBatch(englishTexts, locale);

      // Apply translations
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        data.translations[item.section][item.key].translated = translations[j];
      }

      successCount += batch.length;
      console.log(`    ✓ Successfully translated ${batch.length} keys`);

      // Save progress
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      if (i < totalBatches - 1) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);
      await sleep(DELAY_BETWEEN_BATCHES * 2);
    }
  }

  // Update completion count
  data.completedKeys = data.totalKeys - (missingTranslations.length - successCount);
  data.generatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return { locale, retried: missingTranslations.length, succeeded: successCount };
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Retry Failed Translations - OpenAI GPT-4o              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!OPENAI_API_KEY) {
    console.error('✗ Error: OPENAI_API_KEY not set');
    process.exit(1);
  }

  // Only retry locales that had failures
  const localesToRetry = ['fr', 'it'];
  const results = [];

  for (const locale of localesToRetry) {
    console.log(`\nProcessing ${LANGUAGE_NAMES[locale]} (${locale})...`);
    const result = await retryLocale(locale);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RETRY SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    if (result.retried > 0) {
      const percentage = ((result.succeeded / result.retried) * 100).toFixed(1);
      console.log(`${LANGUAGE_NAMES[result.locale]}: ${result.succeeded}/${result.retried} retried (${percentage}%)`);
    } else {
      console.log(`${LANGUAGE_NAMES[result.locale]}: No retries needed`);
    }
  }

  console.log('='.repeat(60));
  console.log('\n✓ Retry complete! Run the main script again if needed.');
}

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
