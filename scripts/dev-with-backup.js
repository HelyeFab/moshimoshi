#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Platform-specific backup directories
const BACKUP_DIRS = {
  win32: 'C:\\Users\\esfab\\Obsidian\\Life-Org\\08_Moshimoshi\\Git',
  linux: '/home/beano/Life-Org/08_Moshimoshi/Git'
};

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');
const LOG_FILE = path.join(PROJECT_ROOT, 'backup.log');
const BACKUP_DIR = BACKUP_DIRS[os.platform()];

function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logLine = `${timestamp} - ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
}

function cleanupOldBackups() {
  try {
    // Get all timestamped backup files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('env-local-') && f.endsWith('.md') && f !== 'env-local.md')
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by newest first

    // Keep only the most recent one, delete the rest
    if (files.length > 1) {
      const toDelete = files.slice(1); // Skip the first (newest) one
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
        log(`Deleted old backup: ${file.name}`);
      });
      log(`Cleaned up ${toDelete.length} old backup(s)`);
    }
  } catch (err) {
    log(`Cleanup error: ${err.message}`);
  }
}

function backupEnv() {
  log('Backup function called');

  if (!BACKUP_DIR) {
    log(`Unsupported platform: ${os.platform()}`);
    console.log(`Unsupported platform for backup: ${os.platform()}`);
    return;
  }

  if (!fs.existsSync(ENV_FILE)) {
    log(`ENV_FILE not found: ${ENV_FILE}`);
    console.log('.env.local not found');
    return;
  }

  log(`ENV_FILE exists: ${ENV_FILE}`);

  try {
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    log(`Backup dir ready: ${BACKUP_DIR}`);

    // Create timestamped backup as .md file so Obsidian shows it
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupFile = path.join(BACKUP_DIR, `env-local-${timestamp}.md`);

    // Copy the file
    fs.copyFileSync(ENV_FILE, backupFile);
    log(`Copied to: ${backupFile}`);

    // Also update the main env-local.md (without timestamp)
    const mainBackup = path.join(BACKUP_DIR, 'env-local.md');
    fs.copyFileSync(ENV_FILE, mainBackup);
    log(`Updated: ${mainBackup}`);

    // Clean up old timestamped backups
    cleanupOldBackups();

    console.log('Backed up .env.local');
  } catch (err) {
    log(`Backup error: ${err.message}`);
    console.error('Backup failed:', err.message);
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
