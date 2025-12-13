import { AnkiDeckManager } from '../AnkiDeckManager';
import type { AnkiDeck, AnkiCard } from '../importer';

// Mock IndexedDB
const mockStore = {
  put: jest.fn(() => Promise.resolve()),
  get: jest.fn(),
  delete: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  index: jest.fn(() => ({
    getAllKeys: jest.fn(() => Promise.resolve([])),
  })),
};

const mockDb = {
  get: jest.fn(),
  put: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllFromIndex: jest.fn(() => Promise.resolve([])),
  transaction: jest.fn(() => ({
    store: mockStore,
    done: Promise.resolve(),
  })),
  close: jest.fn(),
};

jest.mock('idb', () => ({
  openDB: jest.fn(() => Promise.resolve(mockDb)),
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('AnkiDeckManager', () => {
  let manager: AnkiDeckManager;

  beforeEach(() => {
    // Get a fresh instance
    manager = AnkiDeckManager.getInstance();
    jest.clearAllMocks();

    // Reset mock implementations
    mockDb.getAllFromIndex.mockResolvedValue([]);
    mockDb.get.mockResolvedValue(null);
    mockDb.put.mockResolvedValue(undefined);
    mockDb.delete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AnkiDeckManager.getInstance();
      const instance2 = AnkiDeckManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getDecks', () => {
    it('should return empty array for guest user', async () => {
      const decks = await manager.getDecks('guest', false);
      expect(decks).toEqual([]);
    });

    it('should fetch from IndexedDB for free users', async () => {
      const mockDecks = [createMockAnkiDeck('deck-1'), createMockAnkiDeck('deck-2')];
      mockDb.getAllFromIndex.mockResolvedValue(mockDecks);

      const decks = await manager.getDecks('user-123', false);

      expect(decks).toHaveLength(2);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch from server for premium users', async () => {
      const mockDecks = [createMockAnkiDeck('deck-1')];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ decks: mockDecks }),
      });

      const decks = await manager.getDecks('user-123', true);

      expect(mockFetch).toHaveBeenCalledWith('/api/anki/decks', {
        method: 'GET',
        credentials: 'include',
      });
      expect(decks).toHaveLength(1);
    });

    it('should fall back to IndexedDB when server request fails for premium users', async () => {
      const mockDecks = [createMockAnkiDeck('deck-1')];
      mockFetch.mockRejectedValue(new Error('Network error'));
      mockDb.getAllFromIndex.mockResolvedValue(mockDecks);

      const decks = await manager.getDecks('user-123', true);

      expect(decks).toHaveLength(1);
    });

    it('should sort decks by updatedAt descending', async () => {
      const olderDeck = createMockAnkiDeck('deck-1');
      olderDeck.updatedAt = 1000;
      const newerDeck = createMockAnkiDeck('deck-2');
      newerDeck.updatedAt = 2000;

      mockDb.getAllFromIndex.mockResolvedValue([olderDeck, newerDeck]);

      const decks = await manager.getDecks('user-123', false);

      expect(decks[0].id).toBe('deck-2');
      expect(decks[1].id).toBe('deck-1');
    });
  });

  describe('getDeck', () => {
    it('should return deck if found and belongs to user', async () => {
      const mockDeck = createMockAnkiDeck('deck-1');
      mockDeck.userId = 'user-123';
      mockDb.get.mockResolvedValue(mockDeck);

      const deck = await manager.getDeck('deck-1', 'user-123');

      expect(deck).toBeDefined();
      expect(deck?.id).toBe('deck-1');
    });

    it('should return null if deck not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const deck = await manager.getDeck('non-existent', 'user-123');

      expect(deck).toBeNull();
    });

    it('should return null if deck belongs to different user', async () => {
      const mockDeck = createMockAnkiDeck('deck-1');
      mockDeck.userId = 'other-user';
      mockDb.get.mockResolvedValue(mockDeck);

      const deck = await manager.getDeck('deck-1', 'user-123');

      expect(deck).toBeNull();
    });
  });

  describe('saveDeck', () => {
    it('should save to IndexedDB for free users', async () => {
      const deck = createMockAnkiDeck('deck-1');

      const savedDeck = await manager.saveDeck(deck, 'user-123', false, 'test.apkg');

      expect(mockDb.put).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(savedDeck.userId).toBe('user-123');
      expect(savedDeck.metadata?.originalFilename).toBe('test.apkg');
    });

    it('should save to server and IndexedDB for premium users', async () => {
      const deck = createMockAnkiDeck('deck-1');
      const serverDeck = { ...deck, userId: 'user-123' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ deck: serverDeck }),
      });

      const savedDeck = await manager.saveDeck(deck, 'user-123', true, 'test.apkg');

      expect(mockFetch).toHaveBeenCalledWith('/api/anki/decks', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }));
      expect(mockDb.put).toHaveBeenCalled();
    });

    it('should fall back to IndexedDB when server save fails for premium users', async () => {
      const deck = createMockAnkiDeck('deck-1');
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const savedDeck = await manager.saveDeck(deck, 'user-123', true, 'test.apkg');

      expect(mockDb.put).toHaveBeenCalled();
      expect(savedDeck.userId).toBe('user-123');
    });

    it('should add metadata to saved deck', async () => {
      const deck = createMockAnkiDeck('deck-1');

      const savedDeck = await manager.saveDeck(deck, 'user-123', false, 'Core2000.apkg');

      expect(savedDeck.metadata).toBeDefined();
      expect(savedDeck.metadata?.originalFilename).toBe('Core2000.apkg');
      expect(savedDeck.metadata?.importedAt).toBeDefined();
      expect(savedDeck.metadata?.hasMedia).toBe(false);
    });

    it('should set hasMedia true when deck has media', async () => {
      const deck = createMockAnkiDeck('deck-1');
      deck.mediaUrls = new Map([['audio1.mp3', 'blob:url1']]);

      const savedDeck = await manager.saveDeck(deck, 'user-123', false);

      expect(savedDeck.metadata?.hasMedia).toBe(true);
    });
  });

  describe('updateDeck', () => {
    it('should update deck name in IndexedDB for free users', async () => {
      const existingDeck = createMockAnkiDeck('deck-1');
      existingDeck.userId = 'user-123';
      mockDb.get.mockResolvedValue(existingDeck);

      const updatedDeck = await manager.updateDeck(
        'deck-1',
        { name: 'Updated Name' },
        'user-123',
        false
      );

      expect(updatedDeck?.name).toBe('Updated Name');
      expect(mockDb.put).toHaveBeenCalled();
    });

    it('should return null when deck not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const updatedDeck = await manager.updateDeck(
        'non-existent',
        { name: 'Updated Name' },
        'user-123',
        false
      );

      expect(updatedDeck).toBeNull();
    });

    it('should update on server for premium users', async () => {
      const existingDeck = createMockAnkiDeck('deck-1');
      existingDeck.userId = 'user-123';
      mockDb.get.mockResolvedValue(existingDeck);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ deck: { ...existingDeck, name: 'Updated Name' } }),
      });

      const updatedDeck = await manager.updateDeck(
        'deck-1',
        { name: 'Updated Name' },
        'user-123',
        true
      );

      expect(mockFetch).toHaveBeenCalledWith('/api/anki/decks/deck-1', expect.objectContaining({
        method: 'PUT',
      }));
    });
  });

  describe('deleteDeck', () => {
    it('should delete from IndexedDB for free users', async () => {
      const existingDeck = createMockAnkiDeck('deck-1');
      existingDeck.userId = 'user-123';
      mockDb.get.mockResolvedValue(existingDeck);

      const success = await manager.deleteDeck('deck-1', 'user-123', false);

      expect(success).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledWith('decks', 'deck-1');
    });

    it('should return false when deck not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const success = await manager.deleteDeck('non-existent', 'user-123', false);

      expect(success).toBe(false);
    });

    it('should delete from server for premium users', async () => {
      const existingDeck = createMockAnkiDeck('deck-1');
      existingDeck.userId = 'user-123';
      mockDb.get.mockResolvedValue(existingDeck);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const success = await manager.deleteDeck('deck-1', 'user-123', true);

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/anki/decks/deck-1', expect.objectContaining({
        method: 'DELETE',
      }));
    });
  });

  describe('Listener Pattern', () => {
    it('should notify listeners when decks change', async () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribe('decks-changed', callback);

      const deck = createMockAnkiDeck('deck-1');
      await manager.saveDeck(deck, 'user-123', false);

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });

    it('should not notify after unsubscribe', async () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribe('decks-changed', callback);
      unsubscribe();

      const deck = createMockAnkiDeck('deck-1');
      await manager.saveDeck(deck, 'user-123', false);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('syncAllToFirebase', () => {
    it('should sync all local decks to Firebase', async () => {
      const mockDecks = [
        createMockAnkiDeck('deck-1'),
        createMockAnkiDeck('deck-2'),
      ];
      mockDecks.forEach(d => (d.userId = 'user-123'));
      mockDb.getAllFromIndex.mockResolvedValue(mockDecks);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ deck: {} }),
      });

      const result = await manager.syncAllToFirebase('user-123');

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should count failed syncs', async () => {
      const mockDecks = [createMockAnkiDeck('deck-1')];
      mockDecks[0].userId = 'user-123';
      mockDb.getAllFromIndex.mockResolvedValue(mockDecks);
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const result = await manager.syncAllToFirebase('user-123');

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('clearLocalData', () => {
    it('should clear all local data', async () => {
      await manager.clearLocalData();

      expect(mockDb.clear).toHaveBeenCalledWith('decks');
    });
  });
});

// Helper function to create mock AnkiDeck
function createMockAnkiDeck(id: string): AnkiDeck & { userId?: string; createdAt?: number; updatedAt?: number } {
  return {
    id,
    name: `Test Deck ${id}`,
    description: 'A test deck',
    cards: [
      {
        id: `${id}-card-1`,
        front: 'Question 1',
        back: 'Answer 1',
        tags: ['test'],
        deckName: `Test Deck ${id}`,
        contentType: 'anki-card',
        primaryDisplay: 'Question 1',
        primaryAnswer: 'Answer 1',
        contentId: `${id}-card-1`,
      } as AnkiCard,
    ],
    mediaUrls: new Map(),
    userId: 'test-user',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
