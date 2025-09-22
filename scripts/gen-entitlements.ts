#!/usr/bin/env node

/**
 * Entitlements Code Generator
 * Generates TypeScript types and registries from features.v1.json schema
 * 
 * Usage: npm run gen:entitlements
 * 
 * Generates:
 * - FeatureId type union
 * - Permission enum
 * - Features registry
 * - Entitlements policy
 */

import * as fs from 'fs';
import * as path from 'path';

// Types for the schema
interface Feature {
  id: string;
  name: string;
  category: string;
  lifecycle: 'active' | 'deprecated' | 'hidden';
  permission: string;
  limitType: 'daily' | 'weekly' | 'monthly';
  notifications: boolean;
  description?: string;
  metadata?: {
    contentType?: string;
    difficulty?: string;
    estimatedDuration?: string;
  };
}

interface PlanDefinition {
  displayName: string;
  description: string;
  stripePriceId: string | null;
  isDefault: boolean;
  order: number;
}

interface Schema {
  version: number;
  description: string;
  lastUpdated: string;
  plans: Record<string, PlanDefinition>;
  features: Feature[];
  limits: Record<string, Record<string, Record<string, number>>>;
  permissions: Record<string, string[]>;
  stripeMapping?: {
    priceToProduct: Record<string, string>;
    productToPlan: Record<string, string>;
  };
  metadata: {
    unlimitedValue: number;
    defaultPlan: string;
    guestPlan: string;
    premiumPlans: string[];
    freePlans: string[];
    allPlans: string[];
    resetTime: string;
    resetTimezone: string;
  };
}

// Load schema
const schemaPath = path.join(process.cwd(), 'config', 'features.v1.json');
const schema: Schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// Output directories
const typesDir = path.join(process.cwd(), 'src', 'types');
const libAccessDir = path.join(process.cwd(), 'src', 'lib', 'access');
const libFeaturesDir = path.join(process.cwd(), 'src', 'lib', 'features');
const libEntitlementsDir = path.join(process.cwd(), 'src', 'lib', 'entitlements');

// Ensure directories exist
[typesDir, libAccessDir, libFeaturesDir, libEntitlementsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 1. Generate FeatureId type union
function generateFeatureId() {
  const featureIds = schema.features.map(f => `'${f.id}'`).join(' | ');
  const content = `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: ${new Date().toISOString()}
 */

export type FeatureId = ${featureIds};

export const FEATURE_IDS = [
${schema.features.map(f => `  '${f.id}'`).join(',\n')}
] as const;

export function isValidFeatureId(id: string): id is FeatureId {
  return FEATURE_IDS.includes(id as FeatureId);
}
`;

  fs.writeFileSync(path.join(typesDir, 'FeatureId.ts'), content);
  console.log('✅ Generated: src/types/FeatureId.ts');
}

// 2. Generate Permission enum
function generatePermissionMap() {
  const uniquePermissions = [...new Set(schema.features.map(f => f.permission))];
  const planKeys = Object.keys(schema.plans);
  const content = `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: ${new Date().toISOString()}
 */

export enum Permission {
${uniquePermissions.map(p => `  ${p.toUpperCase()} = '${p}'`).join(',\n')}
}

export type PlanType = ${planKeys.map(p => `'${p}'`).join(' | ')};

export const PLAN_PERMISSIONS: Record<PlanType, Permission[]> = {
${planKeys.map(plan => {
  const perms = schema.permissions[plan] || [];
  const mappedPerms = perms.map(p => `Permission.${p.toUpperCase()}`).join(', ');
  return `  '${plan}': [${mappedPerms}]`;
}).join(',\n')}
};

export const PLAN_DEFINITIONS = ${JSON.stringify(schema.plans, null, 2)} as const;

export const STRIPE_PRICE_TO_PLAN: Record<string, PlanType> = {
${Object.entries(schema.plans)
  .filter(([_, def]) => def.stripePriceId)
  .map(([plan, def]) => `  '${def.stripePriceId}': '${plan}'`)
  .join(',\n')}
};

export function hasPermission(plan: PlanType, permission: Permission): boolean {
  return PLAN_PERMISSIONS[plan].includes(permission);
}

export function getPlanByPriceId(priceId: string): PlanType | null {
  return STRIPE_PRICE_TO_PLAN[priceId] || null;
}
`;

  fs.writeFileSync(path.join(libAccessDir, 'permissionMap.ts'), content);
  console.log('✅ Generated: src/lib/access/permissionMap.ts');
}

// 3. Generate Features Registry
function generateFeaturesRegistry() {
  const content = `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: ${new Date().toISOString()}
 */

import type { FeatureId } from '@/types/FeatureId';
import { Permission } from '@/lib/access/permissionMap';

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  category: string;
  lifecycle: 'active' | 'deprecated' | 'hidden';
  permission: Permission;
  limitType: 'daily' | 'weekly' | 'monthly';
  notifications: boolean;
  description?: string;
}

export const FEATURE_REGISTRY: Record<FeatureId, FeatureDefinition> = {
${schema.features.map(f => `  '${f.id}': {
    id: '${f.id}',
    name: '${f.name}',
    category: '${f.category}',
    lifecycle: '${f.lifecycle}',
    permission: Permission.${f.permission.toUpperCase()},
    limitType: '${f.limitType}',
    notifications: ${f.notifications},
    description: ${f.description ? `'${f.description}'` : 'undefined'}
  }`).join(',\n')}
};

export function getFeature(id: FeatureId): FeatureDefinition {
  return FEATURE_REGISTRY[id];
}

export function getActiveFeatures(): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.lifecycle === 'active');
}

export function getFeaturesByCategory(category: string): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.category === category);
}

export function getFeaturesByPermission(permission: Permission): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.permission === permission);
}
`;

  fs.writeFileSync(path.join(libFeaturesDir, 'registry.ts'), content);
  console.log('✅ Generated: src/lib/features/registry.ts');
}

// 4. Generate Entitlements Policy
function generateEntitlementsPolicy() {
  const content = `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: ${new Date().toISOString()}
 */

import type { FeatureId } from '@/types/FeatureId';
import type { PlanType } from '@/lib/access/permissionMap';

export const POLICY_VERSION = ${schema.version};

export type LimitType = 'daily' | 'weekly' | 'monthly';

export interface PlanLimits {
  daily?: Record<FeatureId, number>;
  weekly?: Record<FeatureId, number>;
  monthly?: Record<FeatureId, number>;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = ${JSON.stringify(schema.limits, null, 2)};

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
`;

  fs.writeFileSync(path.join(libEntitlementsDir, 'policy.ts'), content);
  console.log('✅ Generated: src/lib/entitlements/policy.ts');
}

// Main execution
function main() {
  console.log('🚀 Starting entitlements code generation...');
  console.log(`📖 Reading schema from: ${schemaPath}`);
  console.log(`📦 Schema version: ${schema.version}`);
  console.log(`📊 Features count: ${schema.features.length}`);
  console.log(`📋 Plans: ${Object.keys(schema.plans).join(', ')}`);
  console.log(`💳 Stripe mappings: ${schema.stripeMapping ? 'Yes' : 'No'}`);
  console.log(`📅 Last updated: ${schema.lastUpdated}`);
  console.log('');

  generateFeatureId();
  generatePermissionMap();
  generateFeaturesRegistry();
  generateEntitlementsPolicy();

  console.log('');
  console.log('✨ Code generation completed successfully!');
  console.log('');
  console.log('Generated files:');
  console.log('  - src/types/FeatureId.ts');
  console.log('  - src/lib/access/permissionMap.ts');
  console.log('  - src/lib/features/registry.ts');
  console.log('  - src/lib/entitlements/policy.ts');
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as generateEntitlements };