const fs = require('fs');
const path = require('path');

const repo = process.cwd();
const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];

const normalizeLitePayload = (data) => ({
  grammarPointId: data.grammarPointId,
  version: data.version || '1.0.0',
  totalExercises: Array.isArray(data.exercises) ? Math.min(1, data.exercises.length) : 0,
  exercises: Array.isArray(data.exercises) ? data.exercises.slice(0, 1) : [],
});

for (const level of levels) {
  const dir = path.join(repo, 'public/data/grammar/exercises', level);
  if (!fs.existsSync(dir)) {
    continue;
  }

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.lite.json'));

  for (const file of files) {
    const filePath = path.join(dir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const lite = normalizeLitePayload(data);
    const litePath = path.join(dir, file.replace(/\.json$/, '.lite.json'));
    fs.writeFileSync(litePath, JSON.stringify(lite, null, 2) + '\n');
  }
}
