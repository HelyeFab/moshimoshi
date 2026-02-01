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

// Launch date: January 23, 2026
const LAUNCH_DATE = new Date('2026-01-23T00:00:00.000Z');
const TODAY = new Date('2026-02-02T00:00:00.000Z'); // End of Feb 1
const MIN_RETURN_GAP_MS = 86400000; // 24 hours

async function checkLaunchRetention() {
  console.log('='.repeat(80));
  console.log('🚀 POST-LAUNCH RETENTION ANALYSIS (Jan 23 - Feb 1, 2026)');
  console.log('='.repeat(80));
  console.log('Launch date: January 23, 2026');
  console.log('Analysis period: 10 days since launch');
  console.log('Return threshold: 24 hours after signup\n');

  const usersSnapshot = await db.collection('users')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(LAUNCH_DATE))
    .where('createdAt', '<', admin.firestore.Timestamp.fromDate(TODAY))
    .orderBy('createdAt', 'asc')
    .get();

  console.log('📊 Total signups since launch: ' + usersSnapshot.size + '\n');

  // Group by signup date
  const byDate = {};
  const returning = [];
  const notReturned = [];

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.();
    const lastActive = data.lastActive?.toDate?.();

    const signupDate = createdAt.toISOString().split('T')[0];
    if (!byDate[signupDate]) {
      byDate[signupDate] = { total: 0, returned: 0, notReturned: 0, premium: 0 };
    }
    byDate[signupDate].total++;

    const gap = lastActive && createdAt ? lastActive - createdAt : 0;
    const gapDays = gap / 86400000;
    const isPremium = data.subscription?.plan && data.subscription.plan !== 'free';

    if (isPremium) byDate[signupDate].premium++;

    const user = {
      email: data.email || 'Unknown',
      displayName: data.displayName || 'Unknown',
      createdAt,
      lastActive,
      gapDays: gapDays.toFixed(1),
      plan: data.subscription?.plan || 'free',
      signupDate
    };

    if (gap >= MIN_RETURN_GAP_MS) {
      returning.push(user);
      byDate[signupDate].returned++;
    } else {
      notReturned.push(user);
      byDate[signupDate].notReturned++;
    }
  }

  // Daily cohort breakdown
  console.log('='.repeat(80));
  console.log('📅 DAILY COHORT BREAKDOWN');
  console.log('='.repeat(80));
  console.log('Date        | Signups | Returned | Not Returned | Retention | Premium');
  console.log('-'.repeat(80));

  const sortedDates = Object.keys(byDate).sort();
  sortedDates.forEach(date => {
    const d = byDate[date];
    const retention = ((d.returned / d.total) * 100).toFixed(1);
    const dateStr = date.padEnd(11);
    const signups = String(d.total).padStart(7);
    const ret = String(d.returned).padStart(8);
    const notRet = String(d.notReturned).padStart(12);
    const retPct = (retention + '%').padStart(9);
    const premium = String(d.premium).padStart(7);
    console.log(dateStr + ' |' + signups + ' |' + ret + ' |' + notRet + ' |' + retPct + ' |' + premium);
  });

  // Top returning users
  returning.sort((a, b) => parseFloat(b.gapDays) - parseFloat(a.gapDays));

  console.log('\n' + '='.repeat(80));
  console.log('🏆 TOP 15 MOST ENGAGED RETURNING USERS');
  console.log('='.repeat(80));

  returning.slice(0, 15).forEach((u, i) => {
    const created = u.createdAt.toISOString().split('T')[0];
    const lastSeen = u.lastActive.toISOString().split('T')[0];
    const planBadge = u.plan !== 'free' ? ' ⭐ ' + u.plan.toUpperCase() : '';
    console.log((i+1) + '. ' + u.displayName + ' (' + u.email + ')' + planBadge);
    console.log('   Signed up: ' + created + ' | Last seen: ' + lastSeen + ' | Active for: ' + u.gapDays + ' days');
  });

  // Premium users
  const premiumUsers = [...returning, ...notReturned].filter(u => u.plan !== 'free');
  console.log('\n' + '='.repeat(80));
  console.log('💎 PREMIUM SUBSCRIBERS (' + premiumUsers.length + ')');
  console.log('='.repeat(80));

  if (premiumUsers.length === 0) {
    console.log('No premium subscribers yet');
  } else {
    premiumUsers.forEach((u, i) => {
      const created = u.createdAt.toISOString().split('T')[0];
      const lastSeen = u.lastActive.toISOString().split('T')[0];
      const isReturning = parseFloat(u.gapDays) >= 1 ? '✅ Returning' : '⚠️ Not returned';
      console.log((i+1) + '. ' + u.displayName + ' (' + u.email + ')');
      console.log('   Plan: ' + u.plan + ' | Signed up: ' + created + ' | Last seen: ' + lastSeen + ' | ' + isReturning);
    });
  }

  // Summary
  const totalReturning = returning.length;
  const totalNotReturned = notReturned.length;
  const total = usersSnapshot.size;
  const retentionRate = ((totalReturning / total) * 100).toFixed(1);

  console.log('\n' + '='.repeat(80));
  console.log('📈 OVERALL RETENTION SUMMARY (Since Launch)');
  console.log('='.repeat(80));
  console.log('Total signups since Jan 23:  ' + total);
  console.log('Returned (24h+):             ' + totalReturning + ' (' + retentionRate + '%)');
  console.log('Not returned:                ' + totalNotReturned + ' (' + (100 - retentionRate).toFixed(1) + '%)');
  console.log('Premium subscribers:         ' + premiumUsers.length);
  console.log('\nDay 1 Retention Rate:        ' + retentionRate + '%');

  // Week over week if we have enough data
  const week1Start = new Date('2026-01-23');
  const week1End = new Date('2026-01-30');
  const week1Users = [...returning, ...notReturned].filter(u => u.createdAt >= week1Start && u.createdAt < week1End);
  const week1Returned = week1Users.filter(u => parseFloat(u.gapDays) >= 1).length;

  console.log('\nWeek 1 (Jan 23-29):          ' + week1Users.length + ' signups, ' + week1Returned + ' returned (' + ((week1Returned/week1Users.length)*100).toFixed(1) + '%)');

  process.exit(0);
}

checkLaunchRetention().catch(e => { console.error(e); process.exit(1); });
