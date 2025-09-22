/**
 * API Test Infrastructure
 * Provides utilities for testing Next.js API routes
 */

import { NextRequest } from 'next/server';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { reviewLogger } from '@/lib/monitoring/logger';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
  },
  firestore: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
    })),
  },
}));

// Mock Redis
jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  },
}));

// MSW Server for external API mocking
export const mockServer = setupServer(
  rest.get('https://api.example.com/*', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ success: true }));
  })
);

// API Route Test Helper
export class ApiRouteTestHelper {
  static createMockNextRequest(options: {
    method?: RequestMethod;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
    cookies?: Record<string, string>;
  }): NextRequest {
    const {
      method = 'GET',
      url = 'http://localhost:3000/api/test',
      headers = {},
      body = null,
      query = {},
      cookies = {},
    } = options;

    const request = new NextRequest(url, {
      method: method as string,
      headers: new Headers({
        'Content-Type': 'application/json',
        ...headers,
      }),
      body: body ? JSON.stringify(body) : null,
    });

    // Add query params
    Object.entries(query).forEach(([key, value]) => {
      request.nextUrl.searchParams.set(key, value);
    });

    // Mock cookies
    (request as any).cookies = {
      get: (name: string) => cookies[name],
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
    };

    return request;
  }

  static async parseResponse(response: Response): Promise<{
    status: number;
    data: any;
    headers: Record<string, string>;
  }> {
    const data = await response.json();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      data,
      headers,
    };
  }

  static async mockAuthUser(uid: string = 'test-user-id', customClaims: any = {}) {
    const { auth: mockAuth } = await import('@/lib/firebase/admin');
    
    mockAuth.verifyIdToken.mockResolvedValue({
      uid,
      email: `${uid}@test.com`,
      email_verified: true,
      ...customClaims,
    });

    mockAuth.getUser.mockResolvedValue({
      uid,
      email: `${uid}@test.com`,
      emailVerified: true,
      customClaims,
    });

    return {
      uid,
      email: `${uid}@test.com`,
      customClaims,
    };
  }

  static mockPremiumUser(uid: string = 'premium-user-id') {
    return this.mockAuthUser(uid, {
      stripeCustomerId: 'cus_premium123',
      subscription: {
        tier: 'premium',
        status: 'active',
      },
    });
  }

  static async mockRedisData(data: Record<string, any>) {
    const { redis: mockRedis } = await import('@/lib/redis/client');
    
    Object.entries(data).forEach(([key, value]) => {
      mockRedis.get.mockImplementation((k: string) => {
        if (k === key) return Promise.resolve(JSON.stringify(value));
        return Promise.resolve(null);
      });
    });

    mockRedis.exists.mockImplementation((k: string) => {
      return Promise.resolve(data.hasOwnProperty(k) ? 1 : 0);
    });
  }

  static async mockFirestoreData(collection: string, documents: Record<string, any>) {
    const { firestore: mockFirestore } = await import('@/lib/firebase/admin');
    
    mockFirestore.collection.mockImplementation((col: string) => {
      if (col !== collection) return { doc: jest.fn() };
      
      return {
        doc: jest.fn((id: string) => ({
          get: jest.fn(() => 
            Promise.resolve({
              exists: documents.hasOwnProperty(id),
              data: () => documents[id],
              id,
            })
          ),
          set: jest.fn(() => Promise.resolve()),
          update: jest.fn(() => Promise.resolve()),
          delete: jest.fn(() => Promise.resolve()),
        })),
        where: jest.fn(() => ({
          get: jest.fn(() => 
            Promise.resolve({
              docs: Object.entries(documents).map(([id, data]) => ({
                id,
                data: () => data,
              })),
            })
          ),
        })),
      };
    });
  }

  static expectSuccessResponse(response: any) {
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
  }

  static expectErrorResponse(response: any, statusCode: number, errorCode?: string) {
    expect(response.status).toBe(statusCode);
    expect(response.data.success).toBe(false);
    if (errorCode) {
      expect(response.data.error.code).toBe(errorCode);
    }
  }

  static async measureApiPerformance<T>(
    apiCall: () => Promise<T>,
    maxMs: number = 200
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await apiCall();
    const duration = performance.now() - start;
    
    if (duration > maxMs) {
      reviewLogger.warn(`API Performance warning: Call took ${duration}ms (max: ${maxMs}ms)`);
    }
    
    return { result, duration };
  }
}

// Rate Limit Test Helper
export class RateLimitTestHelper {
  static async testRateLimit(
    makeRequest: () => Promise<any>,
    limit: number,
    windowMs: number = 60000
  ) {
    const results = [];
    
    // Make requests up to the limit
    for (let i = 0; i < limit; i++) {
      const response = await makeRequest();
      results.push(response);
      expect(response.status).toBe(200);
    }
    
    // Next request should be rate limited
    const limitedResponse = await makeRequest();
    expect(limitedResponse.status).toBe(429);
    
    return { successfulRequests: results, limitedResponse };
  }
}

// Validation Test Helper
export class ValidationTestHelper {
  static testInvalidInputs(
    makeRequest: (body: any) => Promise<any>,
    invalidInputs: Array<{ input: any; expectedError: string }>
  ) {
    return Promise.all(
      invalidInputs.map(async ({ input, expectedError }) => {
        const response = await makeRequest(input);
        expect(response.status).toBe(400);
        expect(response.data.error.message).toContain(expectedError);
      })
    );
  }

  static testRequiredFields(
    makeRequest: (body: any) => Promise<any>,
    validBody: any,
    requiredFields: string[]
  ) {
    return Promise.all(
      requiredFields.map(async (field) => {
        const invalidBody = { ...validBody };
        delete invalidBody[field];
        
        const response = await makeRequest(invalidBody);
        expect(response.status).toBe(400);
        expect(response.data.error.message).toContain(field);
      })
    );
  }
}

// Session Test Helper
export class SessionTestHelper {
  static createMockSession(overrides?: any) {
    return {
      id: 'test-session-id',
      userId: 'test-user-id',
      status: 'active',
      items: [],
      currentIndex: 0,
      mode: 'recognition',
      startedAt: new Date(),
      endedAt: null,
      source: 'test',
      tags: [],
      shuffle: false,
      ...overrides,
    };
  }

  static async mockActiveSession(userId: string, sessionData: any) {
    const { redis: mockRedis } = await import('@/lib/redis/client');
    
    mockRedis.get.mockImplementation((key: string) => {
      if (key === `review:session:active:${userId}`) {
        return Promise.resolve(JSON.stringify(sessionData));
      }
      return Promise.resolve(null);
    });
  }
}

// Middleware Test Helper
export class MiddlewareTestHelper {
  static async testAuthMiddleware(
    handler: (req: NextRequest) => Promise<Response>,
    unauthorizedRequest: NextRequest
  ) {
    const response = await handler(unauthorizedRequest);
    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  }

  static async testCorsHeaders(response: Response, expectedOrigin?: string) {
    const headers = response.headers;
    
    expect(headers.get('Access-Control-Allow-Origin')).toBeDefined();
    if (expectedOrigin) {
      expect(headers.get('Access-Control-Allow-Origin')).toBe(expectedOrigin);
    }
    
    expect(headers.get('Access-Control-Allow-Methods')).toBeDefined();
    expect(headers.get('Access-Control-Allow-Headers')).toBeDefined();
  }

  static async testRateLimitHeaders(response: Response) {
    const headers = response.headers;
    
    expect(headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(headers.get('X-RateLimit-Reset')).toBeDefined();
  }
}

// Performance Test Helper
export class PerformanceTestHelper {
  static async testConcurrentRequests(
    makeRequest: () => Promise<any>,
    concurrency: number = 10
  ) {
    const promises = Array.from({ length: concurrency }, () => makeRequest());
    const start = performance.now();
    const results = await Promise.all(promises);
    const duration = performance.now() - start;
    
    return {
      results,
      duration,
      avgDuration: duration / concurrency,
    };
  }

  static async testLoadScenario(
    makeRequest: () => Promise<any>,
    options: {
      totalRequests: number;
      requestsPerSecond: number;
      duration: number;
    }
  ) {
    const { totalRequests, requestsPerSecond, duration } = options;
    const interval = 1000 / requestsPerSecond;
    const results: any[] = [];
    let errors = 0;
    
    for (let i = 0; i < totalRequests; i++) {
      setTimeout(async () => {
        try {
          const response = await makeRequest();
          results.push(response);
        } catch (error) {
          errors++;
        }
      }, i * interval);
    }
    
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    
    return {
      totalRequests,
      successfulRequests: results.length,
      errors,
      successRate: (results.length / totalRequests) * 100,
    };
  }
}

// Setup and teardown for API tests
export const setupApiTest = () => {
  jest.clearAllMocks();
  mockServer.listen({ onUnhandledRequest: 'bypass' });
};

export const teardownApiTest = () => {
  jest.clearAllMocks();
  mockServer.close();
};

export const resetApiMocks = () => {
  jest.clearAllMocks();
  mockServer.resetHandlers();
};