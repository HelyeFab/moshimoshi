"use strict";
/**
 * Stripe Client Initialization
 *
 * Singleton Stripe client with lazy initialization using Firebase Functions v2.
 * Ensures the Stripe SDK is initialized only once with proper API versioning.
 *
 * @module stripeClient
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripe = getStripe;
exports.verifyStripeConnection = verifyStripeConnection;
exports.getStripeDashboardUrl = getStripeDashboardUrl;
const stripe_1 = __importDefault(require("stripe"));
const functions = __importStar(require("firebase-functions"));
/**
 * Singleton Stripe instance
 */
let stripe = null;
/**
 * Initialize Stripe client lazily
 */
function initializeStripe() {
    var _a;
    if (stripe) {
        return stripe;
    }
    const key = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || '';
    if (!key) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripe = new stripe_1.default(key, {
        apiVersion: '2023-10-16', // Pin to specific API version for consistency
        typescript: true,
        maxNetworkRetries: 2, // Automatic retries for network failures
        timeout: 20000, // 20 second timeout
        telemetry: true, // Send telemetry to help Stripe improve
        appInfo: {
            name: 'moshimoshi-doshisensei',
            version: '1.0.0',
            url: 'https://github.com/HelyeFab/moshimoshi',
        },
    });
    console.log('Stripe client initialized successfully');
    return stripe;
}
/**
 * Get the initialized Stripe client
 * @throws Error if Stripe is not initialized
 */
function getStripe() {
    if (!stripe) {
        return initializeStripe();
    }
    return stripe;
}
/**
 * Verify Stripe client is properly configured
 * Useful for health checks
 */
async function verifyStripeConnection() {
    try {
        const stripe = getStripe();
        // Make a simple API call to verify connection
        await stripe.accounts.retrieve();
        return true;
    }
    catch (error) {
        console.error('Stripe connection verification failed:', error);
        return false;
    }
}
/**
 * Get Stripe dashboard URL for an object
 * @param objectId - The Stripe object ID (e.g., sub_xxx, cus_xxx)
 * @returns Dashboard URL
 */
function getStripeDashboardUrl(objectId) {
    var _a;
    const key = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || '';
    const isTestMode = key.startsWith('sk_test_');
    const baseUrl = 'https://dashboard.stripe.com';
    const modePrefix = isTestMode ? '/test' : '';
    // Determine object type from prefix
    if (objectId.startsWith('cus_')) {
        return `${baseUrl}${modePrefix}/customers/${objectId}`;
    }
    else if (objectId.startsWith('sub_')) {
        return `${baseUrl}${modePrefix}/subscriptions/${objectId}`;
    }
    else if (objectId.startsWith('inv_')) {
        return `${baseUrl}${modePrefix}/invoices/${objectId}`;
    }
    else if (objectId.startsWith('cs_')) {
        return `${baseUrl}${modePrefix}/checkout/sessions/${objectId}`;
    }
    else if (objectId.startsWith('pi_')) {
        return `${baseUrl}${modePrefix}/payments/${objectId}`;
    }
    return `${baseUrl}${modePrefix}/search?query=${objectId}`;
}
//# sourceMappingURL=stripeClient.js.map