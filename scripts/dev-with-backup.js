#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');
const BACKUP_DIR = path.join(PROJECT_ROOT, '02-PRODUCTION_DOCS');
const BACKUP_FILE = path.join(BACKUP_DIR, 'ENV_LOCAL_BACKUP.md');
const EXTERNAL_BACKUP_DIR = '/home/beano/Life-Org/08_Moshimoshi/Git';
const EXTERNAL_BACKUP_FILE = path.join(EXTERNAL_BACKUP_DIR, 'env_latest.md');

function backupEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.log('[Backup] .env.local not found, skipping backup');
    return;
  }

  try {
    // Read the env file
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Create markdown content with metadata
    const mdContent = `# Environment Variables Backup

> **Auto-generated backup of \`.env.local\`**
> Last updated: ${timestamp}
>
> This file is gitignored and auto-updated when the dev server stops.

\`\`\`bash
${envContent}
\`\`\`
`;

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Write the backup (overwrites existing)
    fs.writeFileSync(BACKUP_FILE, mdContent);
    console.log(`[Backup] .env.local saved to 02-PRODUCTION_DOCS/ENV_LOCAL_BACKUP.md`);

    // Also write to external backup location
    if (!fs.existsSync(EXTERNAL_BACKUP_DIR)) {
      fs.mkdirSync(EXTERNAL_BACKUP_DIR, { recursive: true });
    }
    fs.writeFileSync(EXTERNAL_BACKUP_FILE, mdContent);
    console.log(`[Backup] .env.local also saved to ${EXTERNAL_BACKUP_FILE}`);
  } catch (err) {
    console.error('[Backup] Failed:', err.message);
  }
}

// Run concurrently with the dev commands
const concurrently = require('concurrently');

const { result } = concurrently(
  [
    { command: 'next dev', name: 'next', prefixColor: 'cyan' },
    { command: 'npm run notebooklm:watch', name: 'watch', prefixColor: 'yellow' }
  ],
  {
    cwd: PROJECT_ROOT,
    killOthersOnFail: true
  }
);

result.then(
  () => {
    backupEnv();
    process.exit(0);
  },
  () => {
    backupEnv();
    process.exit(1);
  }
);

// Keep a reference for signal handling
const child = { on: () => {} };

// Backup on exit
process.on('SIGINT', () => {
  backupEnv();
  process.exit(0);
});

process.on('SIGTERM', () => {
  backupEnv();
  process.exit(0);
});

child.on('close', (code) => {
  backupEnv();
  process.exit(code);
});
