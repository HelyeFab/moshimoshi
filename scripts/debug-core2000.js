const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

(async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'public', file)
  });

  let dbPath = '/tmp/core2000-test/collection.anki21';
  if (!fs.existsSync(dbPath)) {
    dbPath = '/tmp/core2000-test/collection.anki2';
  }
  const filedata = fs.readFileSync(dbPath);
  const db = new SQL.Database(filedata);

  // Get models
  const colResult = db.exec('SELECT models FROM col');
  const modelsJson = colResult[0]?.values[0]?.[0];
  const models = JSON.parse(modelsJson);

  console.log('=== MODELS ===');
  Object.entries(models).forEach(([id, model]) => {
    console.log(`Model: ${model.name} (${model.flds.length} fields)`);
    console.log('Fields:', model.flds.map(f => f.name).join(', '));
  });

  // Get first card with "それ"
  const notesResult = db.exec(`SELECT id, mid, flds FROM notes WHERE flds LIKE '%それ%' LIMIT 1`);
  
  if (notesResult[0] && notesResult[0].values[0]) {
    const [noteId, modelId, fieldsStr] = notesResult[0].values[0];
    const fields = fieldsStr.split('\x1f');
    const model = models[modelId];

    console.log('\n=== CARD WITH それ ===');
    console.log(`Model: ${model.name}`);
    
    console.log('\n=== FIELD VALUES ===');
    model.flds.forEach((fld, i) => {
      const value = fields[i] || '';
      const preview = value.substring(0, 150).replace(/\n/g, ' ');
      console.log(`${i}. ${fld.name}:`, preview);
    });

    console.log('\n=== FRONT TEMPLATE ===');
    console.log(model.tmpls[0].qfmt);
    
    console.log('\n=== BACK TEMPLATE ===');
    console.log(model.tmpls[0].afmt);
  }

  db.close();
})().catch(console.error);
