"use strict";
/**
 * Stripe Price ID to Plan Mapping
 * Maps Stripe price IDs to our internal plan names
 *
 * This is the ONLY place where Stripe price IDs are mapped to plans
 * Update this when adding new products/prices in Stripe Dashboard
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_METADATA = exports.PRICE_MAP = exports.TEST_PRICE_MAP = exports.PRODUCTION_PRICE_MAP = void 0;
exports.getPlanFromPriceId = getPlanFromPriceId;
exports.isValidPriceId = isValidPriceId;
exports.getPriceIdsForPlan = getPriceIdsForPlan;
// Production Price IDs
exports.PRODUCTION_PRICE_MAP = {
    // Monthly subscription
    'price_1QVKJvHelloMoshimoshiMonthly': 'premium_monthly',
    // Yearly subscription  
    'price_1QVKJwHelloMoshimoshiYearly': 'premium_yearly',
};
// Test/Development Price IDs (Stripe Test Mode)
exports.TEST_PRICE_MAP = {
    // Test monthly subscription
    'price_1QVTestMonthlyMoshimoshi': 'premium_monthly',
    // Test yearly subscription
    'price_1QVTestYearlyMoshimoshi': 'premium_yearly',
};
// Determine which map to use based on environment
const isProduction = process.env.FUNCTIONS_EMULATOR !== 'true' &&
    process.env.NODE_ENV === 'production';
exports.PRICE_MAP = isProduction ? exports.PRODUCTION_PRICE_MAP : exports.TEST_PRICE_MAP;
/**
 * Get plan type from Stripe price ID
 * Returns 'free' if price ID not found (customer without subscription)
 */
function getPlanFromPriceId(priceId) {
    if (!priceId)
        return 'free';
    return exports.PRICE_MAP[priceId] || 'free';
}
/**
 * Validate if a price ID is recognized
 */
function isValidPriceId(priceId) {
    return priceId in exports.PRICE_MAP;
}
/**
 * Get all valid price IDs for a specific plan
 */
function getPriceIdsForPlan(plan) {
    if (plan === 'free')
        return [];
    return Object.entries(exports.PRICE_MAP)
        .filter(([_, mappedPlan]) => mappedPlan === plan)
        .map(([priceId]) => priceId);
}
// Export metadata about available plans
exports.PLAN_METADATA = {
    free: {
        name: 'Free Plan',
        description: 'Basic access with daily limits',
        features: [
            '5 Hiragana practices per day',
            '5 Katakana practices per day',
            'Basic progress tracking'
        ]
    },
    premium_monthly: {
        name: 'Premium Monthly',
        description: 'Full access billed monthly',
        features: [
            'Unlimited Hiragana practice',
            'Unlimited Katakana practice',
            'Advanced analytics',
            'Priority support'
        ]
    },
    premium_yearly: {
        name: 'Premium Yearly',
        description: 'Full access with yearly discount',
        features: [
            'Everything in Premium Monthly',
            '2 months free (16% discount)',
            'Early access to new features'
        ]
    }
};
//# sourceMappingURL=stripeMapping.js.map