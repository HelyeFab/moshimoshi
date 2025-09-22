"use strict";
/**
 * Stripe Price ID to Plan Mapping
 *
 * Single source of truth for mapping Stripe price IDs to our internal plan types.
 * Supports both test and production price IDs, with graceful fallback.
 *
 * @module stripeMapping
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
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PAID_PLAN = exports.DEFAULT_PLAN = exports.PRICE_TO_PLAN = void 0;
exports.toPlan = toPlan;
exports.getSubscriptionPlan = getSubscriptionPlan;
exports.isValidPriceId = isValidPriceId;
exports.getPriceIdsForPlan = getPriceIdsForPlan;
exports.isTestPrice = isTestPrice;
exports.isLegacyPrice = isLegacyPrice;
/**
 * Get price IDs from environment configuration
 * These should be set via Firebase Functions config:
 * firebase functions:config:set stripe.price_monthly_test="price_xxx" stripe.price_yearly_test="price_yyy"
 * firebase functions:config:set stripe.price_monthly_prod="price_xxx" stripe.price_yearly_prod="price_yyy"
 */
const functions = __importStar(require("firebase-functions"));
const config = functions.config();
/**
 * Test environment price IDs from Firebase config
 */
const TEST_PRICES = Object.assign(Object.assign({}, (((_a = config.stripe) === null || _a === void 0 ? void 0 : _a.price_monthly_test) && { [config.stripe.price_monthly_test]: 'premium_monthly' })), (((_b = config.stripe) === null || _b === void 0 ? void 0 : _b.price_yearly_test) && { [config.stripe.price_yearly_test]: 'premium_yearly' }));
/**
 * Production environment price IDs from Firebase config
 */
const PRODUCTION_PRICES = Object.assign(Object.assign({}, (((_c = config.stripe) === null || _c === void 0 ? void 0 : _c.price_monthly_prod) && { [config.stripe.price_monthly_prod]: 'premium_monthly' })), (((_d = config.stripe) === null || _d === void 0 ? void 0 : _d.price_yearly_prod) && { [config.stripe.price_yearly_prod]: 'premium_yearly' }));
// Log loaded price IDs for debugging (only in non-production)
if (process.env.NODE_ENV !== 'production') {
    console.log('[Stripe Mapping] Loaded TEST price IDs:', TEST_PRICES);
    console.log('[Stripe Mapping] Loaded PRODUCTION price IDs:', PRODUCTION_PRICES);
}
/**
 * Combined mapping for both test and production
 * This allows the same codebase to work in both environments
 */
exports.PRICE_TO_PLAN = Object.assign(Object.assign({}, TEST_PRICES), PRODUCTION_PRICES);
/**
 * Maps a Stripe price ID to our internal plan type
 *
 * @param priceId - The Stripe price ID from the subscription or checkout
 * @returns The mapped plan type, or null if not recognized
 *
 * @example
 * ```ts
 * const plan = toPlan('price_1QcTestMonthlyXXX'); // 'monthly'
 * const unknown = toPlan('price_unknown'); // null
 * const empty = toPlan(null); // null
 * ```
 */
function toPlan(priceId) {
    var _a;
    if (!priceId)
        return null;
    return (_a = exports.PRICE_TO_PLAN[priceId]) !== null && _a !== void 0 ? _a : null;
}
/**
 * Gets the appropriate plan for a user based on their subscription
 *
 * @param priceId - The Stripe price ID (optional)
 * @param hasActiveSubscription - Whether the user has an active subscription
 * @returns The subscription plan type
 *
 * @example
 * ```ts
 * const plan = getSubscriptionPlan('price_1QcTestMonthlyXXX', true); // 'monthly'
 * const freePlan = getSubscriptionPlan(null, false); // 'free'
 * ```
 */
function getSubscriptionPlan(priceId, hasActiveSubscription) {
    if (!hasActiveSubscription)
        return 'free';
    const plan = toPlan(priceId);
    if (!plan) {
        console.warn(`Unknown price ID: ${priceId}, defaulting to premium_monthly`);
        return 'premium_monthly'; // Safe default for active subscriptions
    }
    return plan;
}
/**
 * Validates if a price ID is recognized
 * Useful for early validation in checkout flows
 *
 * @param priceId - The Stripe price ID to validate
 * @returns true if the price ID is recognized
 */
function isValidPriceId(priceId) {
    return priceId in exports.PRICE_TO_PLAN;
}
/**
 * Gets all valid price IDs for a given plan type
 * Useful for migrations or admin tools
 *
 * @param plan - The plan type to get price IDs for
 * @returns Array of price IDs that map to this plan
 */
function getPriceIdsForPlan(plan) {
    return Object.entries(exports.PRICE_TO_PLAN)
        .filter(([_, mappedPlan]) => mappedPlan === plan)
        .map(([priceId]) => priceId);
}
/**
 * Environment detection helper
 * Returns whether we're likely in test mode based on price IDs
 *
 * @param priceId - The Stripe price ID to check
 * @returns true if this appears to be a test price ID
 */
function isTestPrice(priceId) {
    return priceId in TEST_PRICES;
}
/**
 * Price rotation helper
 * When rotating prices, this helps identify old vs new
 *
 * @param priceId - The Stripe price ID to check
 * @returns true if this is a legacy price ID
 */
function isLegacyPrice(priceId) {
    return priceId.includes('Old');
}
/**
 * Default plan constants
 */
exports.DEFAULT_PLAN = 'free';
exports.DEFAULT_PAID_PLAN = 'premium_monthly';
//# sourceMappingURL=stripeMapping.js.map