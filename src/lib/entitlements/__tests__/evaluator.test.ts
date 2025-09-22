/**
 * Evaluator Unit Tests
 * Agent 2 Implementation
 */

import { evaluate, getTodayBucket, getDecisionMessage } from '../evaluator';
import { EvalContext, FeatureId } from '@/types/entitlements';

describe('Entitlements Evaluator', () => {
  const baseContext: EvalContext = {
    userId: 'test-user-123',
    plan: 'free',
    usage: {
      hiragana_practice: 0,
      katakana_practice: 0
    },
    nowUtcISO: '2025-01-11T10:00:00.000Z'
  };

  describe('evaluate()', () => {
    describe('Guest Plan', () => {
      it('should allow 3 daily uses for hiragana practice', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'guest',
          usage: { hiragana_practice: 2, katakana_practice: 0 }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(true);
        expect(decision.remaining).toBe(1);
        expect(decision.reason).toBe('ok');
        expect(decision.limit).toBe(3);
      });

      it('should block when guest limit reached', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'guest',
          usage: { hiragana_practice: 3, katakana_practice: 0 }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(false);
        expect(decision.remaining).toBe(0);
        expect(decision.reason).toBe('limit_reached');
      });

      it('should track katakana separately from hiragana', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'guest',
          usage: { hiragana_practice: 3, katakana_practice: 1 }
        };

        const hiraganaDecision = evaluate('hiragana_practice', ctx);
        const katakanaDecision = evaluate('katakana_practice', ctx);
        
        expect(hiraganaDecision.allow).toBe(false);
        expect(katakanaDecision.allow).toBe(true);
        expect(katakanaDecision.remaining).toBe(2);
      });
    });

    describe('Free Plan', () => {
      it('should allow 5 daily uses for hiragana practice', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'free',
          usage: { hiragana_practice: 4, katakana_practice: 0 }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(true);
        expect(decision.remaining).toBe(1);
        expect(decision.limit).toBe(5);
      });

      it('should block when free limit reached', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'free',
          usage: { hiragana_practice: 5, katakana_practice: 0 }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(false);
        expect(decision.remaining).toBe(0);
        expect(decision.reason).toBe('limit_reached');
      });
    });

    describe('Premium Plans', () => {
      it('should allow unlimited uses for premium_monthly', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'premium_monthly',
          usage: { hiragana_practice: 100, katakana_practice: 200 }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(true);
        expect(decision.remaining).toBe(-1); // -1 means unlimited
        expect(decision.reason).toBe('ok');
        expect(decision.limit).toBe(-1);
      });

      it('should allow unlimited uses for premium_yearly', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'premium_yearly',
          usage: { hiragana_practice: 1000, katakana_practice: 2000 }
        };

        const hiraganaDecision = evaluate('hiragana_practice', ctx);
        const katakanaDecision = evaluate('katakana_practice', ctx);
        
        expect(hiraganaDecision.allow).toBe(true);
        expect(hiraganaDecision.remaining).toBe(-1);
        expect(katakanaDecision.allow).toBe(true);
        expect(katakanaDecision.remaining).toBe(-1);
      });
    });

    describe('Overrides', () => {
      it('should apply numeric override', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'free',
          usage: { hiragana_practice: 2, katakana_practice: 0 },
          overrides: { hiragana_practice: 10 }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(true);
        expect(decision.remaining).toBe(8);
        expect(decision.limit).toBe(10);
      });

      it('should apply unlimited override', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'free',
          usage: { hiragana_practice: 100, katakana_practice: 0 },
          overrides: { hiragana_practice: 'unlimited' }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(true);
        expect(decision.remaining).toBe(-1);
      });

      it('should respect override of 0', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'premium_monthly',
          usage: { hiragana_practice: 0, katakana_practice: 0 },
          overrides: { hiragana_practice: 0 }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(false);
        expect(decision.remaining).toBe(0);
        expect(decision.limit).toBe(0);
      });
    });

    describe('Tenant Caps', () => {
      it('should apply tenant daily cap', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'premium_monthly',
          usage: { hiragana_practice: 8, katakana_practice: 0 },
          tenant: {
            id: 'school-123',
            dailyCaps: { hiragana_practice: 10 }
          }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(true);
        expect(decision.remaining).toBe(2);
        expect(decision.limit).toBe(10);
      });

      it('should use minimum of plan limit and tenant cap', () => {
        const ctx: EvalContext = {
          ...baseContext,
          plan: 'free',
          usage: { hiragana_practice: 2, katakana_practice: 0 },
          tenant: {
            id: 'school-123',
            dailyCaps: { hiragana_practice: 3 }
          }
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.allow).toBe(true);
        expect(decision.remaining).toBe(1);
        expect(decision.limit).toBe(3); // Min of 5 (free) and 3 (tenant)
      });
    });

    describe('Reset Time', () => {
      it('should calculate daily reset at midnight UTC', () => {
        const ctx: EvalContext = {
          ...baseContext,
          nowUtcISO: '2025-01-11T15:30:00.000Z'
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.resetAtUtc).toBe('2025-01-12T00:00:00.000Z');
      });

      it('should handle end of month correctly', () => {
        const ctx: EvalContext = {
          ...baseContext,
          nowUtcISO: '2025-01-31T23:59:59.000Z'
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.resetAtUtc).toBe('2025-02-01T00:00:00.000Z');
      });

      it('should handle end of year correctly', () => {
        const ctx: EvalContext = {
          ...baseContext,
          nowUtcISO: '2025-12-31T23:59:59.000Z'
        };

        const decision = evaluate('hiragana_practice', ctx);
        
        expect(decision.resetAtUtc).toBe('2026-01-01T00:00:00.000Z');
      });
    });
  });

  describe('getTodayBucket()', () => {
    it('should format date as YYYY-MM-DD', () => {
      expect(getTodayBucket('2025-01-11T10:00:00.000Z')).toBe('2025-01-11');
      expect(getTodayBucket('2025-12-31T23:59:59.999Z')).toBe('2025-12-31');
      expect(getTodayBucket('2025-01-01T00:00:00.000Z')).toBe('2025-01-01');
    });

    it('should handle different timezones correctly (always UTC)', () => {
      // 11:00 PM on Jan 10 in PST is 7:00 AM on Jan 11 in UTC
      const pstTime = '2025-01-11T07:00:00.000Z';
      expect(getTodayBucket(pstTime)).toBe('2025-01-11');
    });
  });

  describe('getDecisionMessage()', () => {
    it('should return appropriate messages for each reason', () => {
      expect(getDecisionMessage({ 
        allow: true, 
        remaining: 3, 
        reason: 'ok',
        policyVersion: 1 
      })).toBe('3 uses remaining today');

      expect(getDecisionMessage({ 
        allow: true, 
        remaining: -1, 
        reason: 'ok',
        policyVersion: 1 
      })).toBe('Unlimited access');

      expect(getDecisionMessage({ 
        allow: false, 
        remaining: 0, 
        reason: 'limit_reached',
        policyVersion: 1 
      })).toBe('Daily limit reached. Resets at midnight UTC.');

      expect(getDecisionMessage({ 
        allow: false, 
        remaining: 0, 
        reason: 'no_permission',
        policyVersion: 1 
      })).toBe('Upgrade to premium for unlimited access');

      expect(getDecisionMessage({ 
        allow: false, 
        remaining: 0, 
        reason: 'lifecycle_blocked',
        policyVersion: 1 
      })).toBe('This feature is currently unavailable');
    });
  });
});

describe('Edge Cases', () => {
  const baseContext: EvalContext = {
    userId: 'test-user-123',
    plan: 'free',
    usage: {
      hiragana_practice: 0,
      katakana_practice: 0
    },
    nowUtcISO: '2025-01-11T10:00:00.000Z'
  };

  it('should handle invalid feature ID gracefully', () => {
    const decision = evaluate('invalid_feature' as FeatureId, baseContext);
    
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('lifecycle_blocked');
  });

  it('should handle missing usage data', () => {
    const ctx: EvalContext = {
      ...baseContext,
      usage: {} as any
    };

    const decision = evaluate('hiragana_practice', ctx);
    
    expect(decision.allow).toBe(true);
    expect(decision.remaining).toBe(5);
  });

  it('should handle negative usage (data corruption)', () => {
    const ctx: EvalContext = {
      ...baseContext,
      usage: { hiragana_practice: -5, katakana_practice: 0 }
    };

    const decision = evaluate('hiragana_practice', ctx);
    
    // Should treat negative as 0
    expect(decision.allow).toBe(true);
    expect(decision.remaining).toBe(5);
  });
});