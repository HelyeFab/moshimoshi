const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'translated-output');
const locales = ['ja', 'de', 'es', 'fr', 'it'];

console.log('Translation Status Check\n');
console.log('='.repeat(60));

let totalKeys = 0;
let totalCompleted = 0;

for (const locale of locales) {
  const filePath = path.join(OUTPUT_DIR, `${locale}-translated.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let missing = 0;
  for (const section of Object.keys(data.translations)) {
    for (const [key, value] of Object.entries(data.translations[section])) {
      if (!value.translated || value.translated === '') {
        missing++;
      }
    }
  }

  const total = data.totalKeys;
  const completed = total - missing;
  const pct = ((completed / total) * 100).toFixed(1);

  const status = completed === total ? '✓' : '⚠';
  console.log(`${status} ${locale.toUpperCase()}: ${completed}/${total} (${pct}%)`);

  totalKeys += total;
  totalCompleted += completed;
}

console.log('='.repeat(60));
const overallPct = ((totalCompleted / totalKeys) * 100).toFixed(1);
console.log(`TOTAL: ${totalCompleted}/${totalKeys} (${overallPct}%)`);
console.log('='.repeat(60));
