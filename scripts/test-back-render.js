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

  const colResult = db.exec('SELECT models FROM col');
  const modelsJson = colResult[0]?.values[0]?.[0];
  const models = JSON.parse(modelsJson);

  const notesResult = db.exec(`SELECT id, mid, flds FROM notes WHERE flds LIKE '%それ%' LIMIT 1`);
  
  if (notesResult[0] && notesResult[0].values[0]) {
    const [noteId, modelId, fieldsStr] = notesResult[0].values[0];
    const fields = fieldsStr.split('\x1f');
    const model = models[modelId];

    const fieldMap = {};
    model.flds.forEach((fld, i) => {
      fieldMap[fld.name] = fields[i] || '';
    });

    const template = model.tmpls[0];
    
    // Render front
    let front = template.qfmt;
    front = front.replace(/{{([^}]+)}}/g, (match, token) => {
      const fieldName = token.trim();
      return fieldMap[fieldName] || '';
    });
    
    console.log('=== RENDERED FRONT ===');
    console.log(front);
    
    // Render back with FrontSide
    let back = template.afmt;
    back = back.replace(/{{FrontSide}}/gi, front);
    back = back.replace(/{{([^}]+)}}/g, (match, token) => {
      const fieldName = token.trim();
      return fieldMap[fieldName] || '';
    });
    
    console.log('\n=== RENDERED BACK ===');
    console.log(back);
  }

  db.close();
})().catch(console.error);
