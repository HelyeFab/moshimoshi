/**
 * Stripe Discount Eligibility Helper
 *
 * Manages discount eligibility for pre-launch waitlist users.
 * Checks Firestore for eligibility and marks discounts as redeemed.
 *
 * @module lib/stripe/discounts
 */

import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface DiscountEligibility {
  promotionCodeId: string;
  source: string;
  waitlistEmail?: string;
}

export interface DiscountDocument {
  eligible: boolean;
  promotionCodeId: string;
  source: string;
  waitlistEmail?: string;
  grantedAt: Timestamp;
  redeemed: boolean;
  redeemedAt: Timestamp | null;
  redeemedSubscriptionId?: string;
}

/**
 * Get the promotion code ID from environment
 */
function getPromoCodeId(): string {
  const promoCodeId = process.env.PRELAUNCH_PROMO_CODE_ID;
  if (!promoCodeId) {
    console.warn('[Discounts] PRELAUNCH_PROMO_CODE_ID not configured');
    return '';
  }
  return promoCodeId;
}

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

    // Check if eligible and not yet redeemed
    if (!data.eligible) {
      console.log(`[Discounts] User ${uid.substring(0, 8)}... not eligible`);
      return null;
    }

    if (data.redeemed) {
      console.log(`[Discounts] User ${uid.substring(0, 8)}... already redeemed discount`);
      return null;
    }

    console.log(`[Discounts] User ${uid.substring(0, 8)}... is eligible for discount`);

    return {
      promotionCodeId: data.promotionCodeId,
      source: data.source,
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
 * @param subscriptionId - Stripe subscription ID (optional, for tracking)
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
 * Create discount eligibility for a user
 * Called when a waitlist user signs up
 *
 * @param uid - Firebase user ID
 * @param waitlistEmail - Original waitlist email
 * @param source - Where the eligibility came from
 */
export async function createDiscountEligibility(
  uid: string,
  waitlistEmail: string,
  source: string = 'pre_launch_waitlist'
): Promise<void> {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const promoCodeId = getPromoCodeId();
    if (!promoCodeId) {
      console.warn('[Discounts] Cannot create eligibility - no promo code configured');
      return;
    }

    const discountRef = adminFirestore
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(uid);

    const discountData: DiscountDocument = {
      eligible: true,
      promotionCodeId: promoCodeId,
      source,
      waitlistEmail,
      grantedAt: Timestamp.now(),
      redeemed: false,
      redeemedAt: null,
    };

    await discountRef.set(discountData);

    console.log(`[Discounts] Created discount eligibility for user ${uid.substring(0, 8)}...`);
  } catch (error) {
    console.error('[Discounts] Error creating eligibility:', error);
    throw error;
  }
}
