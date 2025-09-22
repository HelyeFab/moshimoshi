/**
 * Entitlements System Integration Tests
 * Tests the complete flow from user action to entitlement decision
 */

import { evaluate } from '@/lib/entitlements/evaluator';
import { getLimit, getBucketKey, getResetTime } from '@/lib/entitlements/policy';
import { getFeature } from '@/lib/features/registry';
import { EvalContext, Decision } from '@/types/entitlements';
import { FeatureId } from '@/types/FeatureId';

describe('Entitlements Integration Tests', () => {
  const mockDate = new Date('2025-01-11T10:00:00Z');
  
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Guest User Flow', () => {
    it('should allow guest to practice hiragana up to 3 times daily', () => {
      const context: EvalContext = {
        userId: 'guest-123',
        plan: 'guest',
        usage: { hiragana_practice: 0, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString()
      };

      // First practice - should be allowed
      let decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(3);
      expect(decision.reason).toBe('ok');

      // Simulate 2 more practices
      context.usage.hiragana_practice = 2;
      decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(1);

      // 4th attempt - should be blocked
      context.usage.hiragana_practice = 3;
      decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(false);
      expect(decision.remaining).toBe(0);
      expect(decision.reason).toBe('limit_reached');
      expect(decision.resetAtUtc).toBeDefined();
    });

    it('should track hiragana and katakana limits separately', () => {
      const context: EvalContext = {
        userId: 'guest-123',
        plan: 'guest',
        usage: { hiragana_practice: 3, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString()
      };

      // Hiragana should be blocked
      const hiraganaDecision = evaluate('hiragana_practice', context);
      expect(hiraganaDecision.allow).toBe(false);

      // Katakana should still be allowed
      const katakanaDecision = evaluate('katakana_practice', context);
      expect(katakanaDecision.allow).toBe(true);
      expect(katakanaDecision.remaining).toBe(3);
    });
  });

  describe('Free User Flow', () => {
    it('should allow free users 5 practices daily', () => {
      const context: EvalContext = {
        userId: 'free-user-456',
        plan: 'free',
        usage: { hiragana_practice: 4, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString()
      };

      // 5th practice should be allowed
      let decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(1);

      // 6th practice should be blocked
      context.usage.hiragana_practice = 5;
      decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('limit_reached');
    });
  });

  describe('Premium User Flow', () => {
    it('should allow unlimited practices for premium monthly users', () => {
      const context: EvalContext = {
        userId: 'premium-user-789',
        plan: 'premium_monthly',
        usage: { hiragana_practice: 9999, katakana_practice: 9999 },
        nowUtcISO: mockDate.toISOString()
      };

      const hiraganaDecision = evaluate('hiragana_practice', context);
      expect(hiraganaDecision.allow).toBe(true);
      expect(hiraganaDecision.remaining).toBe(-1); // Unlimited
      expect(hiraganaDecision.reason).toBe('ok');

      const katakanaDecision = evaluate('katakana_practice', context);
      expect(katakanaDecision.allow).toBe(true);
      expect(katakanaDecision.remaining).toBe(-1);
    });

    it('should allow unlimited practices for premium yearly users', () => {
      const context: EvalContext = {
        userId: 'premium-yearly-user',
        plan: 'premium_yearly',
        usage: { hiragana_practice: 50000, katakana_practice: 50000 },
        nowUtcISO: mockDate.toISOString()
      };

      const decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(-1);
    });
  });

  describe('Override System', () => {
    it('should respect user-specific overrides', () => {
      const context: EvalContext = {
        userId: 'special-user',
        plan: 'free',
        usage: { hiragana_practice: 5, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString(),
        overrides: {
          hiragana_practice: 10 // Special override for this user
        }
      };

      // Should allow more than the normal free limit
      const decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(5);
    });

    it('should handle unlimited overrides', () => {
      const context: EvalContext = {
        userId: 'vip-user',
        plan: 'guest',
        usage: { hiragana_practice: 1000, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString(),
        overrides: {
          hiragana_practice: 'unlimited'
        }
      };

      const decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(-1);
    });
  });

  describe('Tenant Caps', () => {
    it('should apply tenant caps to premium users', () => {
      const context: EvalContext = {
        userId: 'corporate-user',
        plan: 'premium_monthly',
        usage: { hiragana_practice: 19, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString(),
        tenant: {
          id: 'corp-123',
          dailyCaps: {
            hiragana_practice: 20 // Corporate limit
          }
        }
      };

      // Should be limited by tenant cap, not unlimited premium
      let decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(1);

      // Should block at tenant cap
      context.usage.hiragana_practice = 20;
      decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('limit_reached');
    });

    it('should use lower of plan limit and tenant cap', () => {
      const context: EvalContext = {
        userId: 'restricted-user',
        plan: 'free',
        usage: { hiragana_practice: 2, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString(),
        tenant: {
          id: 'restricted-tenant',
          dailyCaps: {
            hiragana_practice: 3 // Lower than free plan's 5
          }
        }
      };

      const decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(1); // Tenant cap applies
    });
  });

  describe('Reset Time Calculations', () => {
    it('should calculate correct daily reset time', () => {
      const resetTime = getResetTime('daily', mockDate);
      expect(resetTime.toISOString()).toBe('2025-01-12T00:00:00.000Z');
    });

    it('should calculate correct weekly reset time', () => {
      const resetTime = getResetTime('weekly', mockDate);
      // Next Monday at midnight UTC
      expect(resetTime.getUTCDay()).toBe(1); // Monday
      expect(resetTime.getUTCHours()).toBe(0);
    });

    it('should calculate correct monthly reset time', () => {
      const resetTime = getResetTime('monthly', mockDate);
      expect(resetTime.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    });
  });

  describe('Bucket Key Generation', () => {
    it('should generate correct daily bucket key', () => {
      const key = getBucketKey('daily', mockDate);
      expect(key).toBe('2025-01-11');
    });

    it('should generate correct weekly bucket key', () => {
      const key = getBucketKey('weekly', mockDate);
      expect(key).toMatch(/^\d{4}-W\d{2}-\d{2}$/);
    });

    it('should generate correct monthly bucket key', () => {
      const key = getBucketKey('monthly', mockDate);
      expect(key).toBe('2025-01');
    });
  });

  describe('Feature Registry', () => {
    it('should retrieve correct feature definitions', () => {
      const hiragana = getFeature('hiragana_practice');
      expect(hiragana).toBeDefined();
      expect(hiragana.name).toBe('Hiragana Practice');
      expect(hiragana.limitType).toBe('daily');
      expect(hiragana.lifecycle).toBe('active');

      const katakana = getFeature('katakana_practice');
      expect(katakana).toBeDefined();
      expect(katakana.name).toBe('Katakana Practice');
    });
  });

  describe('Policy Version', () => {
    it('should include policy version in decisions', () => {
      const context: EvalContext = {
        userId: 'test-user',
        plan: 'free',
        usage: { hiragana_practice: 0, katakana_practice: 0 },
        nowUtcISO: mockDate.toISOString()
      };

      const decision = evaluate('hiragana_practice', context);
      expect(decision.policyVersion).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing usage data gracefully', () => {
      const context: EvalContext = {
        userId: 'new-user',
        plan: 'free',
        usage: {}, // No usage data
        nowUtcISO: mockDate.toISOString()
      };

      const decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(true);
      expect(decision.remaining).toBe(5);
    });

    it('should handle invalid feature IDs', () => {
      const context: EvalContext = {
        userId: 'test-user',
        plan: 'free',
        usage: {},
        nowUtcISO: mockDate.toISOString()
      };

      // This should throw or return an error decision
      expect(() => {
        evaluate('invalid_feature' as FeatureId, context);
      }).toThrow();
    });

    it('should handle timezone boundaries correctly', () => {
      // Test at 23:59:59 UTC
      const nearMidnight = new Date('2025-01-11T23:59:59Z');
      jest.setSystemTime(nearMidnight);

      const context: EvalContext = {
        userId: 'test-user',
        plan: 'free',
        usage: { hiragana_practice: 5, katakana_practice: 0 },
        nowUtcISO: nearMidnight.toISOString()
      };

      const decision = evaluate('hiragana_practice', context);
      expect(decision.allow).toBe(false);
      
      // Reset time should be just 1 second away
      const resetTime = new Date(decision.resetAtUtc!);
      expect(resetTime.toISOString()).toBe('2025-01-12T00:00:00.000Z');
    });
  });
});