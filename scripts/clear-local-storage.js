/**
 * Clear Local Storage and IndexedDB Script
 *
 * This script generates an HTML page that can be opened in the browser
 * to clear all localStorage and IndexedDB data for the Moshimoshi app.
 *
 * Usage:
 *   node scripts/clear-local-storage.js
 *   Then open the generated clear-storage.html file in your browser
 */

const fs = require('fs');
const path = require('path');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clear Moshimoshi Storage</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .warning {
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .warning h3 {
      margin: 0 0 10px 0;
      color: #856404;
    }
    .warning p {
      margin: 0;
      color: #856404;
    }
    .info {
      background: #e7f3ff;
      border: 2px solid #2196F3;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .info h3 {
      margin: 0 0 10px 0;
      color: #0c5460;
    }
    .info ul {
      margin: 10px 0 0 0;
      padding-left: 20px;
      color: #0c5460;
    }
    button {
      background: #dc3545;
      color: white;
      border: none;
      padding: 15px 30px;
      font-size: 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.3s;
      width: 100%;
      margin-bottom: 10px;
    }
    button:hover {
      background: #c82333;
    }
    button.success {
      background: #28a745;
    }
    button.success:hover {
      background: #218838;
    }
    .result {
      margin-top: 20px;
      padding: 15px;
      border-radius: 8px;
      display: none;
    }
    .result.success {
      background: #d4edda;
      border: 2px solid #28a745;
      color: #155724;
      display: block;
    }
    .result.error {
      background: #f8d7da;
      border: 2px solid #dc3545;
      color: #721c24;
      display: block;
    }
    .details {
      margin-top: 10px;
      font-size: 14px;
      font-family: monospace;
      background: rgba(0,0,0,0.05);
      padding: 10px;
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
    }
    .details div {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🗑️ Clear Moshimoshi Storage</h1>
    <p class="subtitle">Clear all local storage and IndexedDB data</p>

    <div class="warning">
      <h3>⚠️ Warning</h3>
      <p>This will permanently delete all locally stored data including:</p>
    </div>

    <div class="info">
      <h3>📦 Data that will be cleared:</h3>
      <ul>
        <li><strong>LocalStorage:</strong> Theme, language, cached preferences, auth tokens</li>
        <li><strong>IndexedDB:</strong> Offline review data, preferences, sync queues</li>
        <li><strong>Session Storage:</strong> Temporary session data</li>
        <li><strong>Cookies:</strong> Session cookies</li>
      </ul>
      <p><strong>Note:</strong> Cloud data (for premium users) will NOT be affected.</p>
    </div>

    <button onclick="clearAllStorage()">Clear All Storage</button>

    <div id="result" class="result"></div>
  </div>

  <script>
    async function clearAllStorage() {
      const resultDiv = document.getElementById('result');
      const details = [];
      let hasErrors = false;

      try {
        // 1. Clear localStorage
        const localStorageKeys = Object.keys(localStorage);
        details.push(\`✅ Cleared \${localStorageKeys.length} localStorage items:\`);
        localStorageKeys.forEach(key => {
          details.push(\`   - \${key}\`);
        });
        localStorage.clear();

        // 2. Clear sessionStorage
        const sessionStorageKeys = Object.keys(sessionStorage);
        details.push(\`\\n✅ Cleared \${sessionStorageKeys.length} sessionStorage items:\`);
        sessionStorageKeys.forEach(key => {
          details.push(\`   - \${key}\`);
        });
        sessionStorage.clear();

        // 3. Clear all IndexedDB databases
        const databases = await indexedDB.databases();
        details.push(\`\\n✅ Found \${databases.length} IndexedDB databases:\`);

        for (const db of databases) {
          const dbName = db.name;
          details.push(\`   - Deleting: \${dbName}\`);

          try {
            await new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase(dbName);
              request.onsuccess = () => {
                details.push(\`     ✓ Deleted \${dbName}\`);
                resolve();
              };
              request.onerror = () => {
                details.push(\`     ✗ Failed to delete \${dbName}\`);
                hasErrors = true;
                reject(request.error);
              };
              request.onblocked = () => {
                details.push(\`     ⚠ Blocked: \${dbName} (close all tabs and try again)\`);
                hasErrors = true;
                reject(new Error('Database deletion blocked'));
              };
            });
          } catch (err) {
            details.push(\`     ✗ Error: \${err.message}\`);
            hasErrors = true;
          }
        }

        // 4. Clear cookies
        const cookies = document.cookie.split(';');
        details.push(\`\\n✅ Clearing \${cookies.length} cookies:\`);
        for (let cookie of cookies) {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name) {
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
            details.push(\`   - \${name}\`);
          }
        }

        // 5. Clear caches (if available)
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          details.push(\`\\n✅ Clearing \${cacheNames.length} caches:\`);
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
            details.push(\`   - \${cacheName}\`);
          }
        }

        // Show results
        resultDiv.className = hasErrors ? 'result error' : 'result success';
        resultDiv.innerHTML = \`
          <h3>\${hasErrors ? '⚠️ Completed with warnings' : '✅ Storage cleared successfully!'}</h3>
          <p>\${hasErrors ? 'Some items could not be cleared. Close all tabs and try again.' : 'All local data has been removed.'}</p>
          <div class="details">\${details.map(d => \`<div>\${d}</div>\`).join('')}</div>
          <button class="success" onclick="location.reload()">Reload Page</button>
        \`;

      } catch (error) {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = \`
          <h3>❌ Error clearing storage</h3>
          <p>\${error.message}</p>
          <div class="details">\${details.map(d => \`<div>\${d}</div>\`).join('')}</div>
        \`;
      }
    }

    // Log current storage on page load
    console.log('=== Current Storage State ===');
    console.log('LocalStorage items:', Object.keys(localStorage).length);
    console.log('SessionStorage items:', Object.keys(sessionStorage).length);

    indexedDB.databases().then(dbs => {
      console.log('IndexedDB databases:', dbs.map(db => db.name));
    });
  </script>
</body>
</html>`;

// Write the HTML file
const outputPath = path.join(__dirname, '..', 'clear-storage.html');
fs.writeFileSync(outputPath, htmlContent);

console.log('✅ Storage clearing page generated successfully!');
console.log('');
console.log('📍 Location:', outputPath);
console.log('');
console.log('🚀 Next steps:');
console.log('   1. Open clear-storage.html in your browser');
console.log('   2. Make sure you have localhost:3000 open in the same browser');
console.log('   3. Click "Clear All Storage" button');
console.log('   4. Reload your Moshimoshi app');
console.log('');
console.log('⚠️  Note: This will clear ALL local data. Cloud data (premium) is safe.');
