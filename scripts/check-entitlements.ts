/**
 * Check Entitlements Script
 *
 * Usage:
 *   npx tsx scripts/check-entitlements.ts --user-id=<userId>
 *   npx tsx scripts/check-entitlements.ts --email=<email>
 *
 * Examples:
 *   npx tsx scripts/check-entitlements.ts --user-id=5NNDhMn8wBXDQQ0aOFpR6M557ju1
 *   npx tsx scripts/check-entitlements.ts --email=user@example.com
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require('../moshimoshi-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.warn('No service account file found, using application default credentials');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const userIdArg = args.find(a => a.startsWith('--user-id='));
const emailArg = args.find(a => a.startsWith('--email='));
const userId = userIdArg ? userIdArg.split('=')[1] : null;
const email = emailArg ? emailArg.split('=')[1] : null;

interface UsageData {
  features: Record<string, number>;
  updatedAt: any;
  hasOldSchema: boolean;
}

interface UserData {
  subscription?: {
    plan?: string;
    status?: string;
  };
  tier?: string;
}

async function getUserIdFromEmail(email: string): Promise<string> {
  console.log(`\n🔍 Looking up user by email: ${email}`);

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.uid}\n`);
    return userRecord.uid;
  } catch (error) {
    if ((error as any).code === 'auth/user-not-found') {
      throw new Error(`User not found with email: ${email}`);
    }
    throw error;
  }
}

async function checkEntitlements(userId: string): Promise<void> {
  console.log('\n===========================================');
  console.log('🔍 ENTITLEMENT CHECK');
  console.log('===========================================\n');
  console.log(`User ID: ${userId}\n`);

  try {
    // 1. Get user subscription/tier
    console.log('📊 SUBSCRIPTION STATUS');
    console.log('-------------------------------------------');
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('❌ User not found in Firestore');
      return;
    }

    const userData = userDoc.data() as UserData;
    const tier = userData?.subscription?.plan || userData?.tier || 'free';
    const status = userData?.subscription?.status || 'active';

    console.log(`Tier: ${tier}`);
    console.log(`Status: ${status}`);
    console.log('');

    // 2. Get all usage documents
    console.log('📈 USAGE COUNTS');
    console.log('-------------------------------------------');

    const usageSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('usage')
      .get();

    if (usageSnapshot.empty) {
      console.log('ℹ️  No usage data found');
      console.log('');
      return;
    }

    // Organize usage by date
    const usageByDate: Record<string, UsageData> = {};
    const schemaIssues: Array<{ date: string; type: string }> = [];

    usageSnapshot.forEach((doc) => {
      const date = doc.id;
      const data = doc.data();

      // Extract feature counts (skip metadata fields)
      const features: Record<string, number> = {};
      let hasOldSchema = false;

      Object.keys(data).forEach((key) => {
        if (key === 'userId' || key === 'date' || key === 'updatedAt') {
          // Skip metadata
          return;
        }

        if (key === 'counts' && typeof data[key] === 'object') {
          // OLD SCHEMA: counts object exists
          hasOldSchema = true;
          schemaIssues.push({ date, type: 'old_counts_schema' });
          // Extract from counts object
          Object.keys(data.counts).forEach((feature) => {
            features[feature] = data.counts[feature];
          });
        } else if (key === 'lastUpdated') {
          // Metadata field, skip
          return;
        } else {
          // NEW SCHEMA: top-level feature counts
          features[key] = data[key];
        }
      });

      if (Object.keys(features).length > 0) {
        usageByDate[date] = {
          features,
          updatedAt: data.updatedAt,
          hasOldSchema
        };
      }
    });

    // Sort dates (most recent first)
    const sortedDates = Object.keys(usageByDate).sort().reverse();

    // Display usage for each date
    sortedDates.forEach((date, index) => {
      const usage = usageByDate[date];
      const isToday = date === getTodayBucket();
      const isThisMonth = date.startsWith(getCurrentMonth());

      let dateLabel = date;
      if (isToday) dateLabel += ' (TODAY)';
      else if (isThisMonth) dateLabel += ' (THIS MONTH)';
      if (usage.hasOldSchema) dateLabel += ' ⚠️  OLD SCHEMA';

      console.log(`\n${dateLabel}`);
      console.log(`Updated: ${usage.updatedAt || 'N/A'}`);
      console.log('─'.repeat(45));

      // Sort features alphabetically
      const features = Object.keys(usage.features).sort();

      features.forEach((feature) => {
        const count = usage.features[feature];
        console.log(`  ${feature.padEnd(35)} ${String(count).padStart(5)}`);
      });

      // Only show first 3 dates to avoid clutter
      if (index === 2 && sortedDates.length > 3) {
        console.log(`\n... and ${sortedDates.length - 3} more dates`);
        return;
      }
    });

    console.log('\n');

    // 3. Schema warnings
    if (schemaIssues.length > 0) {
      console.log('⚠️  SCHEMA ISSUES DETECTED');
      console.log('-------------------------------------------');
      console.log(`Found ${schemaIssues.length} documents using old "counts" schema:`);
      schemaIssues.forEach((issue) => {
        console.log(`  - ${issue.date}`);
      });
      console.log('\nThese documents should be migrated to top-level feature counts.');
      console.log('Run migration script or re-sync from client.\n');
    }

    // 4. Summary statistics
    console.log('📊 SUMMARY');
    console.log('-------------------------------------------');

    const todayDate = getTodayBucket(); // e.g., "2026-01-13"
    const thisMonth = getCurrentMonth(); // e.g., "2026-01"

    // Aggregate usage by extracting dates from bucket keys
    const todayUsage: Record<string, number> = {};
    const monthlyUsage: Record<string, number> = {};

    sortedDates.forEach((bucketKey) => {
      const features = usageByDate[bucketKey].features;

      // Extract date from bucket key (everything after last underscore)
      const parts = bucketKey.split('_');
      const datePart = parts[parts.length - 1];

      // Check if this bucket is for today
      if (datePart === todayDate) {
        Object.keys(features).forEach((feature) => {
          todayUsage[feature] = (todayUsage[feature] || 0) + features[feature];
        });
      }

      // Check if this bucket is for this month
      if (datePart.startsWith(thisMonth)) {
        Object.keys(features).forEach((feature) => {
          monthlyUsage[feature] = (monthlyUsage[feature] || 0) + features[feature];
        });
      }
    });

    console.log(`\nToday (${todayDate}):`);
    if (Object.keys(todayUsage).length === 0) {
      console.log('  No usage today');
    } else {
      Object.keys(todayUsage).sort().forEach((feature) => {
        console.log(`  ${feature}: ${todayUsage[feature]}`);
      });
    }

    console.log(`\nThis Month (${thisMonth}):`);
    if (Object.keys(monthlyUsage).length === 0) {
      console.log('  No usage this month');
    } else {
      Object.keys(monthlyUsage).sort().forEach((feature) => {
        console.log(`  ${feature}: ${monthlyUsage[feature]}`);
      });
    }

    console.log('\n===========================================\n');

  } catch (error) {
    console.error('❌ Error checking entitlements:', error);
    throw error;
  }
}

// Helper functions
function getTodayBucket(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Main execution
async function main() {
  if (!userId && !email) {
    console.error('❌ Error: Must provide either --user-id or --email parameter');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/check-entitlements.ts --user-id=<userId>');
    console.log('  npx tsx scripts/check-entitlements.ts --email=<email>');
    process.exit(1);
  }

  let targetUserId = userId;

  if (email) {
    targetUserId = await getUserIdFromEmail(email);
  }

  if (!targetUserId) {
    console.error('❌ Error: Could not determine user ID');
    process.exit(1);
  }

  await checkEntitlements(targetUserId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
