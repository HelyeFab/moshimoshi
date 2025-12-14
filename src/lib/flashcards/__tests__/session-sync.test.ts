import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlashcardSessionManager } from '../SessionManager';

// Mock fetch for sync paths
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);
// Provide a fake indexedDB for idb
vi.stubGlobal('indexedDB', {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
});

describe('FlashcardSessionManager syncSessions', () => {
  let manager: FlashcardSessionManager;
  const sampleSession = {
    id: 'sess-1',
    userId: 'user-1',
    deckId: 'deck-1',
    deckName: 'Test Deck',
    timestamp: Date.now(),
    duration: 60000,
    cardsStudied: 10,
    cardsCorrect: 8,
    cardsIncorrect: 2,
    cardsSkipped: 0,
    accuracy: 0.8,
    newCards: 3,
    learningCards: 5,
    reviewCards: 2,
    averageResponseTime: 1200,
    fastestResponseTime: 800,
    slowestResponseTime: 2000
  };

  beforeEach(() => {
    manager = FlashcardSessionManager.getInstance();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns local sessions when not premium', async () => {
    const result = await manager.syncSessions('user-1', false, 10);
    expect(result).toEqual([]); // local DB is empty in test env
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches remote sessions when premium and caches them', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [sampleSession] })
    } as any);

    const result = await manager.syncSessions('user-1', true, 10);
    expect(result.length).toBe(1);
    expect(result[0].deckName).toBe('Test Deck');
    expect(mockFetch).toHaveBeenCalledWith('/api/flashcards/sessions?limit=10', { credentials: 'include' });
  });

  it('falls back to local on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as any);
    const result = await manager.syncSessions('user-1', true, 10);
    expect(result).toEqual([]);
  });
});
