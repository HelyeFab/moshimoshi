"use strict";
/**
 * Tests for Stripe Subscription Event Handler
 * Uses mock Stripe events to verify handler behavior
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
const subscriptions_1 = require("../subscriptions");
const firestore = __importStar(require("../../firestore"));
// Mock the firestore module
jest.mock('../../firestore', () => ({
    upsertUserSubscriptionByCustomerId: jest.fn(),
    logStripeEvent: jest.fn(),
    getUidByCustomerId: jest.fn(),
}));
describe('Subscription Event Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('applySubscriptionEvent', () => {
        it('should handle customer.subscription.created event', async () => {
            const mockEvent = {
                id: 'evt_test123',
                object: 'event',
                api_version: '2024-06-20',
                created: 1234567890,
                data: {
                    object: {
                        id: 'sub_test123',
                        object: 'subscription',
                        customer: 'cus_test123',
                        status: 'active',
                        current_period_end: 1234567890,
                        cancel_at_period_end: false,
                        items: {
                            data: [{
                                    id: 'si_test123',
                                    price: {
                                        id: 'price_1QcTestMonthlyXXX',
                                        product: 'prod_test123',
                                    },
                                    quantity: 1,
                                }],
                        },
                    },
                },
                livemode: false,
                pending_webhooks: 1,
                request: { id: 'req_test123', idempotency_key: null },
                type: 'customer.subscription.created',
            };
            firestore.getUidByCustomerId.mockResolvedValue('uid_test123');
            firestore.upsertUserSubscriptionByCustomerId.mockResolvedValue(undefined);
            firestore.logStripeEvent.mockResolvedValue(undefined);
            await (0, subscriptions_1.applySubscriptionEvent)(mockEvent);
            expect(firestore.logStripeEvent).toHaveBeenCalledWith(mockEvent, expect.objectContaining({
                handler: 'subscription',
                subscriptionId: 'sub_test123',
                status: 'active',
                customerId: 'cus_test123',
            }));
            expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalledWith('cus_test123', expect.objectContaining({
                plan: 'premium_monthly',
                status: 'active',
                stripeSubscriptionId: 'sub_test123',
                stripePriceId: 'price_1QcTestMonthlyXXX',
            }));
        });
        it('should handle customer.subscription.updated event', async () => {
            const mockEvent = {
                id: 'evt_test124',
                object: 'event',
                api_version: '2024-06-20',
                created: 1234567891,
                data: {
                    object: {
                        id: 'sub_test123',
                        object: 'subscription',
                        customer: 'cus_test123',
                        status: 'past_due',
                        current_period_end: 1234567890,
                        cancel_at_period_end: false,
                        items: {
                            data: [{
                                    id: 'si_test123',
                                    price: {
                                        id: 'price_1QcTestMonthlyXXX',
                                        product: 'prod_test123',
                                    },
                                    quantity: 1,
                                }],
                        },
                    },
                },
                livemode: false,
                pending_webhooks: 1,
                request: { id: 'req_test124', idempotency_key: null },
                type: 'customer.subscription.updated',
            };
            firestore.getUidByCustomerId.mockResolvedValue('uid_test123');
            firestore.upsertUserSubscriptionByCustomerId.mockResolvedValue(undefined);
            firestore.logStripeEvent.mockResolvedValue(undefined);
            await (0, subscriptions_1.applySubscriptionEvent)(mockEvent);
            expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalledWith('cus_test123', expect.objectContaining({
                status: 'past_due',
            }));
        });
        it('should handle customer.subscription.deleted event', async () => {
            const mockEvent = {
                id: 'evt_test125',
                object: 'event',
                api_version: '2024-06-20',
                created: 1234567892,
                data: {
                    object: {
                        id: 'sub_test123',
                        object: 'subscription',
                        customer: 'cus_test123',
                        status: 'canceled',
                        current_period_end: 1234567890,
                        cancel_at_period_end: false,
                        items: {
                            data: [{
                                    id: 'si_test123',
                                    price: {
                                        id: 'price_1QcTestMonthlyXXX',
                                        product: 'prod_test123',
                                    },
                                    quantity: 1,
                                }],
                        },
                    },
                },
                livemode: false,
                pending_webhooks: 1,
                request: { id: 'req_test125', idempotency_key: null },
                type: 'customer.subscription.deleted',
            };
            firestore.getUidByCustomerId.mockResolvedValue('uid_test123');
            firestore.upsertUserSubscriptionByCustomerId.mockResolvedValue(undefined);
            firestore.logStripeEvent.mockResolvedValue(undefined);
            await (0, subscriptions_1.applySubscriptionEvent)(mockEvent);
            expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalledWith('cus_test123', expect.objectContaining({
                plan: 'free',
                status: 'canceled',
                stripeSubscriptionId: null,
                stripePriceId: null,
            }));
        });
        it('should handle missing customer ID gracefully', async () => {
            const mockEvent = {
                id: 'evt_test126',
                object: 'event',
                api_version: '2024-06-20',
                created: 1234567893,
                data: {
                    object: {
                        id: 'sub_test123',
                        object: 'subscription',
                        customer: null,
                        status: 'active',
                        items: {
                            data: [],
                        },
                    },
                },
                livemode: false,
                pending_webhooks: 1,
                request: { id: 'req_test126', idempotency_key: null },
                type: 'customer.subscription.created',
            };
            await expect((0, subscriptions_1.applySubscriptionEvent)(mockEvent)).rejects.toThrow('Missing customer ID');
        });
        it('should continue when no user mapping exists', async () => {
            const mockEvent = {
                id: 'evt_test127',
                object: 'event',
                api_version: '2024-06-20',
                created: 1234567894,
                data: {
                    object: {
                        id: 'sub_test123',
                        object: 'subscription',
                        customer: 'cus_test123',
                        status: 'active',
                        items: {
                            data: [{
                                    id: 'si_test123',
                                    price: {
                                        id: 'price_1QcTestMonthlyXXX',
                                        product: 'prod_test123',
                                    },
                                    quantity: 1,
                                }],
                        },
                    },
                },
                livemode: false,
                pending_webhooks: 1,
                request: { id: 'req_test127', idempotency_key: null },
                type: 'customer.subscription.created',
            };
            firestore.getUidByCustomerId.mockResolvedValue(null);
            firestore.upsertUserSubscriptionByCustomerId.mockResolvedValue(undefined);
            firestore.logStripeEvent.mockResolvedValue(undefined);
            // Should not throw, but should still attempt to update
            await (0, subscriptions_1.applySubscriptionEvent)(mockEvent);
            expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=subscriptions.test.js.map