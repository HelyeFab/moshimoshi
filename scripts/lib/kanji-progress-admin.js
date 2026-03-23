const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const options = {
    apply: false,
    uid: null,
    email: null,
    serviceAccount: null,
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    switch (arg) {
      case '--apply':
        options.apply = true;
        break;
      case '--uid':
        options.uid = argv[++index] || null;
        break;
      case '--email':
        options.email = argv[++index] || null;
        break;
      case '--service-account':
        options.serviceAccount = argv[++index] || null;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positionals.push(arg);
    }
  }

  return { options, positionals };
}

function resolveServiceAccountPath(explicitPath) {
  const candidate = explicitPath || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountPath = candidate
    ? path.resolve(candidate)
    : path.resolve(__dirname, '../../moshimoshi-service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found at: ${serviceAccountPath}`);
  }

  return serviceAccountPath;
}

function initAdmin(serviceAccountPath) {
  if (admin.apps.length) {
    return admin;
  }

  const resolvedPath = resolveServiceAccountPath(serviceAccountPath);
  const serviceAccount = require(resolvedPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

function assertTarget(options) {
  if ((options.uid && options.email) || (!options.uid && !options.email)) {
    throw new Error('Provide exactly one of --uid or --email.');
  }
}

async function resolveUserId(options) {
  assertTarget(options);

  if (options.uid) {
    return options.uid;
  }

  const userRecord = await admin.auth().getUserByEmail(options.email);
  return userRecord.uid;
}

function describeTarget(options, userId) {
  if (options.email) {
    return `${options.email} (${userId})`;
  }
  return userId;
}

function getCanonicalKanjiProgressRef(db, userId) {
  return db.collection('users').doc(userId).collection('progress').doc('kanji');
}

function getLegacyKanjiProgressRef(db, userId) {
  return db.collection('progress').doc(`${userId}_kanji`);
}

function formatTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

module.exports = {
  admin,
  describeTarget,
  formatTimestamp,
  getCanonicalKanjiProgressRef,
  getLegacyKanjiProgressRef,
  initAdmin,
  parseArgs,
  resolveUserId,
};
