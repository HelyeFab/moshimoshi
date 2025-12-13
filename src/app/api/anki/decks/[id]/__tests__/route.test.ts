import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../route';

// Mock dependencies
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
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

describe('Anki Deck [id] API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/anki/decks/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      (getSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return local storage indicator for free users', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');

      (getSession as any).mockResolvedValue({ uid: 'user-123' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: false,
        storageLocation: 'local',
        isPremium: false,
        plan: 'free',
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deck).toBeNull();
      expect(data.storage.location).toBe('local');
    });

    it('should return deck from Firebase for premium users', async () => {
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

      const mockDeck = {
        id: 'deck-123',
        name: 'Test Deck',
        cards: [],
      };

      (adminDb.collection as any).mockReturnValue({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn(() =>
                Promise.resolve({
                  exists: true,
                  id: 'deck-123',
                  data: () => mockDeck,
                })
              ),
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deck.id).toBe('deck-123');
    });

    it('should return 404 when deck not found', async () => {
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

      (adminDb.collection as any).mockReturnValue({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn(() =>
                Promise.resolve({
                  exists: false,
                })
              ),
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/non-existent');
      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Deck not found');
    });
  });

  describe('PUT /api/anki/decks/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      (getSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return success for free users (local only update)', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');

      (getSession as any).mockResolvedValue({ uid: 'user-123' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: false,
        storageLocation: 'local',
        isPremium: false,
        plan: 'free',
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should update deck in Firebase for premium users', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');
      const { adminDb } = await import('@/lib/firebase/admin');

      const mockUpdate = jest.fn(() => Promise.resolve());
      const mockGet = jest.fn(() =>
        Promise.resolve({
          exists: true,
          id: 'deck-123',
          data: () => ({ name: 'Updated Name', cardCount: 10 }),
        })
      );

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
              get: mockGet,
              update: mockUpdate,
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return 404 when deck not found for premium users', async () => {
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

      (adminDb.collection as any).mockReturnValue({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn(() =>
                Promise.resolve({
                  exists: false,
                })
              ),
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Deck not found');
    });
  });

  describe('DELETE /api/anki/decks/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      (getSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return success for free users (local only delete)', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');

      (getSession as any).mockResolvedValue({ uid: 'user-123' });
      (getStorageDecision as any).mockResolvedValue({
        shouldWriteToFirebase: false,
        storageLocation: 'local',
        isPremium: false,
        plan: 'free',
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should delete deck from Firebase for premium users', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getStorageDecision } = await import('@/lib/api/storage-helper');
      const { adminDb } = await import('@/lib/firebase/admin');

      const mockDelete = jest.fn(() => Promise.resolve());
      const mockGet = jest.fn(() =>
        Promise.resolve({
          exists: true,
          id: 'deck-123',
          data: () => ({ name: 'Test Deck' }),
        })
      );

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
              get: mockGet,
              delete: mockDelete,
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/deck-123', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'deck-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deletedId).toBe('deck-123');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return 404 when deck not found for premium users', async () => {
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

      (adminDb.collection as any).mockReturnValue({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              get: jest.fn(() =>
                Promise.resolve({
                  exists: false,
                })
              ),
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/anki/decks/non-existent', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Deck not found');
    });
  });
});
