"use strict";
/**
 * Public HTTP Endpoints for Stripe Integration
 *
 * Provides callable functions for client-side operations:
 * - Creating checkout sessions
 * - Creating billing portal sessions
 *
 * @module endpoints
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBillingPortalSession = exports.createCheckoutSession = void 0;
const functions = __importStar(require("firebase-functions"));
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const stripeClient_1 = require("./stripeClient");
const firestore_2 = require("./firestore");
const db = (0, firestore_1.getFirestore)();
/**
 * Helper to extract and verify Firebase Auth token
 * @param req - HTTP request
 * @returns Decoded ID token
 * @throws Error if token is invalid or missing
 */
async function requireAuth(req) {
    const authz = req.headers.authorization || '';
    const match = authz.match(/^Bearer (.*)$/);
    if (!match) {
        throw new Error('Missing Authorization: Bearer <ID_TOKEN>');
    }
    const idToken = match[1];
    const decoded = await (0, auth_1.getAuth)().verifyIdToken(idToken);
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
exports.createCheckoutSession = functions
    .region('europe-west1')
    .https.onRequest(async (req, res) => {
    var _a;
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
        const stripe = (0, stripeClient_1.getStripe)();
        // Get or create Stripe customer
        let customerId = await (0, firestore_2.getCustomerIdByUid)(uid);
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
                email: userData === null || userData === void 0 ? void 0 : userData.email,
                name: userData === null || userData === void 0 ? void 0 : userData.displayName,
            });
            customerId = customer.id;
            // Map the customer to the user
            await (0, firestore_2.mapUidToCustomer)(uid, customerId);
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
    }
    catch (err) {
        console.error('createCheckoutSession error:', err);
        // Handle specific error types
        if ((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('Authorization')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (err.type === 'StripeInvalidRequestError') {
            res.status(400).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Create a Stripe Billing Portal Session
 *
 * Requires:
 * - Firebase Auth bearer token
 * - returnUrl: URL to return to after portal session
 */
exports.createBillingPortalSession = functions
    .region('europe-west1')
    .https.onRequest(async (req, res) => {
    var _a;
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
        const stripe = (0, stripeClient_1.getStripe)();
        // Get customer ID
        const customerId = await (0, firestore_2.getCustomerIdByUid)(uid);
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
    }
    catch (err) {
        console.error('createBillingPortalSession error:', err);
        // Handle specific error types
        if ((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('Authorization')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (err.type === 'StripeInvalidRequestError') {
            res.status(400).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=endpoints.js.map