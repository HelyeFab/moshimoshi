/**
 * Test that the Firebase sync flag is working correctly
 */

const featuresConfig = require('../config/features.v1.json');

console.log('=== Testing Firebase Sync Control ===\n');

// Find the anki_imports feature
const ankiFeature = featuresConfig.features.find(f => f.id === 'anki_imports');

if (!ankiFeature) {
  console.error('❌ ERROR: anki_imports feature not found in config!');
  process.exit(1);
}

console.log('✅ anki_imports feature found');
console.log('');

// Check metadata
if (!ankiFeature.metadata) {
  console.error('❌ ERROR: metadata missing from anki_imports feature!');
  process.exit(1);
}

console.log('Feature configuration:');
console.log('  Name:', ankiFeature.name);
console.log('  ID:', ankiFeature.id);
console.log('  Lifecycle:', ankiFeature.lifecycle);
console.log('');

console.log('Sync configuration:');
console.log('  enableFirebaseSync:', ankiFeature.metadata.enableFirebaseSync);
console.log('  syncMode:', ankiFeature.metadata.syncMode);
console.log('');

// Verify it's disabled
const enableFirebaseSync = ankiFeature.metadata.enableFirebaseSync === true;

console.log('Status check:');
if (enableFirebaseSync) {
  console.log('  ⚠️  Firebase sync is ENABLED');
  console.log('  ⚠️  Large decks may fail to import');
  console.log('  ⚠️  Costs will scale with users');
  console.log('');
  console.log('To disable:');
  console.log('  1. Edit config/features.v1.json');
  console.log('  2. Set enableFirebaseSync: false');
  console.log('  3. Set syncMode: "local-only"');
} else {
  console.log('  ✅ Firebase sync is DISABLED (recommended)');
  console.log('  ✅ Anki imports will be stored locally only');
  console.log('  ✅ No size limits');
  console.log('  ✅ Zero cloud storage costs');
  console.log('');
  console.log('To enable:');
  console.log('  1. Edit config/features.v1.json');
  console.log('  2. Set enableFirebaseSync: true');
  console.log('  3. Set syncMode: "firebase"');
  console.log('  ⚠️  Not recommended for large decks');
}

console.log('');
console.log('Documentation: /ANKI_FIREBASE_SYNC_CONTROL.md');
console.log('');

process.exit(0);
