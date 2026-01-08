import fs from 'fs';
import initSqlJs from 'sql.js';

async function testTemplateRendering() {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/home/beano/DevProjects/NextJs/moshimoshi/public/${file}`
  });

  const filepath = '/tmp/anki-test/collection.anki21';
  const filedata = fs.readFileSync(filepath);
  const db = new SQL.Database(filedata);

  // Get models
  const colResult = db.exec('SELECT models FROM col');
  const modelsJson = colResult[0]?.values[0]?.[0] as string;
  const models = JSON.parse(modelsJson);

  // Get a JlabNote card (skip first 2 InfoNote cards)
  const notesResult = db.exec('SELECT id, mid, flds FROM notes LIMIT 1 OFFSET 2');

  if (notesResult[0] && notesResult[0].values[0]) {
    const [noteId, modelId, fieldsStr] = notesResult[0].values[0];
    const fields = (fieldsStr as string).split('\x1f');
    const model = models[modelId as string];

    console.log('=== MODEL INFO ===');
    console.log('Model name:', model.name);
    console.log('Field count:', fields.length);
    console.log('Template count:', model.tmpls.length);

    // Get template
    const template = model.tmpls[0];
    console.log('\n=== FRONT TEMPLATE (qfmt) ===');
    console.log(template.qfmt);

    console.log('\n=== BACK TEMPLATE (afmt) ===');
    console.log(template.afmt);

    // Build field map
    const fieldMap: Record<string, string> = {};
    model.flds.forEach((fld: any, i: number) => {
      fieldMap[fld.name] = fields[i] || '';
    });

    console.log('\n=== FIELD MAP (first 5) ===');
    Object.entries(fieldMap).slice(0, 5).forEach(([name, value]) => {
      console.log(`${name}: ${value.substring(0, 100)}`);
    });

    // Simple template rendering
    const renderTemplate = (template: string, fieldMap: Record<string, string>, frontSide?: string): string => {
      let rendered = template;

      if (frontSide !== undefined) {
        rendered = rendered.replace(/{{\s*FrontSide\s*}}/gi, frontSide);
      }

      rendered = rendered.replace(/{{[#^/][^}]+}}/g, '');

      rendered = rendered.replace(/{{\s*([^}]+)\s*}}/g, (match, token) => {
        const cleaned = token.trim();
        if (/^FrontSide$/i.test(cleaned)) {
          return frontSide || '';
        }
        const fieldName = cleaned.split(':').pop() || '';
        return fieldMap[fieldName.trim()] ?? '';
      });

      return rendered;
    };

    const renderedFront = renderTemplate(template.qfmt, fieldMap);
    const renderedBack = renderTemplate(template.afmt, fieldMap, renderedFront);

    console.log('\n=== RENDERED FRONT ===');
    console.log(renderedFront);

    console.log('\n=== RENDERED BACK ===');
    console.log(renderedBack);
  }

  db.close();
}

testTemplateRendering().catch(console.error);
