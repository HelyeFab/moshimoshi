#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');

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

// Readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Helper to get date string in UTC format (YYYY-MM-DD)
function getDateString(daysOffset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

// Helper to format date for display
function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString + 'T00:00:00.000Z');
  return date.toISOString().split('T')[0];
}

// Calculate days between dates
function daysBetween(date1String, date2String) {
  const d1 = new Date(date1String + 'T00:00:00.000Z');
  const d2 = new Date(date2String + 'T00:00:00.000Z');
  const diffMs = d2.getTime() - d1.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Get current user data
async function getUserData() {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const doc = await userStatsRef.get();

  if (!doc.exists) {
    console.log('❌ User not found');
    return null;
  }

  return doc.data();
}

// **NEW:** Create snapshot for rollback
let dataSnapshot = null;

async function createSnapshot() {
  const data = await getUserData();
  if (data) {
    dataSnapshot = JSON.parse(JSON.stringify(data));
    console.log('📸 Snapshot created');
  }
}

async function restoreSnapshot() {
  if (!dataSnapshot) {
    console.log('❌ No snapshot available');
    return;
  }

  const userStatsRef = db.collection('user_stats').doc(userId);
  await userStatsRef.set(dataSnapshot);
  console.log('♻️ Snapshot restored');
}

// **PHASE 2.5:** Check if modal would appear (updated for new break system)
function checkModalEligibility(data) {
  const today = getDateString(0);
  const currentStreak = data.streak?.current || 0;
  const brokenAt = data.streak?.brokenAt;
  const bestStreak = data.streak?.best || 0;
  const userXP = data.xp?.total || 0;

  // Phase 2.5: Modal shows when streak is BROKEN (current = 0) and can be saved
  const isBroken = currentStreak === 0;
  const hasBrokenAt = !!brokenAt;
  const hasStreakToRestore = bestStreak > 0;

  const daysSinceBreak = brokenAt ? daysBetween(brokenAt.split('T')[0], today) : 0;
  const withinWindow = daysSinceBreak >= 1 && daysSinceBreak <= 3; // Save window is 1-3 days AFTER break
  const cost = withinWindow ? 25 * daysSinceBreak : null;
  const canAfford = cost !== null && userXP >= cost;

  return {
    wouldShow: isBroken && hasBrokenAt && hasStreakToRestore && withinWindow && canAfford,
    isBroken,
    hasBrokenAt,
    hasStreakToRestore,
    daysSinceBreak,
    withinWindow,
    cost,
    canAfford,
    reasons: {
      notBroken: !isBroken,
      noBrokenAt: !hasBrokenAt,
      noStreakToRestore: !hasStreakToRestore,
      beyondWindow: hasBrokenAt && !withinWindow,
      insufficientXP: withinWindow && !canAfford
    }
  };
}

// Display current streak status (PHASE 2.5: Updated for break system)
async function displayStatus() {
  const data = await getUserData();
  if (!data) return;

  const today = getDateString(0);
  const lastActivity = data.dates?.lastActivityDate || 'Never';
  const currentStreak = data.streak?.current || 0;
  const bestStreak = data.streak?.best || 0;
  const brokenAt = data.streak?.brokenAt;
  const saveCount = data.metadata?.streakSaveCount || 0;
  const yesterday = getDateString(-1);

  // Phase 2.5: Calculate days since activity AND days since break
  const daysSinceActivity = lastActivity !== 'Never' ? daysBetween(lastActivity, today) : 0;
  const daysSinceBreak = brokenAt ? daysBetween(brokenAt.split('T')[0], today) : 0;
  const isBroken = currentStreak === 0 && brokenAt;

  console.log('\n' + '='.repeat(80));
  console.log('🔥 STREAK STATUS (Phase 2.5)');
  console.log('='.repeat(80));
  console.log(`User ID: ${userId}`);
  console.log(`Email: ${data.email || 'N/A'}`);
  console.log();
  console.log('📊 CURRENT DATA:');
  console.log(`  Streak: ${currentStreak} days (Best: ${bestStreak})`);
  console.log(`  XP: ${data.xp?.total || 0} (Level ${data.xp?.level || 1})`);
  console.log(`  Last Activity: ${formatDate(lastActivity)}`);
  console.log(`  Broken At: ${brokenAt ? formatDate(brokenAt.split('T')[0]) : 'Not broken'}`);
  console.log(`  Today: ${formatDate(today)}`);
  console.log(`  Streak Saves Used: ${saveCount}`);
  console.log();
  console.log('⏰ TIME STATUS (Phase 2.5):');
  console.log(`  Days since last activity: ${daysSinceActivity} days`);
  if (brokenAt) {
    console.log(`  Days since break: ${daysSinceBreak} days`);
  }
  console.log(`  Status: ${isBroken ? '💀 BROKEN' : currentStreak > 0 ? '✅ ACTIVE' : '🆕 NEW'}`);
  console.log(`  Grace period: ${daysSinceActivity <= 1 ? '✅ Within (0-1 days)' : '❌ Expired'}`);

  if (isBroken) {
    const withinSaveWindow = daysSinceBreak >= 1 && daysSinceBreak <= 3;
    console.log(`  Save window: ${withinSaveWindow ? '✅ Can save (1-3 days after break)' : daysSinceBreak > 3 ? '❌ Too late (>3 days)' : daysSinceBreak < 1 ? 'ℹ️ Same day as break' : 'N/A'}`);
  }

  // Phase 2.5: Modal eligibility check
  const eligibility = checkModalEligibility(data);
  console.log();
  console.log('🪟 MODAL WOULD APPEAR (Phase 2.5):');
  console.log(`  ${eligibility.wouldShow ? '✅ YES' : '❌ NO'}`);
  if (!eligibility.wouldShow) {
    const reasons = [];
    if (eligibility.reasons.notBroken) reasons.push('Streak not broken (current > 0)');
    if (eligibility.reasons.noBrokenAt) reasons.push('No brokenAt timestamp');
    if (eligibility.reasons.noStreakToRestore) reasons.push('No streak to restore (best = 0)');
    if (eligibility.reasons.beyondWindow) reasons.push(`Beyond save window (${daysSinceBreak} days > 3)`);
    if (eligibility.reasons.insufficientXP) reasons.push('Insufficient XP');
    console.log(`  Reasons: ${reasons.join(', ')}`);
  }

  if (eligibility.withinWindow && eligibility.cost) {
    console.log();
    console.log('💰 SAVE COST:');
    console.log(`  Cost to save: ${eligibility.cost} XP (25 × ${daysSinceBreak} days since break)`);
    console.log(`  Can afford: ${eligibility.canAfford ? '✅ Yes' : '❌ No'}`);
    console.log(`  Remaining after save: ${Math.max(0, data.xp?.total - eligibility.cost)} XP`);
    console.log(`  Would restore to: ${bestStreak} days`);
    console.log(`  New lastActivityDate would be: ${yesterday}`);
    console.log(`  Time until grace expires: ~20 hours after save`);
  }

  console.log('='.repeat(80));
}

// Set last activity date
async function setLastActivityDate(dateString) {
  const userStatsRef = db.collection('user_stats').doc(userId);

  await userStatsRef.update({
    'dates.lastActivityDate': dateString,
    'dates.isActiveToday': dateString === getDateString(0),
    'metadata.lastUpdated': new Date().toISOString()
  });

  console.log(`✅ Set last activity date to: ${dateString}`);
}

// Modify XP
async function modifyXP(amount) {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const doc = await userStatsRef.get();
  const currentXP = doc.data().xp?.total || 0;
  const newXP = Math.max(0, currentXP + amount);
  const newLevel = Math.max(1, Math.floor(newXP / 1000));

  await userStatsRef.update({
    'xp.total': newXP,
    'xp.level': newLevel,
    'metadata.lastUpdated': new Date().toISOString()
  });

  console.log(`✅ XP: ${currentXP} → ${newXP} (${amount >= 0 ? '+' : ''}${amount})`);
  console.log(`   Level: ${newLevel}`);
}

// **NEW:** Set XP to exact amount
async function setXP(amount) {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const newXP = Math.max(0, amount);
  const newLevel = Math.max(1, Math.floor(newXP / 1000));

  await userStatsRef.update({
    'xp.total': newXP,
    'xp.level': newLevel,
    'metadata.lastUpdated': new Date().toISOString()
  });

  console.log(`✅ XP set to: ${newXP}`);
  console.log(`   Level: ${newLevel}`);
}

// Modify streak
async function modifyStreak(current, best = null) {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const doc = await userStatsRef.get();
  const currentStreak = doc.data().streak?.current || 0;
  const currentBest = doc.data().streak?.best || 0;
  const newBest = best !== null ? best : Math.max(currentBest, current);

  await userStatsRef.update({
    'streak.current': current,
    'streak.best': newBest,
    'streak.version': admin.firestore.FieldValue.increment(1),
    'metadata.lastUpdated': new Date().toISOString()
  });

  console.log(`✅ Streak: ${currentStreak} → ${current} days`);
  console.log(`   Best: ${newBest} days`);
}

// Reset streak to 0
async function resetStreak() {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const doc = await userStatsRef.get();
  const best = doc.data().streak?.best || 0;

  await userStatsRef.update({
    'streak.current': 0,
    'streak.brokenAt': null,
    'streak.version': admin.firestore.FieldValue.increment(1),
    'dates.lastActivityDate': null,
    'dates.isActiveToday': false,
    'metadata.lastUpdated': new Date().toISOString()
  });

  console.log(`✅ Streak reset to 0 (Best preserved: ${best})`);
}

// **PHASE 2.5:** Manually break streak (simulates auto-break)
async function breakStreak() {
  const userStatsRef = db.collection('user_stats').doc(userId);
  const doc = await userStatsRef.get();
  const data = doc.data();
  const currentStreak = data.streak?.current || 0;

  if (currentStreak === 0) {
    console.log('❌ Streak is already 0 (already broken)');
    return;
  }

  const now = new Date().toISOString();
  await userStatsRef.update({
    'streak.current': 0,
    'streak.brokenAt': now,
    'streak.version': admin.firestore.FieldValue.increment(1),
    'metadata.lastUpdated': now
  });

  console.log(`✅ Streak broken: ${currentStreak} → 0`);
  console.log(`   brokenAt: ${now}`);
  console.log(`   Best preserved: ${data.streak?.best || 0}`);
}

// **PHASE 2.5:** Simulate saving streak (what the API would do)
async function simulateSave() {
  const data = await getUserData();
  const eligibility = checkModalEligibility(data);

  if (!eligibility.wouldShow) {
    console.log('❌ Cannot simulate save - modal would not appear');
    console.log(`   Reason: ${Object.entries(eligibility.reasons).filter(([_, v]) => v).map(([k, _]) => k).join(', ')}`);
    return;
  }

  const cost = eligibility.cost;
  const currentXP = data.xp?.total || 0;
  const bestStreak = data.streak?.best || 0;
  const newXP = currentXP - cost;
  const newLevel = Math.max(1, Math.floor(newXP / 1000));
  const yesterday = getDateString(-1);

  console.log('\n🔄 SIMULATING STREAK SAVE (Phase 2.5)...');
  console.log(`  Current XP: ${currentXP}`);
  console.log(`  Cost: ${cost}`);
  console.log(`  New XP: ${newXP}`);
  console.log(`  New Level: ${newLevel}`);
  console.log(`  Restoring streak: 0 → ${bestStreak} days`);
  console.log(`  Clearing brokenAt timestamp`);
  console.log(`  New lastActivityDate: ${yesterday}`);

  const confirm = await question('Apply this change? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled');
    return;
  }

  const userStatsRef = db.collection('user_stats').doc(userId);
  await userStatsRef.update({
    'xp.total': newXP,
    'xp.level': newLevel,
    'dates.lastActivityDate': yesterday,
    'dates.isActiveToday': false,
    'streak.current': bestStreak,              // RESTORE streak
    'streak.brokenAt': null,                   // CLEAR brokenAt
    'streak.version': admin.firestore.FieldValue.increment(1),
    'metadata.lastUpdated': new Date().toISOString(),
    'metadata.streakSaveCount': admin.firestore.FieldValue.increment(1)
  });

  console.log('✅ Streak save simulated successfully!');
  console.log(`   Streak restored to ${bestStreak} days`);
}

// Quick test scenarios
async function applyScenario(scenarioId) {
  switch (scenarioId) {
    case '1': // Active streak (yesterday)
      await setLastActivityDate(getDateString(-1));
      console.log('📍 Scenario: Active streak (within grace period)');
      break;

    case '2': // Breaking - 2 days (can save)
      await setLastActivityDate(getDateString(-2));
      console.log('📍 Scenario: Breaking streak - 2 days ago (can save for 50 XP)');
      break;

    case '3': // Breaking - 3 days (last chance)
      await setLastActivityDate(getDateString(-3));
      console.log('📍 Scenario: Breaking streak - 3 days ago (last chance to save for 75 XP)');
      break;

    case '4': // Too late - 5 days
      await setLastActivityDate(getDateString(-5));
      console.log('📍 Scenario: Too late - 5 days ago (cannot save)');
      break;

    case '5': // Active today
      await setLastActivityDate(getDateString(0));
      console.log('📍 Scenario: Active today (no action needed)');
      break;

    case '6': // Setup for save test (good streak + 2 days + enough XP)
      await setLastActivityDate(getDateString(-2));
      await modifyStreak(7);
      await setXP(200); // **IMPROVED:** Set exact XP instead of adding
      console.log('📍 Scenario: Perfect save test (7-day streak breaking, 2 days ago, 200 XP)');
      break;

    case '7': // Setup for insufficient XP test
      await setLastActivityDate(getDateString(-3));
      await modifyStreak(5);
      await setXP(50); // **IMPROVED:** Set to 50 XP (need 75)
      console.log('📍 Scenario: Insufficient XP (5-day streak, 3 days late, only 50 XP, need 75)');
      break;

    case '8': // **NEW:** Exactly enough XP
      await setLastActivityDate(getDateString(-2));
      await modifyStreak(10);
      await setXP(50); // Exactly 50 for day 2
      console.log('📍 Scenario: Exactly enough XP (10-day streak, 2 days late, exactly 50 XP)');
      break;

    case '9': // **NEW:** Just after save (yesterday)
      await setLastActivityDate(getDateString(-1));
      await modifyStreak(10);
      await setXP(50); // Reduced after save
      console.log('📍 Scenario: Just saved (yesterday, reduced XP, ~20hr to act)');
      break;

    case '10': // **NEW:** On grace period boundary
      await setLastActivityDate(getDateString(-1));
      await modifyStreak(5);
      await setXP(100);
      console.log('📍 Scenario: Grace boundary (exactly 1 day ago, still safe)');
      break;
  }
}

// View full user data
async function viewFullData() {
  const data = await getUserData();
  if (!data) return;

  console.log('\n' + '='.repeat(80));
  console.log('📄 FULL USER DATA');
  console.log('='.repeat(80));
  console.log(JSON.stringify(data, null, 2));
  console.log('='.repeat(80));
}

// **NEW:** View streak save logs
async function viewSaveLogs() {
  const logs = await db.collection('streak_save_logs')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log('\n' + '='.repeat(80));
  console.log('📝 STREAK SAVE LOGS (Last 10)');
  console.log('='.repeat(80));

  if (logs.empty) {
    console.log('No save logs found');
  } else {
    logs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n${idx + 1}. ${data.createdAt}`);
      console.log(`   Streak Saved: ${data.streakSaved} days`);
      console.log(`   XP: ${data.xpBefore} → ${data.xpAfter} (-${data.xpDeducted})`);
      console.log(`   Days Late: ${data.daysSinceActivity}`);
      console.log(`   Cost: ${data.costBreakdown?.totalCost} XP`);
      console.log(`   Date: ${data.lastActivityBefore} → ${data.lastActivityAfter}`);
    });
  }

  console.log('='.repeat(80));
}

// Main menu
async function showMenu() {
  console.log('\n' + '='.repeat(80));
  console.log('🕐 STREAK TIME TRAVEL CONSOLE (Enhanced)');
  console.log('='.repeat(80));
  console.log();
  console.log('📊 STATUS & VIEWING:');
  console.log('  1. View current streak status');
  console.log('  2. View full user data');
  console.log('  3. View streak save logs (NEW)');
  console.log();
  console.log('⏰ TIME TRAVEL:');
  console.log('  4. Set last activity to TODAY');
  console.log('  5. Set last activity to YESTERDAY');
  console.log('  6. Set last activity to N days ago');
  console.log('  7. Set last activity to SPECIFIC DATE (YYYY-MM-DD)');
  console.log();
  console.log('💰 MODIFY DATA:');
  console.log('  8. Add/subtract XP');
  console.log('  9. Set XP to exact amount (NEW)');
  console.log('  10. Set streak count');
  console.log('  11. Reset streak to 0');
  console.log();
  console.log('💾 SNAPSHOT & RESTORE:');
  console.log('  12. Create snapshot (NEW)');
  console.log('  13. Restore snapshot (NEW)');
  console.log();
  console.log('🧪 SIMULATION:');
  console.log('  14. Simulate streak save (NEW)');
  console.log();
  console.log('🎬 QUICK TEST SCENARIOS:');
  console.log('  s1. Active streak (1 day ago - within grace)');
  console.log('  s2. Breaking - 2 days (can save for 50 XP)');
  console.log('  s3. Breaking - 3 days (last chance, 75 XP)');
  console.log('  s4. Too late - 5 days (cannot save)');
  console.log('  s5. Active today');
  console.log('  s6. Perfect save test (7-day streak, 2 days late, 200 XP)');
  console.log('  s7. Insufficient XP test (50 XP, need 75)');
  console.log('  s8. Exactly enough XP (NEW)');
  console.log('  s9. Just after save (NEW)');
  console.log('  s10. Grace boundary test (NEW)');
  console.log();
  console.log('  0. Exit');
  console.log('='.repeat(80));
}

// Main interactive loop
async function main() {
  console.log('\n🔥 MOSHIMOSHI STREAK TIME TRAVEL TOOL (Enhanced)');
  console.log(`Testing user: ${userId}\n`);

  // Show initial status
  await displayStatus();

  let running = true;

  while (running) {
    await showMenu();
    const choice = await question('\nEnter your choice: ');

    try {
      switch (choice.trim()) {
        case '0':
          running = false;
          console.log('\n👋 Goodbye!');
          break;

        case '1':
          await displayStatus();
          break;

        case '2':
          await viewFullData();
          break;

        case '3':
          await viewSaveLogs();
          break;

        case '4':
          await setLastActivityDate(getDateString(0));
          await displayStatus();
          break;

        case '5':
          await setLastActivityDate(getDateString(-1));
          await displayStatus();
          break;

        case '6':
          const days = await question('How many days ago? ');
          const daysInt = parseInt(days);
          if (isNaN(daysInt)) {
            console.log('❌ Invalid number');
          } else {
            await setLastActivityDate(getDateString(-Math.abs(daysInt)));
            await displayStatus();
          }
          break;

        case '7':
          const dateStr = await question('Enter date (YYYY-MM-DD): ');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            console.log('❌ Invalid format. Use YYYY-MM-DD');
          } else {
            await setLastActivityDate(dateStr);
            await displayStatus();
          }
          break;

        case '8':
          const xpChange = await question('XP to add (negative to subtract): ');
          const xpInt = parseInt(xpChange);
          if (isNaN(xpInt)) {
            console.log('❌ Invalid number');
          } else {
            await modifyXP(xpInt);
            await displayStatus();
          }
          break;

        case '9':
          const xpSet = await question('Set XP to: ');
          const xpSetInt = parseInt(xpSet);
          if (isNaN(xpSetInt) || xpSetInt < 0) {
            console.log('❌ Invalid number');
          } else {
            await setXP(xpSetInt);
            await displayStatus();
          }
          break;

        case '10':
          const newStreak = await question('New streak count: ');
          const streakInt = parseInt(newStreak);
          if (isNaN(streakInt) || streakInt < 0) {
            console.log('❌ Invalid number');
          } else {
            await modifyStreak(streakInt);
            await displayStatus();
          }
          break;

        case '11':
          const confirm = await question('Reset streak to 0? (yes/no): ');
          if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
            await resetStreak();
            await displayStatus();
          } else {
            console.log('❌ Cancelled');
          }
          break;

        case '12':
          await createSnapshot();
          break;

        case '13':
          await restoreSnapshot();
          await displayStatus();
          break;

        case '14':
          await simulateSave();
          await displayStatus();
          break;

        case 's1':
        case 's2':
        case 's3':
        case 's4':
        case 's5':
        case 's6':
        case 's7':
        case 's8':
        case 's9':
        case 's10':
          const scenarioNum = choice.substring(1);
          await applyScenario(scenarioNum);
          await displayStatus();
          break;

        default:
          console.log('❌ Invalid choice');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }

    if (running) {
      await question('\nPress Enter to continue...');
    }
  }

  rl.close();
  process.exit(0);
}

// Run the interactive tool
main().catch(console.error);
