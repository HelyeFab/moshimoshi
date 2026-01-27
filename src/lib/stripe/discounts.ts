/**
 * Stripe Discount Eligibility Helper
 *
 * Config-driven discount system supporting multiple discount types:
 * - Pre-launch waitlist (25% off)
 * - Thank you discounts (50% off)
 * - Easily extensible for new discount types
 *
 * @module lib/stripe/discounts
 */

import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

// ============================================================================
// DISCOUNT TYPE CONFIGURATION
// ============================================================================

/**
 * Discount type configuration
 * Add new discount types here - no other code changes needed!
 */
export const DISCOUNT_TYPES = {
  prelaunch: {
    id: 'prelaunch',
    envVar: 'PRELAUNCH_PROMO_CODE_ID',
    label: 'Pre-Launch Waitlist (25%)',
    description: 'For users who joined the waitlist before launch',
    sources: ['pre_launch_waitlist'] as const,
    adminGrantable: false, // Auto-granted on signup
  },
  thankyou: {
    id: 'thankyou',
    envVar: 'THANKYOU_PROMO_CODE_ID',
    label: 'Thank You (50%)',
    description: 'Manual reward for valuable community members',
    sources: [
      'beta_tester',
      'bug_reporter',
      'content_creator',
      'community_contributor',
      'support_compensation',
      'other',
    ] as const,
    adminGrantable: true,
  },
  // Example: Add new discount types here
  // referral: {
  //   id: 'referral',
  //   envVar: 'REFERRAL_PROMO_CODE_ID',
  //   label: 'Referral (20%)',
  //   description: 'For users who referred new members',
  //   sources: ['referred_user', 'referrer_bonus'] as const,
  //   adminGrantable: true,
  // },
} as const;

export type DiscountTypeId = keyof typeof DISCOUNT_TYPES;
export type DiscountType = typeof DISCOUNT_TYPES[DiscountTypeId];

// Helper types for sources
export type PrelaunchSource = typeof DISCOUNT_TYPES.prelaunch.sources[number];
export type ThankYouSource = typeof DISCOUNT_TYPES.thankyou.sources[number];
export type DiscountSource = PrelaunchSource | ThankYouSource;

// Legacy export for backwards compatibility
export const THANKYOU_SOURCES = DISCOUNT_TYPES.thankyou.sources;

// ============================================================================
// INTERFACES
// ============================================================================

export interface DiscountEligibility {
  promotionCodeId: string;
  source: string;
  discountType?: DiscountTypeId;
  waitlistEmail?: string;
}

export interface DiscountDocument {
  eligible: boolean;
  promotionCodeId: string;
  discountType: DiscountTypeId;
  source: string;
  waitlistEmail?: string;
  grantedAt: Timestamp;
  grantedBy?: string;
  redeemed: boolean;
  redeemedAt: Timestamp | null;
  redeemedSubscriptionId?: string;
  revokedAt?: Timestamp;
  revokedBy?: string;
}

export interface DiscountStatus {
  hasDiscount: boolean;
  eligible: boolean;
  redeemed: boolean;
  discountType?: DiscountTypeId;
  discountLabel?: string;
  source?: string;
  grantedAt?: Date;
  grantedBy?: string;
  redeemedAt?: Date;
}

export interface DiscountTypeInfo {
  id: DiscountTypeId;
  label: string;
  description: string;
  sources: readonly string[];
  adminGrantable: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the promo code ID for a discount type from environment
 */
function getPromoCodeId(discountType: DiscountTypeId): string {
  const config = DISCOUNT_TYPES[discountType];
  if (!config) {
    throw new Error(`[Discounts] Unknown discount type: ${discountType}`);
  }

  const promoCodeId = process.env[config.envVar];
  if (!promoCodeId) {
    const message = `[Discounts] ${config.envVar} not configured`;
    console.error(message);
    throw new Error(message);
  }
  return promoCodeId;
}

/**
 * Get all admin-grantable discount types (for UI)
 */
export function getAdminGrantableDiscountTypes(): DiscountTypeInfo[] {
  return Object.values(DISCOUNT_TYPES)
    .filter(dt => dt.adminGrantable)
    .map(dt => ({
      id: dt.id as DiscountTypeId,
      label: dt.label,
      description: dt.description,
      sources: dt.sources,
      adminGrantable: dt.adminGrantable,
    }));
}

/**
 * Get sources for a specific discount type
 */
export function getSourcesForDiscountType(discountType: DiscountTypeId): readonly string[] {
  return DISCOUNT_TYPES[discountType]?.sources || [];
}

// ============================================================================
// CORE DISCOUNT FUNCTIONS
// ============================================================================

/**
 * Check if a user is eligible for a discount
 *
 * @param uid - Firebase user ID
 * @returns Discount eligibility info or null if not eligible
 */
export async function getDiscountEligibility(uid: string): Promise<DiscountEligibility | null> {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const discountRef = adminFirestore
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(uid);

    const discountDoc = await discountRef.get();

    if (!discountDoc.exists) {
      console.log(`[Discounts] No discount record for user ${uid.substring(0, 8)}...`);
      return null;
    }

    const data = discountDoc.data() as DiscountDocument;

    if (!data.eligible) {
      console.log(`[Discounts] User ${uid.substring(0, 8)}... not eligible`);
      return null;
    }

    if (data.redeemed) {
      console.log(`[Discounts] User ${uid.substring(0, 8)}... already redeemed discount`);
      return null;
    }

    console.log(`[Discounts] User ${uid.substring(0, 8)}... is eligible for ${data.discountType || 'unknown'} discount`);

    return {
      promotionCodeId: data.promotionCodeId,
      source: data.source,
      discountType: data.discountType,
      waitlistEmail: data.waitlistEmail,
    };
  } catch (error) {
    console.error('[Discounts] Error checking eligibility:', error);
    return null;
  }
}

/**
 * Mark a discount as redeemed
 *
 * @param uid - Firebase user ID
 * @param subscriptionId - Stripe subscription ID (optional)
 */
export async function markDiscountRedeemed(
  uid: string,
  subscriptionId?: string
): Promise<void> {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const discountRef = adminFirestore
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(uid);

    await discountRef.update({
      redeemed: true,
      redeemedAt: Timestamp.now(),
      redeemedSubscriptionId: subscriptionId || null,
    });

    console.log(`[Discounts] Marked discount as redeemed for user ${uid.substring(0, 8)}...`);
  } catch (error) {
    console.error('[Discounts] Error marking discount redeemed:', error);
    throw error;
  }
}

/**
 * Grant a discount to a user (generic function)
 *
 * @param uid - Firebase user ID
 * @param discountType - Type of discount to grant
 * @param source - Specific reason/source within the discount type
 * @param adminUid - UID of admin granting (optional for auto-grants)
 * @param waitlistEmail - Email for waitlist discounts (optional)
 */
export async function grantDiscount(
  uid: string,
  discountType: DiscountTypeId,
  source: string,
  adminUid?: string,
  waitlistEmail?: string
): Promise<void> {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const config = DISCOUNT_TYPES[discountType];
    if (!config) {
      throw new Error(`Unknown discount type: ${discountType}`);
    }

    // Validate source
    if (!(config.sources as readonly string[]).includes(source)) {
      throw new Error(`Invalid source "${source}" for discount type "${discountType}"`);
    }

    const promoCodeId = getPromoCodeId(discountType);
    const discountRef = adminFirestore
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(uid);

    // Check for existing discount
    const existingDoc = await discountRef.get();
    if (existingDoc.exists) {
      const data = existingDoc.data() as DiscountDocument;
      if (data.eligible && !data.redeemed) {
        throw new Error('User already has an active discount');
      }
      if (data.redeemed) {
        throw new Error('User has already redeemed a discount');
      }
    }

    const discountData: DiscountDocument = {
      eligible: true,
      promotionCodeId: promoCodeId,
      discountType,
      source: `${discountType}_${source}`,
      grantedAt: Timestamp.now(),
      redeemed: false,
      redeemedAt: null,
      ...(adminUid && { grantedBy: adminUid }),
      ...(waitlistEmail && { waitlistEmail }),
    };

    await discountRef.set(discountData);

    const grantedBy = adminUid ? `Admin ${adminUid.substring(0, 8)}...` : 'System';
    console.log(`[Discounts] ${grantedBy} granted ${discountType} discount to user ${uid.substring(0, 8)}...`);
  } catch (error) {
    console.error('[Discounts] Error granting discount:', error);
    throw error;
  }
}

/**
 * Revoke a discount from a user (admin action)
 * Only works if the discount hasn't been redeemed yet
 *
 * @param uid - Firebase user ID
 * @param adminUid - UID of the admin revoking the discount
 */
export async function revokeDiscount(
  uid: string,
  adminUid: string
): Promise<void> {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const discountRef = adminFirestore
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(uid);

    const discountDoc = await discountRef.get();

    if (!discountDoc.exists) {
      throw new Error('No discount found for this user');
    }

    const data = discountDoc.data() as DiscountDocument;

    if (data.redeemed) {
      throw new Error('Cannot revoke a discount that has already been redeemed');
    }

    await discountRef.update({
      eligible: false,
      revokedAt: Timestamp.now(),
      revokedBy: adminUid,
    });

    console.log(`[Discounts] Admin ${adminUid.substring(0, 8)}... revoked discount for user ${uid.substring(0, 8)}...`);
  } catch (error) {
    console.error('[Discounts] Error revoking discount:', error);
    throw error;
  }
}

/**
 * Get the current discount status for a user (for admin UI)
 *
 * @param uid - Firebase user ID
 * @returns Discount status or null if no record exists
 */
export async function getDiscountStatus(uid: string): Promise<DiscountStatus | null> {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const discountRef = adminFirestore
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(uid);

    const discountDoc = await discountRef.get();

    if (!discountDoc.exists) {
      return null;
    }

    const data = discountDoc.data() as DiscountDocument;
    const discountType = data.discountType || 'prelaunch'; // Legacy fallback
    const discountLabel = DISCOUNT_TYPES[discountType]?.label || discountType;

    return {
      hasDiscount: true,
      eligible: data.eligible,
      redeemed: data.redeemed,
      discountType,
      discountLabel,
      source: data.source,
      grantedAt: data.grantedAt?.toDate(),
      grantedBy: data.grantedBy,
      redeemedAt: data.redeemedAt?.toDate(),
    };
  } catch (error) {
    console.error('[Discounts] Error getting discount status:', error);
    return null;
  }
}

// ============================================================================
// CONVENIENCE WRAPPERS (Backwards Compatible)
// ============================================================================

/**
 * Create discount eligibility for a waitlist user (legacy wrapper)
 * @deprecated Use grantDiscount('prelaunch', ...) instead
 */
export async function createDiscountEligibility(
  uid: string,
  waitlistEmail: string,
  source: string = 'pre_launch_waitlist'
): Promise<void> {
  await grantDiscount(uid, 'prelaunch', source, undefined, waitlistEmail);
}

/**
 * Grant a thank you discount to a user (legacy wrapper)
 * @deprecated Use grantDiscount('thankyou', ...) instead
 */
export async function grantThankYouDiscount(
  uid: string,
  source: ThankYouSource,
  adminUid: string
): Promise<void> {
  await grantDiscount(uid, 'thankyou', source, adminUid);
}
