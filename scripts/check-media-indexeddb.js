/**
 * Script to check if media files exist in IndexedDB
 * Run in browser console on the app page
 */

const checkMediaInIndexedDB = async () => {
  const dbName = 'ankiMediaDB';
  const storeName = 'media';

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => {
      console.error('Failed to open ankiMediaDB');
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const allMedia = getAllRequest.result;
        console.log('=== IndexedDB Media Store ===');
        console.log('Total files:', allMedia.length);

        if (allMedia.length > 0) {
          console.log('\nSample files (first 5):');
          allMedia.slice(0, 5).forEach(m => {
            console.log(`  ${m.id}: ${m.type}, ${m.size} bytes`);
          });

          // Check for specific image
          const targetImage = '2d3d7eecb6afa29b4c2cfdff8034d5cc.jpg';
          const found = allMedia.find(m => m.id === targetImage);

          console.log('\n=== Looking for specific image ===');
          console.log(`Target: ${targetImage}`);
          if (found) {
            console.log('FOUND:', found.type, found.size, 'bytes');
          } else {
            console.log('NOT FOUND');

            // Check for similar filenames
            const imageFiles = allMedia.filter(m => m.id.endsWith('.jpg') || m.id.endsWith('.png'));
            console.log('\nImage files found:', imageFiles.length);
            imageFiles.slice(0, 3).forEach(m => console.log(`  ${m.id}`));
          }
        }

        db.close();
        resolve(allMedia);
      };

      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    };
  });
};

// Export for console use
console.log('Run: checkMediaInIndexedDB()');
