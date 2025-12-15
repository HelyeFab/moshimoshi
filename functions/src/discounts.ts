/**
 * Stripe Discount Helpers for Firebase Functions
 *
 * Marks discounts as redeemed after successful subscription creation.
 *
 * @module discounts
 */

import { adminFirestore, getUidByCustomerId } from './firestore';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Mark a discount as redeemed by customer ID
 *
 * Called from webhook handler after successful subscription creation.
 *
 * @param customerId - Stripe customer ID
 * @param subscriptionId - Stripe subscription ID
 */
export async function markDiscountRedeemedByCustomerId(
  customerId: string,
  subscriptionId: string
): Promise<void> {
  try {
    // Get UID from customer mapping
    const uid = await getUidByCustomerId(customerId);

    if (!uid) {
      console.log(`[Discounts] No UID found for customer: ${customerId}`);
      return;
    }

    // Check if discount document exists
    const discountRef = adminFirestore
      .collection('stripe')
      .doc('discounts')
      .collection('users')
      .doc(uid);

    const discountDoc = await discountRef.get();

    if (!discountDoc.exists) {
      console.log(`[Discounts] No discount record for user: ${uid.substring(0, 8)}...`);
      return;
    }

    const data = discountDoc.data();

    // Already redeemed - skip
    if (data?.redeemed) {
      console.log(`[Discounts] Discount already marked as redeemed for user: ${uid.substring(0, 8)}...`);
      return;
    }

    // Mark as redeemed
    await discountRef.update({
      redeemed: true,
      redeemedAt: Timestamp.now(),
      redeemedSubscriptionId: subscriptionId,
    });

    console.log(`[Discounts] ✅ Marked discount as redeemed for user: ${uid.substring(0, 8)}... (subscription: ${subscriptionId})`);
  } catch (error) {
    console.error('[Discounts] Error marking discount as redeemed:', error);
    // Don't throw - this is non-critical
  }
}
