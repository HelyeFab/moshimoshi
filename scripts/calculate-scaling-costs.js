/**
 * Calculate Firebase costs at scale
 */

console.log('=== Firebase Scaling Cost Analysis ===\n');

// Current usage
const currentStorageMB = 1673;
const currentUsers = 1;

console.log('CURRENT STATE:');
console.log(`  Users: ${currentUsers}`);
console.log(`  Storage: ${currentStorageMB} MB (${(currentStorageMB/1024).toFixed(2)} GB)`);
console.log('');

// Projections
const scenarios = [
  { users: 10, avgStorageMB: 500 },
  { users: 50, avgStorageMB: 500 },
  { users: 100, avgStorageMB: 500 },
  { users: 100, avgStorageMB: 1000 }, // Heavy users
  { users: 500, avgStorageMB: 500 },
  { users: 1000, avgStorageMB: 500 },
];

console.log('SCALING SCENARIOS:\n');

scenarios.forEach(scenario => {
  const totalGB = (scenario.users * scenario.avgStorageMB) / 1024;
  const overFreeTier = Math.max(0, totalGB - 5); // 5 GB free

  // Firebase Storage pricing
  const storageCost = overFreeTier * 0.026; // $0.026/GB/month

  // Assume 10 GB bandwidth per user per month (downloads)
  const bandwidthGB = scenario.users * 10;
  const bandwidthOverFree = Math.max(0, bandwidthGB - 30); // 30 GB free/month (1GB/day × 30)
  const bandwidthCost = bandwidthOverFree * 0.12; // $0.12/GB

  // Firestore costs (if we fix the architecture)
  // Assume 10k reads, 1k writes per user per month
  const reads = scenario.users * 10000;
  const writes = scenario.users * 1000;
  const firestoreReadCost = Math.max(0, reads - 50000) / 100000 * 0.06; // $0.06 per 100k reads after 50k free
  const firestoreWriteCost = Math.max(0, writes - 20000) / 100000 * 0.18; // $0.18 per 100k writes after 20k free
  const firestoreCost = firestoreReadCost + firestoreWriteCost;

  const totalMonthlyCost = storageCost + bandwidthCost + firestoreCost;
  const costPerUser = totalMonthlyCost / scenario.users;

  console.log(`${scenario.users} users × ${scenario.avgStorageMB} MB avg:`);
  console.log(`  Total storage: ${totalGB.toFixed(2)} GB`);
  console.log(`  Storage cost: $${storageCost.toFixed(2)}/month`);
  console.log(`  Bandwidth cost: $${bandwidthCost.toFixed(2)}/month`);
  console.log(`  Firestore cost: $${firestoreCost.toFixed(2)}/month`);
  console.log(`  TOTAL: $${totalMonthlyCost.toFixed(2)}/month ($${costPerUser.toFixed(2)}/user)`);
  console.log('');
});

console.log('CRITICAL INSIGHTS:\n');
console.log('1. At 100 users: ~$50-100/month in Firebase costs');
console.log('2. At 1000 users: ~$500-1000/month in Firebase costs');
console.log('3. If premium is $10/month, you need 50-100% just for Firebase!');
console.log('');

console.log('BUSINESS REALITY:\n');
console.log('❌ Current approach: Store all user Anki decks in Firebase');
console.log('   - Not scalable');
console.log('   - Costs eat into revenue');
console.log('   - Hit Firestore limits');
console.log('');

console.log('✅ BETTER APPROACHES:\n');
console.log('');
console.log('Option 1: LOCAL-ONLY for imported Anki decks');
console.log('  - Store in IndexedDB only');
console.log('  - No Firebase sync');
console.log('  - Cost: $0');
console.log('  - Tradeoff: No cross-device sync');
console.log('');

console.log('Option 2: HYBRID - Metadata only');
console.log('  - Deck metadata in Firestore (~10 KB)');
console.log('  - Cards in IndexedDB (local)');
console.log('  - Media in Firebase Storage (if premium)');
console.log('  - Cost: ~$1-5/month per 100 users');
console.log('  - Tradeoff: Cards don\'t sync, media does');
console.log('');

console.log('Option 3: PAID STORAGE add-on');
console.log('  - Free tier: Local only');
console.log('  - Premium: Sync up to 1 GB ($2-5/month extra)');
console.log('  - Power users: Unlimited ($10-20/month)');
console.log('  - Cost: Covered by pricing');
console.log('');

console.log('Option 4: COMPRESSION + LIMITS');
console.log('  - Compress cards before storing');
console.log('  - Limit: 1000 cards max per deck for sync');
console.log('  - Larger decks: Local only');
console.log('  - Cost: Manageable');
console.log('');

console.log('RECOMMENDATION:');
console.log('For sustainable business at scale:');
console.log('→ Use Option 1 (Local-only) for imported Anki decks');
console.log('→ Premium feature: Cloud sync for NATIVE flashcards only');
console.log('→ This keeps costs predictable and sustainable');
