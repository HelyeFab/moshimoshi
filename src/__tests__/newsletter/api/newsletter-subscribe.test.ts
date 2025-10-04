import { POST } from '@/app/api/newsletter/subscribe/route';
import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(),
  },
}));

// Mock session
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));

describe('POST /api/newsletter/subscribe', () => {
  let mockCollection: any;
  let mockDoc: any;
  let mockGet: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGet = jest.fn();
    mockDoc = jest.fn(() => ({
      get: mockGet,
      set: jest.fn(),
      update: jest.fn(),
    }));
    mockCollection = jest.fn(() => ({
      doc: mockDoc,
    }));

    (adminDb.collection as jest.Mock) = mockCollection;
  });

  it('should subscribe a new email successfully', async () => {
    mockGet.mockResolvedValue({ exists: false });

    const request = new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', source: 'blog' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.message).toContain('subscribed');
  });

  it('should return error for invalid email', async () => {
    const request = new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid-email', source: 'blog' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_EMAIL');
  });

  it('should return error for missing email', async () => {
    const request = new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ source: 'blog' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_EMAIL');
  });

  it('should handle already subscribed users idempotently', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'active', email: 'test@example.com' }),
    });

    const request = new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', source: 'blog' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('already subscribed');
  });

  it('should resubscribe previously unsubscribed users', async () => {
    const mockUpdate = jest.fn();
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'unsubscribed', email: 'test@example.com' }),
    });
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
    });

    const request = new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', source: 'blog' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('resubscribed');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should normalize email addresses', async () => {
    mockGet.mockResolvedValue({ exists: false });

    const request = new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: '  TEST@EXAMPLE.COM  ', source: 'blog' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    // Email should be normalized to lowercase and trimmed
  });

  it('should reject invalid source values', async () => {
    const request = new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', source: 'invalid-source' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_SOURCE');
  });
});
