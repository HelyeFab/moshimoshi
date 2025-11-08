#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

// Helper to get date string
function getDateString(daysOffset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

// Snapshot storage
let snapshot = null;

async function createSnapshot() {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const doc = await userStatsRef.get();
  snapshot = doc.data();
  console.log('📸 Snapshot created');
  return snapshot;
}

async function restoreSnapshot() {
  if (!snapshot) {
    console.log('❌ No snapshot available');
    return;
  }
  const userStatsRef = db.collection('user_stats').doc(userId);
  await userStatsRef.set(snapshot);
  console.log('♻️ Snapshot restored');
}

async function setLastActivityDate(dateString) {
  const userStatsRef = db.collection('user_stats').doc(userId);
  await userStatsRef.update({
    'dates.lastActivityDate': dateString,
    'dates.isActiveToday': dateString === getDateString(0),
    'metadata.lastUpdated': new Date().toISOString()
  });
  console.log(`✅ Set last activity date to: ${dateString}`);
}

async function viewStatus() {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const doc = await userStatsRef.get();
  const data = doc.data();

  console.log('\n📊 CURRENT STATUS:');
  console.log(`  Streak: ${data.streak?.current || 0} days (Best: ${data.streak?.best || 0})`);
  console.log(`  XP: ${data.xp?.total || 0}`);
  console.log(`  Last Activity: ${data.dates?.lastActivityDate || 'Never'}`);
  console.log(`  Today: ${getDateString(0)}`);
  console.log(`  XP Gained Today: ${data.xp?.xpGainedToday || 0}`);
  console.log(`  Last XP Date: ${data.xp?.lastXPDate || 'Never'}`);
}

// Command line interface
const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case 'snapshot':
        await createSnapshot();
        break;
      case 'restore':
        await restoreSnapshot();
        break;
      case 'set-yesterday':
        await setLastActivityDate(getDateString(-1));
        await viewStatus();
        break;
      case 'status':
        await viewStatus();
        break;
      default:
        console.log('Usage: node test-helper.js [snapshot|restore|set-yesterday|status]');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

main();
