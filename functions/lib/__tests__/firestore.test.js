"use strict";
/**
 * Tests for Firestore Helpers
 * Agent 2: Production-Grade Testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("../firestore");
const firestore_2 = require("firebase-admin/firestore");
// Mock Firestore
jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => mockDb),
    Timestamp: {
        now: jest.fn(() => ({ toMillis: () => Date.now() })),
        fromMillis: jest.fn(ms => ({ toMillis: () => ms }))
    },
    FieldValue: {
        delete: jest.fn(() => 'DELETE_FIELD')
    }
}));
// Mock database structure
const mockDb = {
    collection: jest.fn(() => mockCollection),
    batch: jest.fn(() => mockBatch),
    runTransaction: jest.fn()
};
const mockCollection = {
    doc: jest.fn(() => mockDoc)
};
const mockDoc = {
    collection: jest.fn(() => mockSubCollection),
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
};
const mockSubCollection = {
    doc: jest.fn(() => mockSubDoc),
    where: jest.fn(() => mockQuery),
    orderBy: jest.fn(() => mockQuery),
    limit: jest.fn(() => mockQuery),
    get: jest.fn()
};
const mockSubDoc = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
};
const mockQuery = {
    where: jest.fn(() => mockQuery),
    orderBy: jest.fn(() => mockQuery),
    limit: jest.fn(() => mockQuery),
    get: jest.fn()
};
const mockBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn()
};
describe('Firestore Helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('Idempotency Management', () => {
        describe('wasProcessed', () => {
            it('should return true if event was already processed', async () => {
                mockSubDoc.get.mockResolvedValueOnce({ exists: true });
                const result = await (0, firestore_1.wasProcessed)('evt_123');
                expect(result).toBe(true);
                expect(mockSubDoc.get).toHaveBeenCalled();
            });
            it('should return false if event was not processed', async () => {
                mockSubDoc.get.mockResolvedValueOnce({ exists: false });
                const result = await (0, firestore_1.wasProcessed)('evt_123');
                expect(result).toBe(false);
            });
        });
        describe('markProcessed', () => {
            it('should mark an event as processed with TTL', async () => {
                await (0, firestore_1.markProcessed)('evt_123');
                expect(mockSubDoc.set).toHaveBeenCalledWith(expect.objectContaining({
                    ts: expect.any(Object),
                    processedAt: expect.any(Object),
                    ttl: expect.any(Object)
                }), { merge: true });
            });
        });
        describe('batchMarkProcessed', () => {
            it('should mark multiple events as processed', async () => {
                mockBatch.commit.mockResolvedValueOnce(undefined);
                await (0, firestore_1.batchMarkProcessed)(['evt_1', 'evt_2', 'evt_3']);
                expect(mockBatch.set).toHaveBeenCalledTimes(3);
                expect(mockBatch.commit).toHaveBeenCalled();
            });
        });
    });
    describe('Event Logging', () => {
        describe('logStripeEvent', () => {
            it('should log a Stripe event with all details', async () => {
                const mockEvent = {
                    id: 'evt_123',
                    type: 'customer.subscription.updated',
                    livemode: false,
                    created: 1234567890,
                    api_version: '2024-06-20',
                    request: { id: 'req_123' },
                    data: {
                        object: {
                            id: 'sub_123',
                            customer: 'cus_123',
                            status: 'active',
                            price: { id: 'price_123' },
                            amount_paid: 1000,
                            currency: 'usd'
                        },
                        previous_attributes: {}
                    },
                    object: 'event',
                    pending_webhooks: 0
                };
                await (0, firestore_1.logStripeEvent)(mockEvent, {
                    uid: 'uid_123',
                    customerId: 'cus_123',
                    processingTimeMs: 50
                });
                expect(mockSubDoc.set).toHaveBeenCalledWith(expect.objectContaining({
                    eventId: 'evt_123',
                    type: 'customer.subscription.updated',
                    requestId: 'req_123',
                    livemode: false,
                    uid: 'uid_123',
                    customerId: 'cus_123',
                    objectId: 'sub_123',
                    processing: expect.objectContaining({
                        deduped: false,
                        applied: true,
                        error: null,
                        processingTimeMs: 50
                    })
                }));
            });
        });
        describe('logDedupedEvent', () => {
            it('should log a deduped event', async () => {
                const mockEvent = {
                    id: 'evt_123',
                    type: 'customer.subscription.updated',
                    livemode: false,
                    created: 1234567890,
                    api_version: '2024-06-20',
                    data: { object: {}, previous_attributes: {} },
                    object: 'event',
                    pending_webhooks: 0
                };
                await (0, firestore_1.logDedupedEvent)(mockEvent);
                expect(mockSubDoc.set).toHaveBeenCalledWith(expect.objectContaining({
                    eventId: 'evt_123',
                    processing: expect.objectContaining({
                        deduped: true,
                        applied: false,
                        error: null
                    })
                }));
            });
        });
    });
    describe('Customer-UID Mapping', () => {
        describe('mapUidToCustomer', () => {
            it('should create bidirectional mapping', async () => {
                mockBatch.commit.mockResolvedValueOnce(undefined);
                await (0, firestore_1.mapUidToCustomer)('uid_123', 'cus_123');
                expect(mockBatch.set).toHaveBeenCalledTimes(2);
                expect(mockBatch.commit).toHaveBeenCalled();
            });
        });
        describe('getCustomerIdByUid', () => {
            it('should return customer ID for existing mapping', async () => {
                mockSubDoc.get.mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ customerId: 'cus_123' })
                });
                const result = await (0, firestore_1.getCustomerIdByUid)('uid_123');
                expect(result).toBe('cus_123');
            });
            it('should return null for non-existent mapping', async () => {
                mockSubDoc.get.mockResolvedValueOnce({ exists: false });
                const result = await (0, firestore_1.getCustomerIdByUid)('uid_123');
                expect(result).toBeNull();
            });
        });
        describe('getUidByCustomerId', () => {
            it('should return UID for existing mapping', async () => {
                mockSubDoc.get.mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ uid: 'uid_123' })
                });
                const result = await (0, firestore_1.getUidByCustomerId)('cus_123');
                expect(result).toBe('uid_123');
            });
            it('should return null for non-existent mapping', async () => {
                mockSubDoc.get.mockResolvedValueOnce({ exists: false });
                const result = await (0, firestore_1.getUidByCustomerId)('cus_123');
                expect(result).toBeNull();
            });
        });
        describe('hasCustomerMapping', () => {
            it('should return true if mapping exists', async () => {
                mockSubDoc.get.mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ uid: 'uid_123' })
                });
                const result = await (0, firestore_1.hasCustomerMapping)('cus_123');
                expect(result).toBe(true);
            });
            it('should return false if mapping does not exist', async () => {
                mockSubDoc.get.mockResolvedValueOnce({ exists: false });
                const result = await (0, firestore_1.hasCustomerMapping)('cus_123');
                expect(result).toBe(false);
            });
        });
    });
    describe('User Subscription Facts Management', () => {
        describe('upsertUserSubscriptionByCustomerId', () => {
            it('should update subscription facts for existing customer', async () => {
                // Mock customer to UID lookup
                mockSubDoc.get.mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ uid: 'uid_123' })
                });
                // Mock user document update
                mockDoc.set.mockResolvedValueOnce(undefined);
                await (0, firestore_1.upsertUserSubscriptionByCustomerId)('cus_123', {
                    plan: 'premium_monthly',
                    status: 'active',
                    stripeSubscriptionId: 'sub_123',
                    stripePriceId: 'price_123',
                    currentPeriodEnd: 1735689600, // 2025-01-01
                    cancelAtPeriodEnd: false
                });
                expect(mockDoc.set).toHaveBeenCalledWith(expect.objectContaining({
                    subscription: expect.objectContaining({
                        plan: 'premium_monthly',
                        status: 'active',
                        stripeCustomerId: 'cus_123',
                        stripeSubscriptionId: 'sub_123',
                        stripePriceId: 'price_123',
                        cancelAtPeriodEnd: false
                    })
                }), { merge: true });
            });
            it('should throw error if customer has no UID mapping', async () => {
                mockSubDoc.get.mockResolvedValueOnce({ exists: false });
                await expect((0, firestore_1.upsertUserSubscriptionByCustomerId)('cus_unknown', {
                    plan: 'premium_monthly',
                    status: 'active'
                })).rejects.toThrow('No uid mapped for customer cus_unknown');
            });
        });
        describe('clearUserSubscription', () => {
            it('should clear subscription and set to canceled', async () => {
                mockDoc.update.mockResolvedValueOnce(undefined);
                await (0, firestore_1.clearUserSubscription)('uid_123');
                expect(mockDoc.update).toHaveBeenCalledWith(expect.objectContaining({
                    subscription: expect.objectContaining({
                        plan: 'free',
                        status: 'canceled'
                    })
                }));
            });
        });
    });
    describe('Batch Operations', () => {
        describe('batchUpdateSubscriptions', () => {
            it('should update multiple subscriptions in batches', async () => {
                // Mock customer lookups
                mockSubDoc.get
                    .mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'uid_1' }) })
                    .mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'uid_2' }) });
                mockBatch.commit.mockResolvedValueOnce(undefined);
                await (0, firestore_1.batchUpdateSubscriptions)([
                    {
                        customerId: 'cus_1',
                        facts: { plan: 'premium_monthly', status: 'active' }
                    },
                    {
                        customerId: 'cus_2',
                        facts: { plan: 'premium_yearly', status: 'active' }
                    }
                ]);
                expect(mockBatch.set).toHaveBeenCalledTimes(2);
                expect(mockBatch.commit).toHaveBeenCalled();
            });
        });
    });
    describe('Transaction Helpers', () => {
        describe('runTransaction', () => {
            it('should retry on failure', async () => {
                mockDb.runTransaction
                    .mockRejectedValueOnce(new Error('Temporary failure'))
                    .mockResolvedValueOnce('success');
                const result = await (0, firestore_1.runTransaction)(async (tx) => 'success');
                expect(result).toBe('success');
                expect(mockDb.runTransaction).toHaveBeenCalledTimes(2);
            });
            it('should not retry on non-retryable errors', async () => {
                mockDb.runTransaction.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
                await expect((0, firestore_1.runTransaction)(async (tx) => 'success')).rejects.toThrow('PERMISSION_DENIED');
                expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
            });
        });
    });
    describe('Cleanup & Maintenance', () => {
        describe('cleanupOldProcessedEvents', () => {
            it('should delete old processed events', async () => {
                mockQuery.get.mockResolvedValueOnce({
                    empty: false,
                    size: 2,
                    docs: [
                        { ref: { delete: jest.fn() } },
                        { ref: { delete: jest.fn() } }
                    ]
                }).mockResolvedValueOnce({
                    empty: true,
                    size: 0,
                    docs: []
                });
                mockBatch.commit.mockResolvedValue(undefined);
                const deleted = await (0, firestore_1.cleanupOldProcessedEvents)(30);
                expect(deleted).toBe(2);
                expect(mockBatch.delete).toHaveBeenCalledTimes(2);
            });
        });
    });
    describe('Query Helpers', () => {
        describe('getUserSubscription', () => {
            it('should return subscription facts for user', async () => {
                mockDoc.get.mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        subscription: {
                            plan: 'premium_monthly',
                            status: 'active',
                            stripeCustomerId: 'cus_123'
                        }
                    })
                });
                const result = await (0, firestore_1.getUserSubscription)('uid_123');
                expect(result).toEqual({
                    plan: 'premium_monthly',
                    status: 'active',
                    stripeCustomerId: 'cus_123'
                });
            });
            it('should return null for non-existent user', async () => {
                mockDoc.get.mockResolvedValueOnce({ exists: false });
                const result = await (0, firestore_1.getUserSubscription)('uid_unknown');
                expect(result).toBeNull();
            });
        });
        describe('checkSubscriptionHealth', () => {
            it('should return health status for active subscription', async () => {
                const futureDate = firestore_2.Timestamp.fromMillis(Date.now() + 10 * 24 * 60 * 60 * 1000);
                mockDoc.get.mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        subscription: {
                            plan: 'premium_monthly',
                            status: 'active',
                            currentPeriodEnd: futureDate,
                            cancelAtPeriodEnd: false
                        }
                    })
                });
                const result = await (0, firestore_1.checkSubscriptionHealth)('uid_123');
                expect(result).toEqual({
                    hasSubscription: true,
                    isActive: true,
                    daysUntilRenewal: expect.any(Number),
                    willCancel: false
                });
                expect(result.daysUntilRenewal).toBeGreaterThan(0);
            });
            it('should handle canceled subscription', async () => {
                mockDoc.get.mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        subscription: {
                            plan: 'premium_monthly',
                            status: 'canceled',
                            cancelAtPeriodEnd: true
                        }
                    })
                });
                const result = await (0, firestore_1.checkSubscriptionHealth)('uid_123');
                expect(result).toEqual({
                    hasSubscription: true,
                    isActive: false,
                    daysUntilRenewal: null,
                    willCancel: true
                });
            });
        });
    });
});
describe('Integration Tests', () => {
    describe('End-to-End Flow', () => {
        it('should handle complete subscription lifecycle', async () => {
            // 1. Map customer to UID
            mockBatch.commit.mockResolvedValueOnce(undefined);
            await (0, firestore_1.mapUidToCustomer)('uid_123', 'cus_123');
            // 2. Create subscription
            mockSubDoc.get.mockResolvedValueOnce({
                exists: true,
                data: () => ({ uid: 'uid_123' })
            });
            mockDoc.set.mockResolvedValueOnce(undefined);
            await (0, firestore_1.upsertUserSubscriptionByCustomerId)('cus_123', {
                plan: 'premium_monthly',
                status: 'trialing',
                stripeSubscriptionId: 'sub_123',
                trialEnd: Date.now() / 1000 + 7 * 24 * 60 * 60 // 7 days
            });
            // 3. Update to active
            mockSubDoc.get.mockResolvedValueOnce({
                exists: true,
                data: () => ({ uid: 'uid_123' })
            });
            mockDoc.set.mockResolvedValueOnce(undefined);
            await (0, firestore_1.upsertUserSubscriptionByCustomerId)('cus_123', {
                status: 'active',
                trialEnd: null
            });
            // 4. Cancel subscription
            mockSubDoc.get.mockResolvedValueOnce({
                exists: true,
                data: () => ({ uid: 'uid_123' })
            });
            mockDoc.set.mockResolvedValueOnce(undefined);
            await (0, firestore_1.upsertUserSubscriptionByCustomerId)('cus_123', {
                cancelAtPeriodEnd: true,
                canceledAt: Date.now() / 1000
            });
            // Verify all operations were called
            expect(mockBatch.commit).toHaveBeenCalledTimes(1);
            expect(mockDoc.set).toHaveBeenCalledTimes(3);
        });
    });
    describe('Idempotency', () => {
        it('should handle duplicate events correctly', async () => {
            const eventId = 'evt_duplicate';
            // First check - not processed
            mockSubDoc.get.mockResolvedValueOnce({ exists: false });
            const first = await (0, firestore_1.wasProcessed)(eventId);
            expect(first).toBe(false);
            // Mark as processed
            mockSubDoc.set.mockResolvedValueOnce(undefined);
            await (0, firestore_1.markProcessed)(eventId);
            // Second check - already processed
            mockSubDoc.get.mockResolvedValueOnce({ exists: true });
            const second = await (0, firestore_1.wasProcessed)(eventId);
            expect(second).toBe(true);
            // Log as deduped
            mockSubDoc.set.mockResolvedValueOnce(undefined);
            await (0, firestore_1.logDedupedEvent)({
                id: eventId,
                type: 'test.event',
                livemode: false,
                created: Date.now() / 1000,
                api_version: '2024-06-20',
                data: { object: {}, previous_attributes: {} },
                object: 'event',
                pending_webhooks: 0
            });
            expect(mockSubDoc.set).toHaveBeenCalledTimes(2);
        });
    });
    describe('Error Handling', () => {
        it('should handle missing customer mapping gracefully', async () => {
            mockSubDoc.get.mockResolvedValueOnce({ exists: false });
            await expect((0, firestore_1.upsertUserSubscriptionByCustomerId)('cus_unknown', {
                plan: 'premium_monthly',
                status: 'active'
            })).rejects.toThrow('No uid mapped for customer cus_unknown');
        });
        it('should handle Firestore errors in batch operations', async () => {
            mockBatch.commit.mockRejectedValueOnce(new Error('Firestore error'));
            await expect((0, firestore_1.batchMarkProcessed)(['evt_1', 'evt_2'])).rejects.toThrow('Firestore error');
        });
    });
});
//# sourceMappingURL=firestore.test.js.map