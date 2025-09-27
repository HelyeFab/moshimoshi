/**
 * Public HTTP Endpoints for Stripe Integration
 * 
 * Provides callable functions for client-side operations:
 * - Creating checkout sessions
 * - Creating billing portal sessions
 * 
 * @module endpoints
 */

import { onRequest, HttpsFunction } from 'firebase-functions/v2/https';
import { Request, Response } from 'firebase-functions/v1';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStripe } from './stripeClient';
import { mapUidToCustomer, getCustomerIdByUid } from './firestore';

const db = getFirestore();

/**
 * Helper to extract and verify Firebase Auth token
 * @param req - HTTP request
 * @returns Decoded ID token
 * @throws Error if token is invalid or missing
 */
async function requireAuth(req: any): Promise<string> {
  const authz = req.headers.authorization || '';
  const match = authz.match(/^Bearer (.*)$/);
  
  if (!match) {
    throw new Error('Missing Authorization: Bearer <ID_TOKEN>');
  }
  
  const idToken = match[1];
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded.uid;
}

/**
 * Create a Stripe Checkout Session
 * 
 * Requires:
 * - Firebase Auth bearer token
 * - priceId: Stripe price ID
 * - successUrl: URL to redirect after success
 * - cancelUrl: URL to redirect on cancel
 * - idempotencyKey: Client-generated unique key
 */
export const createCheckoutSession: HttpsFunction = onRequest(
  { region: 'europe-west1', cors: true },
  async (req: Request, res: Response): Promise<void> => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      // Verify authentication
      const uid = await requireAuth(req);
      
      // Extract request data
      const { priceId, successUrl, cancelUrl, idempotencyKey } = req.body || {};
      
      // Validate required fields
      if (!priceId || !successUrl || !cancelUrl || !idempotencyKey) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['priceId', 'successUrl', 'cancelUrl', 'idempotencyKey']
        });
        return;
      }
      
      const stripe = getStripe();
      
      // Get or create Stripe customer
      let customerId = await getCustomerIdByUid(uid);
      
      if (!customerId) {
        // Get user data for customer creation
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data();
        
        // Create Stripe customer
        const customer = await stripe.customers.create({
          metadata: { 
            uid,
            firebaseUserId: uid,
          },
          email: userData?.email,
          name: userData?.displayName,
        });
        
        customerId = customer.id;
        
        // Map the customer to the user
        await mapUidToCustomer(uid, customerId);
        console.log(`Created new Stripe customer ${customerId} for user ${uid}`);
      }
      
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: uid, // Important for webhook processing
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            uid,
            firebaseUserId: uid,
          },
        },
        metadata: {
          uid,
          price_id: priceId,
          firebaseUserId: uid,
        },
        // Enable SCA/3DS
        payment_method_types: ['card'],
        // Tax collection (optional)
        automatic_tax: {
          enabled: false, // Set to true if using Stripe Tax
        },
      }, {
        idempotencyKey, // Use client-provided idempotency key
      });
      
      // Return the session URL
      res.status(200).json({ 
        url: session.url,
        sessionId: session.id,
      });
      
    } catch (err: any) {
      console.error('createCheckoutSession error:', err);
      
      // Handle specific error types
      if (err.message?.includes('Authorization')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (err.type === 'StripeInvalidRequestError') {
        res.status(400).json({ error: err.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Create a Stripe Billing Portal Session
 * 
 * Requires:
 * - Firebase Auth bearer token
 * - returnUrl: URL to return to after portal session
 */
export const createBillingPortalSession: HttpsFunction = onRequest(
  { region: 'europe-west1', cors: true },
  async (req: Request, res: Response): Promise<void> => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    
    try {
      // Verify authentication
      const uid = await requireAuth(req);
      
      // Extract request data
      const { returnUrl } = req.body || {};
      
      // Validate required fields
      if (!returnUrl) {
        res.status(400).json({
          error: 'Missing returnUrl'
        });
        return;
      }
      
      const stripe = getStripe();
      
      // Get customer ID
      const customerId = await getCustomerIdByUid(uid);
      
      if (!customerId) {
        res.status(400).json({
          error: 'No Stripe customer found. Please subscribe first.'
        });
        return;
      }
      
      // Create billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        // Optional: Configure what customers can do in the portal
        // configuration: 'bpc_xxx', // Use a portal configuration ID
      });
      
      // Return the portal URL
      res.status(200).json({ 
        url: session.url 
      });
      
    } catch (err: any) {
      console.error('createBillingPortalSession error:', err);
      
      // Handle specific error types
      if (err.message?.includes('Authorization')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (err.type === 'StripeInvalidRequestError') {
        res.status(400).json({ error: err.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
);