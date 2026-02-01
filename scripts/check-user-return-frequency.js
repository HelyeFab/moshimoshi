const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();

// Launch date
const LAUNCH_DATE = new Date('2026-01-23T00:00:00.000Z');

async function checkReturnFrequency() {
  console.log('='.repeat(80));
  console.log('🔄 USER RETURN FREQUENCY ANALYSIS (Since Launch)');
  console.log('='.repeat(80));
  console.log('Counting unique days each user has visited the app\n');

  // Get all users since launch
  const usersSnapshot = await db.collection('users')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(LAUNCH_DATE))
    .get();

  console.log('Total users since launch: ' + usersSnapshot.size);
  console.log('Fetching page visits for each user...\n');

  const userStats = [];

  let processed = 0;
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Get all page visits for this user
    const visitsSnapshot = await db.collection('page_visits')
      .where('userId', '==', userId)
      .get();

    // Count unique days
    const uniqueDays = new Set();
    let totalPageViews = 0;

    visitsSnapshot.forEach(doc => {
      const data = doc.data();
      totalPageViews++;

      // Get the date from timestamp
      let dateStr = 'unknown';
      if (data.startedAt?._seconds) {
        dateStr = new Date(data.startedAt._seconds * 1000).toISOString().split('T')[0];
      } else if (data.createdAt?._seconds) {
        dateStr = new Date(data.createdAt._seconds * 1000).toISOString().split('T')[0];
      }
      if (dateStr !== 'unknown') {
        uniqueDays.add(dateStr);
      }
    });

    const createdAt = userData.createdAt?.toDate?.();
    const signupDate = createdAt ? createdAt.toISOString().split('T')[0] : 'unknown';

    userStats.push({
      email: userData.email || 'Unknown',
      displayName: userData.displayName || 'Unknown',
      signupDate,
      uniqueDaysVisited: uniqueDays.size,
      totalPageViews,
      plan: userData.subscription?.plan || 'free',
      daysVisited: Array.from(uniqueDays).sort()
    });

    processed++;
    if (processed % 50 === 0) {
      process.stdout.write('Processed ' + processed + '/' + usersSnapshot.size + ' users...\r');
    }
  }

  console.log('\n');

  // Sort by unique days visited (most engaged first)
  userStats.sort((a, b) => b.uniqueDaysVisited - a.uniqueDaysVisited);

  // Show top engaged users
  console.log('='.repeat(80));
  console.log('🏆 TOP 20 MOST ENGAGED USERS (by unique days visited)');
  console.log('='.repeat(80));
  console.log('Rank | Days | Views | Signup     | Name (Email)');
  console.log('-'.repeat(80));

  userStats.slice(0, 20).forEach((u, i) => {
    const rank = String(i + 1).padStart(4);
    const days = String(u.uniqueDaysVisited).padStart(4);
    const views = String(u.totalPageViews).padStart(5);
    const planBadge = u.plan !== 'free' ? ' ⭐' : '';
    console.log(rank + ' | ' + days + ' | ' + views + ' | ' + u.signupDate + ' | ' + u.displayName + ' (' + u.email + ')' + planBadge);
  });

  // Distribution of return visits
  console.log('\n' + '='.repeat(80));
  console.log('📊 RETURN FREQUENCY DISTRIBUTION');
  console.log('='.repeat(80));

  const distribution = {};
  userStats.forEach(u => {
    const days = u.uniqueDaysVisited;
    let bucket;
    if (days === 0) bucket = '0 days (no tracking)';
    else if (days === 1) bucket = '1 day only';
    else if (days === 2) bucket = '2 days';
    else if (days === 3) bucket = '3 days';
    else if (days <= 5) bucket = '4-5 days';
    else if (days <= 7) bucket = '6-7 days';
    else bucket = '8+ days';

    if (!distribution[bucket]) distribution[bucket] = 0;
    distribution[bucket]++;
  });

  const bucketOrder = ['0 days (no tracking)', '1 day only', '2 days', '3 days', '4-5 days', '6-7 days', '8+ days'];
  bucketOrder.forEach(bucket => {
    const count = distribution[bucket] || 0;
    const pct = ((count / userStats.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 10));
    console.log(bucket.padEnd(20) + ': ' + String(count).padStart(4) + ' users (' + pct.padStart(5) + '%) ' + bar);
  });

  // Summary stats
  const multiDayUsers = userStats.filter(u => u.uniqueDaysVisited >= 2).length;
  const weeklyUsers = userStats.filter(u => u.uniqueDaysVisited >= 5).length;
  const superUsers = userStats.filter(u => u.uniqueDaysVisited >= 7).length;

  console.log('\n' + '='.repeat(80));
  console.log('📈 ENGAGEMENT SUMMARY');
  console.log('='.repeat(80));
  console.log('Total users:           ' + userStats.length);
  console.log('Multi-day users (2+):  ' + multiDayUsers + ' (' + ((multiDayUsers/userStats.length)*100).toFixed(1) + '%)');
  console.log('Regular users (5+):    ' + weeklyUsers + ' (' + ((weeklyUsers/userStats.length)*100).toFixed(1) + '%)');
  console.log('Super users (7+):      ' + superUsers + ' (' + ((superUsers/userStats.length)*100).toFixed(1) + '%)');

  // Show users who visited 5+ days with their visit pattern
  console.log('\n' + '='.repeat(80));
  console.log('📅 REGULAR USERS (5+ days) - VISIT PATTERNS');
  console.log('='.repeat(80));

  userStats.filter(u => u.uniqueDaysVisited >= 5).forEach((u, i) => {
    const planBadge = u.plan !== 'free' ? ' ⭐ ' + u.plan.toUpperCase() : '';
    console.log('\n' + (i+1) + '. ' + u.displayName + ' (' + u.email + ')' + planBadge);
    console.log('   Days visited: ' + u.uniqueDaysVisited + ' | Total page views: ' + u.totalPageViews);
    console.log('   Dates: ' + u.daysVisited.join(', '));
  });

  process.exit(0);
}

checkReturnFrequency().catch(e => { console.error(e); process.exit(1); });
