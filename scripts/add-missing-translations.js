const fs = require('fs');

const translations = {
  fr: {
    popularVideosDescription: 'Vidéos les plus regardées par la communauté',
    commonTrending: 'Tendances'
  },
  de: {
    popularVideosDescription: 'Meistgesehene Videos der Community',
    commonTrending: 'Trend'
  },
  it: {
    popularVideosDescription: 'Video più guardati dalla comunità',
    commonTrending: 'Tendenze'
  },
  es: {
    popularVideosDescription: 'Videos más vistos por la comunidad',
    commonTrending: 'Tendencias'
  }
};

const locales = ['fr', 'de', 'it', 'es'];

locales.forEach(locale => {
  const filePath = `src/i18n/locales/${locale}/strings.ts`;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add popularVideos.description
  content = content.replace(
    /(popularVideos: \{[\s\S]*?subtitle: '[^']+',)/,
    `$1\n    description: '${translations[locale].popularVideosDescription}',`
  );
  
  // Add common.trending
  content = content.replace(
    /(popular: '[^']+',)/,
    `$1\n    trending: '${translations[locale].commonTrending}',`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ Updated ${locale}/strings.ts`);
});

console.log('\n✅ All translations added!');
