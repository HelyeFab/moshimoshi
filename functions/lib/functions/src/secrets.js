"use strict";
/**
 * Secret Management for Stripe Integration
 *
 * Uses Firebase Functions v2 defineSecret for secure secret handling.
 * Secrets are stored in Google Secret Manager and accessed at runtime.
 *
 * @module secrets
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_PORTAL_KEY = exports.STRIPE_CHECKOUT_KEY = exports.STRIPE_WEBHOOK_SECRET = exports.STRIPE_SECRET_KEY = void 0;
exports.validateSecrets = validateSecrets;
exports.getStripeMode = getStripeMode;
const params_1 = require("firebase-functions/params");
/**
 * Stripe API Secret Key
 * Used for all Stripe API operations
 * Format: sk_test_* (test) or sk_live_* (production)
 */
exports.STRIPE_SECRET_KEY = (0, params_1.defineSecret)('STRIPE_SECRET_KEY');
/**
 * Stripe Webhook Endpoint Secret
 * Used to verify webhook signatures from Stripe
 * Format: whsec_*
 *
 * CRITICAL: This must match the webhook endpoint secret from Stripe Dashboard
 */
exports.STRIPE_WEBHOOK_SECRET = (0, params_1.defineSecret)('STRIPE_WEBHOOK_SECRET');
/**
 * Optional: Stripe Restricted Keys for specific operations
 * Use these for least-privilege access patterns
 */
exports.STRIPE_CHECKOUT_KEY = (0, params_1.defineSecret)('STRIPE_CHECKOUT_KEY');
exports.STRIPE_PORTAL_KEY = (0, params_1.defineSecret)('STRIPE_PORTAL_KEY');
/**
 * Helper to validate secrets are configured
 * Call this during function initialization
 */
function validateSecrets() {
    const secrets = {
        STRIPE_SECRET_KEY: exports.STRIPE_SECRET_KEY.value(),
        STRIPE_WEBHOOK_SECRET: exports.STRIPE_WEBHOOK_SECRET.value(),
    };
    for (const [name, value] of Object.entries(secrets)) {
        if (!value || value === 'undefined') {
            throw new Error(`Missing required secret: ${name}`);
        }
    }
}
/**
 * Get environment mode from secret key
 * @returns 'test' | 'live'
 */
function getStripeMode() {
    const key = exports.STRIPE_SECRET_KEY.value();
    if (key.startsWith('sk_test_'))
        return 'test';
    if (key.startsWith('sk_live_'))
        return 'live';
    throw new Error('Invalid Stripe secret key format');
}
//# sourceMappingURL=secrets.js.map