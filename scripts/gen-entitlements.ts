/**
 * Entitlements Type Generator
 *
 * Generates TypeScript types and policy constants from features.v1.json
 *
 * Usage: npx tsx scripts/gen-entitlements.ts
 *
 * Outputs:
 *   - src/types/FeatureId.ts
 *   - src/lib/entitlements/policy.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// Paths
const CONFIG_PATH = path.join(process.cwd(), 'config', 'features.v1.json')
const FEATURE_ID_PATH = path.join(process.cwd(), 'src', 'types', 'FeatureId.ts')
const POLICY_PATH = path.join(process.cwd(), 'src', 'lib', 'entitlements', 'policy.ts')

interface Feature {
  id: string
  name: string
  category: string
  lifecycle: string
  permission: string
  limitType: string
  notifications: boolean
  description: string
  metadata?: Record<string, unknown>
}

interface FeaturesConfig {
  version: number
  features: Feature[]
  limits: Record<
    string,
    {
      daily?: Record<string, number>
      weekly?: Record<string, number>
      monthly?: Record<string, number>
    }
  >
}

function generateFeatureIdFile(config: FeaturesConfig): string {
  const timestamp = new Date().toISOString()
  const featureIds = config.features.map(f => f.id)

  return `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: ${timestamp}
 */

export type FeatureId = ${featureIds.map(id => `'${id}'`).join(' | ')};

export const FEATURE_IDS = [
${featureIds.map(id => `  '${id}'`).join(',\n')}
] as const;

export function isValidFeatureId(id: string): id is FeatureId {
  return FEATURE_IDS.includes(id as FeatureId);
}
`
}

function generatePolicyFile(config: FeaturesConfig): string {
  const timestamp = new Date().toISOString()
  const plans = Object.keys(config.limits)

  // Build PLAN_LIMITS object
  const planLimitsEntries = plans.map(plan => {
    const limits = config.limits[plan]
    const dailyStr = limits.daily
      ? `    "daily": ${JSON.stringify(limits.daily, null, 6).replace(/\n/g, '\n    ')}`
      : null
    const weeklyStr = limits.weekly
      ? `    "weekly": ${JSON.stringify(limits.weekly, null, 6).replace(/\n/g, '\n    ')}`
      : null
    const monthlyStr = limits.monthly
      ? `    "monthly": ${JSON.stringify(limits.monthly, null, 6).replace(/\n/g, '\n    ')}`
      : null

    const parts = [dailyStr, weeklyStr, monthlyStr].filter(Boolean)
    return `  "${plan}": {\n${parts.join(',\n')}\n  }`
  })

  return `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: ${timestamp}
 */

import type { FeatureId } from '@/types/FeatureId';
import type { PlanType } from '@/lib/access/permissionMap';

export const POLICY_VERSION = ${config.version};

export type LimitType = 'daily' | 'weekly' | 'monthly';

export interface PlanLimits {
  daily?: Partial<Record<FeatureId, number>>;
  weekly?: Partial<Record<FeatureId, number>>;
  monthly?: Partial<Record<FeatureId, number>>;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
${planLimitsEntries.join(',\n')}
};

export function getLimit(plan: PlanType, limitType: LimitType, featureId: FeatureId): number {
  const planLimits = PLAN_LIMITS[plan];
  if (!planLimits || !planLimits[limitType]) {
    return 0;
  }
  return planLimits[limitType][featureId] ?? 0;
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

export function getEffectiveLimit(
  planLimit: number,
  override?: number | 'unlimited',
  tenantCap?: number
): number {
  // Handle override
  if (override !== undefined) {
    if (override === 'unlimited') return -1;
    return override;
  }

  // If plan is unlimited, check tenant cap
  if (isUnlimited(planLimit)) {
    return tenantCap ?? -1;
  }

  // If tenant has a cap, use the minimum
  if (tenantCap !== undefined && !isUnlimited(tenantCap)) {
    return Math.min(planLimit, tenantCap);
  }

  return planLimit;
}

export function getResetTime(limitType: LimitType, fromDate: Date = new Date()): Date {
  const resetDate = new Date(fromDate);
  resetDate.setUTCHours(0, 0, 0, 0);

  switch (limitType) {
    case 'daily':
      resetDate.setUTCDate(resetDate.getUTCDate() + 1);
      break;
    case 'weekly':
      const daysUntilMonday = (8 - resetDate.getUTCDay()) % 7 || 7;
      resetDate.setUTCDate(resetDate.getUTCDate() + daysUntilMonday);
      break;
    case 'monthly':
      resetDate.setUTCMonth(resetDate.getUTCMonth() + 1);
      resetDate.setUTCDate(1);
      break;
  }

  return resetDate;
}

export function getBucketKey(limitType: LimitType, date: Date = new Date()): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  switch (limitType) {
    case 'daily':
      return \`\${year}-\${month}-\${day}\`;
    case 'weekly':
      const weekStart = new Date(d);
      weekStart.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const weekYear = weekStart.getUTCFullYear();
      const weekMonth = String(weekStart.getUTCMonth() + 1).padStart(2, '0');
      const weekDay = String(weekStart.getUTCDate()).padStart(2, '0');
      return \`\${weekYear}-W\${weekMonth}-\${weekDay}\`;
    case 'monthly':
      return \`\${year}-\${month}\`;
  }
}
`
}

async function main() {
  console.log('🔄 Generating entitlements types...')

  // Read config
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Config file not found: ${CONFIG_PATH}`)
    process.exit(1)
  }

  const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
  const config: FeaturesConfig = JSON.parse(configContent)

  console.log(`📖 Read config with ${config.features.length} features`)

  // Generate FeatureId.ts
  const featureIdContent = generateFeatureIdFile(config)
  fs.writeFileSync(FEATURE_ID_PATH, featureIdContent, 'utf-8')
  console.log(`✅ Generated: ${FEATURE_ID_PATH}`)

  // Generate policy.ts
  const policyContent = generatePolicyFile(config)
  fs.writeFileSync(POLICY_PATH, policyContent, 'utf-8')
  console.log(`✅ Generated: ${POLICY_PATH}`)

  console.log('')
  console.log('🎉 Entitlements types generated successfully!')
  console.log(`   Features: ${config.features.map(f => f.id).join(', ')}`)
}

main().catch(error => {
  console.error('❌ Generation failed:', error)
  process.exit(1)
})
