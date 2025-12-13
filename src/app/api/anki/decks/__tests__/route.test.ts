import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn(() => Promise.resolve()),
            get: jest.fn(() => Promise.resolve({ exists: false })),
          })),
          orderBy: jest.fn(() => ({
            get: jest.fn(() =>
              Promise.resolve({
                docs: [],
              })
            ),
          })),
        })),
      })),
    })),
  },
}));

jest.mock('@/lib/api/storage-helper', () => ({
  getStorageDecision: jest.fn(),
  createStorageResponse: jest.fn((data, decision) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({
      success: true,
      data,
      storage: {
        location: decision.storageLocation,
        syncEnabled: decision.shouldWriteToFirebase,
        plan: decision.plan,
      },
    });
  }),
}));

jest.mock('@/lib/utils/cleanFirestoreData', () => ({
  cleanFirestoreData: jest.fn((data) => data),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

describe('Anki Decks API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/anki/decks', () => {
    it('should return 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      (getSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/anki/decks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty array with local storage indicator for free users', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');

      (getSession as any).mockResolvedValue({ uid: 'user-123' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: false,
        storageLocation: 'local',
        isPremium: false,
        plan: 'free',
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.decks).toEqual([]);
      expect(data.storage.location).toBe('local');
    });

    it('should return decks from Firebase for premium users', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');
      const { adminDb } = await import('@/lib/firebase/admin');

      (getSession as any).mockResolvedValue({ uid: 'premium-user' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: true,
        storageLocation: 'both',
        isPremium: true,
        plan: 'premium_monthly',
      });

      const mockDocs = [
        {
          id: 'deck-1',
          data: () => ({ name: 'Test Deck', cardCount: 10 }),
        },
      ];

      (adminDb.collection as any).mockReturnValue({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              get: jest.fn(() =>
                Promise.resolve({
                  docs: mockDocs,
                })
              ),
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.decks).toHaveLength(1);
      expect(data.decks[0].id).toBe('deck-1');
    });
  });

  describe('POST /api/anki/decks', () => {
    it('should return 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      (getSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/anki/decks', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', cards: [] }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when missing required fields', async () => {
      const { getSession } = await import('@/lib/auth/session');
      (getSession as any).mockResolvedValue({ uid: 'user-123' });

      const request = new NextRequest('http://localhost:3000/api/anki/decks', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }), // Missing cards
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should save deck for free users (local storage only)', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');

      (getSession as any).mockResolvedValue({ uid: 'user-123' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: false,
        storageLocation: 'local',
        isPremium: false,
        plan: 'free',
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Deck',
          cards: [{ id: 'card-1', front: 'Q', back: 'A' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deck.name).toBe('Test Deck');
      expect(data.storage.location).toBe('local');
    });

    it('should save deck to Firebase for premium users', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');
      const { adminDb } = await import('@/lib/firebase/admin');
      const mockSet = jest.fn(() => Promise.resolve());

      (getSession as any).mockResolvedValue({ uid: 'premium-user' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: true,
        storageLocation: 'both',
        isPremium: true,
        plan: 'premium_monthly',
      });

      (adminDb.collection as any).mockReturnValue({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              set: mockSet,
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Premium Test Deck',
          cards: [{ id: 'card-1', front: 'Q', back: 'A' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSet).toHaveBeenCalled();
    });

    it('should use provided deck ID if available', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');

      (getSession as any).mockResolvedValue({ uid: 'user-123' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: false,
        storageLocation: 'local',
        isPremium: false,
        plan: 'free',
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks', {
        method: 'POST',
        body: JSON.stringify({
          id: 'custom-deck-id',
          name: 'Test Deck',
          cards: [],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.deck.id).toBe('custom-deck-id');
    });

    it('should include metadata in saved deck', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');

      (getSession as any).mockResolvedValue({ uid: 'user-123' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: false,
        storageLocation: 'local',
        isPremium: false,
        plan: 'free',
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Deck',
          cards: [{ id: 'c1', front: 'Q', back: 'A' }],
          metadata: {
            originalFilename: 'Core2000.apkg',
            hasMedia: true,
          },
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.deck.metadata).toBeDefined();
      expect(data.data.deck.metadata.originalFilename).toBe('Core2000.apkg');
      expect(data.data.deck.metadata.hasMedia).toBe(true);
    });
  });
});
