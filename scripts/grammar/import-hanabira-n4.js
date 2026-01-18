const fs = require('fs');
const path = require('path');

const INPUT = '/tmp/hanabira-content/grammar_json/grammar_ja_N4_full_alphabetical_0001.json';
const OUT_POINTS_DIR = '/home/beano/DevProjects/NextJs/moshimoshi/public/data/grammar/points/n4-drafts';
const OUT_INDEX = '/home/beano/DevProjects/NextJs/moshimoshi/public/data/grammar/n4-index.draft.json';
const OUT_CHECKLIST = '/home/beano/DevProjects/NextJs/moshimoshi/public/data/grammar/n4-drafts-checklist.md';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function makeId(idx) {
  // Reserve 201+ for N4 to avoid collisions with N5.
  const num = 200 + idx + 1;
  return `${pad3(num)}-n4-point-${idx + 1}`;
}

function clampShortDescription(text) {
  if (!text) return '';
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 100) return trimmed;
  return trimmed.slice(0, 97).trimEnd() + '...';
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing input file: ${INPUT}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf8');
  const items = JSON.parse(raw);
  if (!Array.isArray(items)) {
    console.error('Expected array in hanabira N4 file.');
    process.exit(1);
  }

  ensureDir(OUT_POINTS_DIR);

  const checklist = [];
  const indexPoints = [];

  items.forEach((item, idx) => {
    const id = makeId(idx);
    const titleJa = (item.title || '').trim();
    const shortExp = (item.short_explanation || '').trim();
    const longExp = (item.long_explanation || '').trim();
    const formation = (item.formation || '').trim();

    const point = {
      id,
      version: '1.0.0',
      title: {
        ja: titleJa,
        romaji: '',
        en: '',
      },
      jlptLevel: 'N4',
      category: 'uncategorized',
      explanation: {
        en: longExp || shortExp,
        ja: '',
      },
      structure: {
        pattern: formation,
        components: [],
      },
      examples: Array.isArray(item.examples) ? item.examples.map((ex) => ({
        japanese: ex.jp || '',
        romaji: ex.romaji || '',
        english: ex.en || '',
        breakdown: {},
        notes: '',
      })) : [],
      relatedPoints: [],
      commonMistakes: [],
      tags: ['n4', 'hanabira-seed'],
    };

    const outPath = path.join(OUT_POINTS_DIR, `${id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(point, null, 2) + '\n');

    const shortDescription = clampShortDescription(shortExp);

    indexPoints.push({
      id,
      order: idx + 1,
      category: 'uncategorized',
      title: {
        ja: titleJa,
        romaji: '',
        en: '',
      },
      shortDescription,
      jlptLevel: 'N4',
      difficulty: 'intermediate',
    });

    const missing = [];
    if (!titleJa) missing.push('title.ja');
    missing.push('title.romaji');
    missing.push('title.en');
    missing.push('category');
    missing.push('structure.components');
    if (!shortDescription) missing.push('index.shortDescription');
    if (shortDescription.length > 0 && (shortDescription.length < 50 || shortDescription.length > 100)) {
      missing.push('index.shortDescription length 50-100');
    }
    if (!point.explanation.en) missing.push('explanation.en');
    missing.push('explanation.ja');
    missing.push('relatedPoints');
    missing.push('commonMistakes');
    if (point.examples.length === 0) missing.push('examples');

    checklist.push({ id, title: titleJa, missing });
  });

  const index = {
    version: '1.0.0',
    jlptLevel: 'N4',
    totalPoints: indexPoints.length,
    lastUpdated: '2026-01-17',
    points: indexPoints,
  };

  fs.writeFileSync(OUT_INDEX, JSON.stringify(index, null, 2) + '\n');

  const lines = [];
  lines.push('# N4 Draft Checklist (Hanabira Seed)');
  lines.push('');
  lines.push('This file lists missing/placeholder fields per N4 draft point.');
  lines.push('All items below need editorial/QA pass before production use.');
  lines.push('');
  lines.push('License note: Hanabira content is Creative Commons and requires attribution; confirm exact CC version before release.');
  lines.push('');
  lines.push(`Total points: ${indexPoints.length}`);
  lines.push('');

  checklist.forEach((c) => {
    lines.push(`- ${c.id} | ${c.title || '(missing title)'}`);
    lines.push(`  Missing: ${c.missing.join(', ')}`);
  });

  fs.writeFileSync(OUT_CHECKLIST, lines.join('\n') + '\n');

  console.log(`Wrote ${indexPoints.length} draft points to ${OUT_POINTS_DIR}`);
  console.log(`Wrote draft index to ${OUT_INDEX}`);
  console.log(`Wrote checklist to ${OUT_CHECKLIST}`);
}

main();
