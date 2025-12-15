/**
 * Waitlist to User Linking
 *
 * Links a waitlist entry to a newly signed up user.
 * Grants discount eligibility if the user's email was on the waitlist.
 *
 * @module lib/waitlist/linkWaitlist
 */

import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createDiscountEligibility } from '@/lib/stripe/discounts';

/**
 * Link a waitlist entry to a user account
 *
 * Called during signup to check if the user's email is on the waitlist.
 * If found, grants them discount eligibility.
 *
 * @param email - User's email (will be normalized to lowercase)
 * @param uid - Firebase user ID
 * @returns true if user was on waitlist and linked, false otherwise
 */
export async function linkWaitlistToUser(email: string, uid: string): Promise<boolean> {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      console.error('[Waitlist] Firebase Admin not initialized');
      return false;
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`[Waitlist] Checking if ${normalizedEmail.substring(0, 3)}*** is on waitlist`);

    // Query waitlist by email
    const waitlistQuery = await adminFirestore
      .collection('waitlist')
      .where('email', '==', normalizedEmail)
      .where('linkedUid', '==', null) // Only match unlinked entries
      .limit(1)
      .get();

    if (waitlistQuery.empty) {
      console.log(`[Waitlist] Email not found on waitlist`);
      return false;
    }

    const waitlistDoc = waitlistQuery.docs[0];
    const waitlistData = waitlistDoc.data();

    // Check if already linked (double safety)
    if (waitlistData.linkedUid) {
      console.log(`[Waitlist] Entry already linked to another user`);
      return false;
    }

    // Check if discount already granted
    if (waitlistData.discountGranted) {
      console.log(`[Waitlist] Discount already granted for this entry`);
      return false;
    }

    console.log(`[Waitlist] Found waitlist entry, linking to user ${uid.substring(0, 8)}...`);

    // Update waitlist document
    await waitlistDoc.ref.update({
      linkedUid: uid,
      linkedAt: Timestamp.now(),
      discountGranted: true,
    });

    // Create discount eligibility
    await createDiscountEligibility(uid, normalizedEmail, 'pre_launch_waitlist');

    console.log(`[Waitlist] Successfully linked waitlist to user and created discount eligibility`);

    return true;
  } catch (error) {
    console.error('[Waitlist] Error linking waitlist to user:', error);
    // Don't throw - this is non-critical and shouldn't block signup
    return false;
  }
}
