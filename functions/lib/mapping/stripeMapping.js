"use strict";
/**
 * Stripe Price ID to Plan Mapping
 *
 * Single source of truth for mapping Stripe price IDs to our internal plan types.
 * Supports both test and production price IDs, with graceful fallback.
 *
 * @module stripeMapping
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PAID_PLAN = exports.DEFAULT_PLAN = exports.PRICE_TO_PLAN = void 0;
exports.toPlan = toPlan;
exports.getSubscriptionPlan = getSubscriptionPlan;
exports.isValidPriceId = isValidPriceId;
exports.getPriceIdsForPlan = getPriceIdsForPlan;
exports.isTestPrice = isTestPrice;
exports.isLegacyPrice = isLegacyPrice;
/**
 * Get price IDs from environment variables
 * For v2 functions, these are loaded from .env file or set as environment variables
 */
// Hardcoded price IDs from the configuration we saw earlier
// These should ideally be in environment variables, but for now we'll hardcode them
const PRICE_MONTHLY_TEST = 'price_1S6wG7HdrJomitOw5YvQ71DD';
const PRICE_YEARLY_TEST = 'price_1S6wGGHdrJomitOwcmT2JeUG';
// Production prices - using GBP test prices (£0.00) temporarily for testing
const PRICE_MONTHLY_PROD = 'price_1SBurYHdrJomitOwnUkS46Ab'; // £0.00/month test price
const PRICE_YEARLY_PROD = 'price_1SBus6HdrJomitOweasMATvU'; // £0.00/year test price
// Original production prices (uncomment when ready for real payments):
// const PRICE_MONTHLY_PROD = 'price_1S6vKuHdrJomitOw4XuExllV';
// const PRICE_YEARLY_PROD = 'price_1S6vMBHdrJomitOwweaSGhYp';
/**
 * Test environment price IDs
 */
const TEST_PRICES = {
    [PRICE_MONTHLY_TEST]: 'premium_monthly',
    [PRICE_YEARLY_TEST]: 'premium_yearly',
};
/**
 * Production environment price IDs
 */
const PRODUCTION_PRICES = {
    [PRICE_MONTHLY_PROD]: 'premium_monthly',
    [PRICE_YEARLY_PROD]: 'premium_yearly',
};
// Log configuration status without exposing sensitive price IDs
if (process.env.NODE_ENV !== 'production') {
    const testCount = Object.keys(TEST_PRICES).length;
    const prodCount = Object.keys(PRODUCTION_PRICES).length;
    console.log(`[Stripe Mapping] Loaded ${testCount} TEST and ${prodCount} PRODUCTION price IDs`);
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