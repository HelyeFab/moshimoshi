/**
 * Check actual Firebase Storage usage
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function checkStorageUsage() {
  console.log('=== Firebase Storage Usage ===\n');

  try {
    console.log('Bucket:', bucket.name);
    console.log('');

    // Get all files
    const [files] = await bucket.getFiles();

    console.log('Total files:', files.length);
    console.log('');

    // Calculate sizes by directory/prefix
    const sizesByFolder = {};
    let totalSize = 0;

    files.forEach(file => {
      const size = parseInt(file.metadata.size || 0);
      totalSize += size;

      // Get folder (first part of path)
      const parts = file.name.split('/');
      const folder = parts.length > 1 ? parts[0] : 'root';

      if (!sizesByFolder[folder]) {
        sizesByFolder[folder] = {
          count: 0,
          size: 0,
          files: []
        };
      }

      sizesByFolder[folder].count++;
      sizesByFolder[folder].size += size;

      // Keep track of first few files as examples
      if (sizesByFolder[folder].files.length < 3) {
        sizesByFolder[folder].files.push({
          name: file.name,
          size: size
        });
      }
    });

    console.log('BREAKDOWN BY FOLDER:\n');

    Object.keys(sizesByFolder).sort().forEach(folder => {
      const data = sizesByFolder[folder];
      const sizeMB = data.size / 1024 / 1024;
      const sizeKB = data.size / 1024;

      console.log(`📁 ${folder}/`);
      console.log(`   Files: ${data.count}`);
      console.log(`   Size: ${sizeMB >= 1 ? sizeMB.toFixed(2) + ' MB' : sizeKB.toFixed(2) + ' KB'}`);
      console.log(`   Examples:`);
      data.files.forEach(f => {
        console.log(`     - ${f.name} (${(f.size / 1024).toFixed(2)} KB)`);
      });
      console.log('');
    });

    console.log('TOTAL STORAGE USED:');
    console.log('  Files:', files.length);
    console.log('  Size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('  Percentage of 5 GB free tier:', ((totalSize / (5 * 1024 * 1024 * 1024)) * 100).toFixed(2) + '%');
    console.log('  Remaining:', ((5 * 1024) - (totalSize / 1024 / 1024)).toFixed(2), 'MB');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
}

checkStorageUsage();
