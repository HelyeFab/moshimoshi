#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');
const BACKUP_DIR = path.join(PROJECT_ROOT, '02-PRODUCTION_DOCS');
const BACKUP_FILE = path.join(BACKUP_DIR, 'ENV_LOCAL_BACKUP.md');

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
  } catch (err) {
    console.error('[Backup] Failed:', err.message);
  }
}

// Run concurrently with the dev commands
const isWindows = os.platform() === 'win32';

const child = spawn(
  isWindows ? 'cmd' : 'sh',
  isWindows
    ? ['/c', 'npx concurrently "next dev" "npm run notebooklm:watch"']
    : ['-c', 'npx concurrently "next dev" "npm run notebooklm:watch"'],
  {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  }
);

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
