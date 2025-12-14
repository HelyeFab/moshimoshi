import { describe, it, expect } from 'vitest';
import { validateSessionPayload } from '../sessionValidation';

const basePayload = {
  id: 'sess-1',
  userId: 'user-1',
  deckId: 'deck-1',
  deckName: 'Test Deck',
  timestamp: Date.now(),
  duration: 60000,
  cardsStudied: 20,
  cardsCorrect: 18,
  cardsIncorrect: 2,
  cardsSkipped: 0,
  accuracy: 0.9,
  newCards: 5,
  learningCards: 10,
  reviewCards: 5,
  averageResponseTime: 1500,
  fastestResponseTime: 800,
  slowestResponseTime: 2500,
};

describe('validateSessionPayload', () => {
  it('accepts a valid payload', () => {
    const result = validateSessionPayload(basePayload);
    expect(result).not.toBeNull();
    expect(result?.deckName).toBe('Test Deck');
  });

  it('rejects missing fields', () => {
    const result = validateSessionPayload({ ...basePayload, deckId: undefined });
    expect(result).toBeNull();
  });

  it('rejects non-numeric required numbers', () => {
    const result = validateSessionPayload({ ...basePayload, duration: 'oops' });
    expect(result).toBeNull();
  });
});
