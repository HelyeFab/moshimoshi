/**
 * Tests for Stripe Subscription Event Handler
 * Uses mock Stripe events to verify handler behavior
 */

import { applySubscriptionEvent } from '../subscriptions';
import * as firestore from '../../firestore';
import Stripe from 'stripe';

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
      const mockEvent: Stripe.Event = {
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
          } as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test123', idempotency_key: null },
        type: 'customer.subscription.created',
      };

      (firestore.getUidByCustomerId as jest.Mock).mockResolvedValue('uid_test123');
      (firestore.upsertUserSubscriptionByCustomerId as jest.Mock).mockResolvedValue(undefined);
      (firestore.logStripeEvent as jest.Mock).mockResolvedValue(undefined);

      await applySubscriptionEvent(mockEvent);

      expect(firestore.logStripeEvent).toHaveBeenCalledWith(
        mockEvent,
        expect.objectContaining({
          handler: 'subscription',
          subscriptionId: 'sub_test123',
          status: 'active',
          customerId: 'cus_test123',
        })
      );

      expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalledWith(
        'cus_test123',
        expect.objectContaining({
          plan: 'premium_monthly',
          status: 'active',
          stripeSubscriptionId: 'sub_test123',
          stripePriceId: 'price_1QcTestMonthlyXXX',
        })
      );
    });

    it('should handle customer.subscription.updated event', async () => {
      const mockEvent: Stripe.Event = {
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
          } as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test124', idempotency_key: null },
        type: 'customer.subscription.updated',
      };

      (firestore.getUidByCustomerId as jest.Mock).mockResolvedValue('uid_test123');
      (firestore.upsertUserSubscriptionByCustomerId as jest.Mock).mockResolvedValue(undefined);
      (firestore.logStripeEvent as jest.Mock).mockResolvedValue(undefined);

      await applySubscriptionEvent(mockEvent);

      expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalledWith(
        'cus_test123',
        expect.objectContaining({
          status: 'past_due',
        })
      );
    });

    it('should handle customer.subscription.deleted event', async () => {
      const mockEvent: Stripe.Event = {
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
          } as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test125', idempotency_key: null },
        type: 'customer.subscription.deleted',
      };

      (firestore.getUidByCustomerId as jest.Mock).mockResolvedValue('uid_test123');
      (firestore.upsertUserSubscriptionByCustomerId as jest.Mock).mockResolvedValue(undefined);
      (firestore.logStripeEvent as jest.Mock).mockResolvedValue(undefined);

      await applySubscriptionEvent(mockEvent);

      expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalledWith(
        'cus_test123',
        expect.objectContaining({
          plan: 'free',
          status: 'canceled',
          stripeSubscriptionId: null,
          stripePriceId: null,
        })
      );
    });

    it('should handle missing customer ID gracefully', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test126',
        object: 'event',
        api_version: '2024-06-20',
        created: 1234567893,
        data: {
          object: {
            id: 'sub_test123',
            object: 'subscription',
            customer: null as any,
            status: 'active',
            items: {
              data: [],
            },
          } as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test126', idempotency_key: null },
        type: 'customer.subscription.created',
      };

      await expect(applySubscriptionEvent(mockEvent)).rejects.toThrow('Missing customer ID');
    });

    it('should continue when no user mapping exists', async () => {
      const mockEvent: Stripe.Event = {
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
          } as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test127', idempotency_key: null },
        type: 'customer.subscription.created',
      };

      (firestore.getUidByCustomerId as jest.Mock).mockResolvedValue(null);
      (firestore.upsertUserSubscriptionByCustomerId as jest.Mock).mockResolvedValue(undefined);
      (firestore.logStripeEvent as jest.Mock).mockResolvedValue(undefined);

      // Should not throw, but should still attempt to update
      await applySubscriptionEvent(mockEvent);

      expect(firestore.upsertUserSubscriptionByCustomerId).toHaveBeenCalled();
    });
  });
});