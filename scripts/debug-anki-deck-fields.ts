import fs from 'fs';
import initSqlJs from 'sql.js';

async function analyzeAnkiFile() {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/home/beano/DevProjects/NextJs/moshimoshi/public/${file}`
  });

  // Use anki21 file (the real data)
  const filepath = '/tmp/anki-test/collection.anki21';
  const filedata = fs.readFileSync(filepath);

  const db = new SQL.Database(filedata);

  // Get models (note types)
  const colResult = db.exec('SELECT models FROM col');
  const modelsJson = colResult[0]?.values[0]?.[0] as string;
  const models = JSON.parse(modelsJson);

  console.log('=== MODELS (Note Types) ===');
  for (const [modelId, model] of Object.entries(models)) {
    const m = model as any;
    console.log(`\nModel ID: ${modelId}`);
    console.log(`Name: ${m.name}`);
    console.log(`Fields: ${JSON.stringify(m.flds.map((f: any) => f.name))}`);
    console.log(`Templates: ${JSON.stringify(m.tmpls.map((t: any) => t.name))}`);
    if (m.tmpls && m.tmpls[0]) {
      console.log(`Front template (qfmt):`);
      console.log(m.tmpls[0].qfmt.substring(0, 300));
      console.log(`Back template (afmt):`);
      console.log(m.tmpls[0].afmt.substring(0, 300));
    }
  }

  // Count notes
  const countResult = db.exec('SELECT COUNT(*) FROM notes');
  const totalNotes = countResult[0]?.values[0]?.[0];
  console.log(`\n=== TOTAL NOTES: ${totalNotes} ===`);

  // Get first 3 notes to see field contents
  const notesResult = db.exec('SELECT id, mid, flds, tags FROM notes LIMIT 3');
  console.log('\n=== FIRST 3 NOTES (FULL FIELDS) ===');

  if (notesResult[0]) {
    notesResult[0].values.forEach((row: any[], idx: number) => {
      const [noteId, modelId, fieldsStr, tags] = row;
      const fields = (fieldsStr as string).split('\x1f');
      const model = (models as any)[modelId];
      const fieldNames = model?.flds?.map((f: any) => f.name) || [];

      console.log(`\n--- Note ${idx + 1} ---`);
      console.log(`ID: ${noteId}`);
      console.log(`Model: ${model?.name || modelId}`);
      console.log(`Tags: ${tags}`);
      console.log(`Field count: ${fields.length}`);
      console.log(`Field names: ${JSON.stringify(fieldNames)}`);
      console.log('');

      fields.forEach((field: string, i: number) => {
        const fieldName = fieldNames[i] || `Field ${i}`;
        console.log(`[${i}] ${fieldName}:`);
        console.log(`    Content: ${field}`);
        console.log(`    Length: ${field.length}`);
        console.log('');
      });
    });
  }

  db.close();
}

analyzeAnkiFile().catch(console.error);
