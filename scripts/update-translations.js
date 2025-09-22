#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Translations for "Clear" and "Selection cleared"
const translations = {
  en: {
    clear: "Clear",
    selectionCleared: "Selection cleared"
  },
  fr: {
    clear: "Effacer",
    selectionCleared: "Sélection effacée"
  },
  ja: {
    clear: "クリア",
    selectionCleared: "選択をクリアしました"
  },
  de: {
    clear: "Löschen",
    selectionCleared: "Auswahl gelöscht"
  },
  es: {
    clear: "Borrar",
    selectionCleared: "Selección borrada"
  },
  it: {
    clear: "Cancella",
    selectionCleared: "Selezione cancellata"
  }
};

// Update each language file
Object.keys(translations).forEach(lang => {
  const filePath = path.join(__dirname, '..', 'src', 'i18n', 'locales', lang, 'strings.ts');

  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Add "clear" to common section if not present
    if (!content.includes('clear:')) {
      // Find the common section and add clear after continue
      content = content.replace(
        /(\s+continue: "[^"]+",)/,
        `$1\n    clear: "${translations[lang].clear}",`
      );
    }

    // Add "selectionCleared" to learn section
    if (!content.includes('selectionCleared:')) {
      // Find the learn section and add selectionCleared after noStrugglingCharacters
      content = content.replace(
        /(noStrugglingCharacters: "[^"]+",\n\s+\},)/,
        `$1`.replace('},', `selectionCleared: "${translations[lang].selectionCleared}",\n  },`)
      );
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${lang}/strings.ts`);
  } else {
    console.log(`⚠️ File not found: ${filePath}`);
  }
});

console.log('\n✅ All translations updated!');