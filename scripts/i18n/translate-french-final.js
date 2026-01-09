#!/usr/bin/env node

/**
 * Final French Translation - Single key at a time
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OUTPUT_DIR = path.join(__dirname, 'translated-output');
const DELAY = 1500; // 1.5 seconds between requests

async function translateSingle(text, targetLanguage = 'fr') {
  const prompt = `Translate this English text to French for a Japanese learning app called "Moshimoshi". Keep any {{parameters}} unchanged. Return ONLY the French translation, nothing else.

English: ${text}

French:`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-4o-mini', // Faster, cheaper model for simple translations
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
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
            reject(new Error(response.error.message));
            return;
          }

          const translation = response.choices[0].message.content.trim();
          // Remove any quotes that might be added
          resolve(translation.replace(/^["']|["']$/g, ''));
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

async function main() {
  console.log('French Final Translation - Single Key Mode\n');

  if (!OPENAI_API_KEY) {
    console.error('✗ Error: OPENAI_API_KEY not set');
    process.exit(1);
  }

  const filePath = path.join(OUTPUT_DIR, 'fr-translated.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Find missing translations
  const missing = [];
  for (const section of Object.keys(data.translations)) {
    for (const [key, value] of Object.entries(data.translations[section])) {
      if (!value.translated || value.translated === '') {
        missing.push({ section, key, english: value.english });
      }
    }
  }

  console.log(`Found ${missing.length} missing translations\n`);

  if (missing.length === 0) {
    console.log('✓ All translations complete!');
    return;
  }

  let successCount = 0;

  for (let i = 0; i < missing.length; i++) {
    const item = missing[i];
    console.log(`[${i + 1}/${missing.length}] ${item.key}`);
    console.log(`  EN: ${item.english.substring(0, 60)}${item.english.length > 60 ? '...' : ''}`);

    try {
      const translation = await translateSingle(item.english);
      data.translations[item.section][item.key].translated = translation;
      console.log(`  FR: ${translation.substring(0, 60)}${translation.length > 60 ? '...' : ''}`);
      console.log(`  ✓ Success\n`);

      successCount++;

      // Save after each success
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      if (i < missing.length - 1) {
        await sleep(DELAY);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}\n`);
      await sleep(DELAY * 2);
    }
  }

  // Update completion count
  data.completedKeys = data.totalKeys - (missing.length - successCount);
  data.generatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log('='.repeat(60));
  console.log(`✓ Completed: ${successCount}/${missing.length} translations`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
