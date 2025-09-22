/**
 * Basic test to verify entitlements system works
 */

import { evaluate } from '../src/lib/entitlements/evaluator';
import { getLimit, getBucketKey } from '../src/lib/entitlements/policy';
import { getFeature } from '../src/lib/features/registry';

describe('Basic Entitlements Test', () => {
  test('Code generation produces valid files', () => {
    // Test that generated files export expected functions
    expect(typeof getLimit).toBe('function');
    expect(typeof getBucketKey).toBe('function');
    expect(typeof getFeature).toBe('function');
  });

  test('Guest user has 3 daily practices', () => {
    const context = {
      userId: 'guest-123',
      plan: 'guest' as const,
      usage: { hiragana_practice: 0, katakana_practice: 0 },
      nowUtcISO: new Date().toISOString()
    };

    const decision = evaluate('hiragana_practice', context);
    
    expect(decision.allow).toBe(true);
    expect(decision.remaining).toBe(3);
    expect(decision.reason).toBe('ok');
  });

  test('Free user has 5 daily practices', () => {
    const context = {
      userId: 'free-user',
      plan: 'free' as const,
      usage: { hiragana_practice: 0, katakana_practice: 0 },
      nowUtcISO: new Date().toISOString()
    };

    const decision = evaluate('hiragana_practice', context);
    
    expect(decision.allow).toBe(true);
    expect(decision.remaining).toBe(5);
  });

  test('Premium user has unlimited practices', () => {
    const context = {
      userId: 'premium-user',
      plan: 'premium_monthly' as const,
      usage: { hiragana_practice: 999, katakana_practice: 999 },
      nowUtcISO: new Date().toISOString()
    };

    const decision = evaluate('hiragana_practice', context);
    
    expect(decision.allow).toBe(true);
    expect(decision.remaining).toBe(-1); // -1 means unlimited
  });

  test('Limits are enforced correctly', () => {
    const context = {
      userId: 'guest-123',
      plan: 'guest' as const,
      usage: { hiragana_practice: 3, katakana_practice: 0 }, // Already used 3
      nowUtcISO: new Date().toISOString()
    };

    const decision = evaluate('hiragana_practice', context);
    
    expect(decision.allow).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.reason).toBe('limit_reached');
  });

  test('Feature registry returns correct definitions', () => {
    const hiragana = getFeature('hiragana_practice');
    expect(hiragana).toBeDefined();
    expect(hiragana.name).toBe('Hiragana Practice');
    expect(hiragana.limitType).toBe('daily');
  });

  test('Bucket key generation works', () => {
    const key = getBucketKey('daily', new Date('2025-01-11'));
    expect(key).toBe('2025-01-11');
  });
});