/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from: config/features.v1.json
 * Generated at: 2025-09-25T19:04:52.656Z
 */

export enum Permission {
  DO_PRACTICE = 'do_practice'
}

export type PlanType = 'guest' | 'free' | 'premium_monthly' | 'premium_yearly';

export const PLAN_PERMISSIONS: Record<PlanType, Permission[]> = {
  'guest': [Permission.DO_PRACTICE],
  'free': [Permission.DO_PRACTICE],
  'premium_monthly': [Permission.DO_PRACTICE],
  'premium_yearly': [Permission.DO_PRACTICE]
};

export const PLAN_DEFINITIONS = {
  "guest": {
    "displayName": "Guest",
    "description": "Limited access for unauthenticated users",
    "stripePriceId": null,
    "isDefault": false,
    "order": 0
  },
  "free": {
    "displayName": "Free",
    "description": "Basic access for registered users",
    "stripePriceId": null,
    "isDefault": true,
    "order": 1
  },
  "premium_monthly": {
    "displayName": "Premium Monthly",
    "description": "Full access with monthly billing",
    "stripePriceId": "price_monthly_xxx",
    "isDefault": false,
    "order": 2
  },
  "premium_yearly": {
    "displayName": "Premium Yearly",
    "description": "Full access with annual billing (best value)",
    "stripePriceId": "price_yearly_yyy",
    "isDefault": false,
    "order": 3
  }
} as const;

export const STRIPE_PRICE_TO_PLAN: Record<string, PlanType> = {
  'price_monthly_xxx': 'premium_monthly',
  'price_yearly_yyy': 'premium_yearly'
};

export function hasPermission(plan: PlanType, permission: Permission): boolean {
  return PLAN_PERMISSIONS[plan].includes(permission);
}

export function getPlanByPriceId(priceId: string): PlanType | null {
  return STRIPE_PRICE_TO_PLAN[priceId] || null;
}
