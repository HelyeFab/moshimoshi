# Module 8: API Integration

**Status**: 🔴 Not Started  
**Priority**: MEDIUM  
**Owner**: Agent 8  
**Dependencies**: Core Interfaces (Module 1), Session Management (Module 3), Offline Sync (Module 4)  
**Estimated Time**: 4-5 hours  

## Overview
Implement API client and server endpoints for the review system, handling session management, progress synchronization, batch operations, and error handling with proper authentication and rate limiting.

## Deliverables

### 1. API Client

```typescript
// lib/api/review/client.ts

import { 
  ReviewSession, 
  SessionStatistics, 
  ReviewableContent,
  ProgressUpdate 
} from '@/lib/review-engine/core/interfaces';

export class ReviewAPIClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private authToken?: string;
  
  constructor(config: APIConfig) {
    this.baseUrl = config.baseUrl || '/api/review/v2';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }
  
  setAuthToken(token: string) {
    this.authToken = token;
  }
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
      ...options.headers
    };
    
    try {
      const response = await this.fetchWithRetry(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
  
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }
      
      // Exponential backoff
      await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
      
      return this.fetchWithRetry(url, options, attempt + 1);
    }
  }
  
  private async handleErrorResponse(response: Response): Promise<Error> {
    try {
      const error = await response.json();
      return new APIError(
        error.message || 'API request failed',
        response.status,
        error.code,
        error.details
      );
    } catch {
      return new APIError(
        `API request failed with status ${response.status}`,
        response.status
      );
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Session endpoints
  
  async createSession(data: CreateSessionRequest): Promise<ReviewSession> {
    return this.request<ReviewSession>('/session', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async getSession(sessionId: string): Promise<ReviewSession> {
    return this.request<ReviewSession>(`/session/${sessionId}`);
  }
  
  async updateSession(sessionId: string, data: Partial<ReviewSession>): Promise<ReviewSession> {
    return this.request<ReviewSession>(`/session/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  
  async completeSession(sessionId: string): Promise<SessionStatistics> {
    return this.request<SessionStatistics>(`/session/${sessionId}/complete`, {
      method: 'POST'
    });
  }
  
  // Answer submission
  
  async submitAnswer(data: SubmitAnswerRequest): Promise<AnswerResponse> {
    return this.request<AnswerResponse>('/answer', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async submitBatchAnswers(data: BatchAnswerRequest): Promise<BatchAnswerResponse> {
    return this.request<BatchAnswerResponse>('/answer/batch', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  // Progress synchronization
  
  async syncProgress(data: ProgressUpdate): Promise<void> {
    await this.request('/progress/sync', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async getProgress(userId: string): Promise<UserProgress> {
    return this.request<UserProgress>(`/progress/${userId}`);
  }
  
  // Statistics
  
  async saveStatistics(data: SessionStatistics): Promise<void> {
    await this.request('/statistics', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async getStatistics(userId: string, options?: StatsOptions): Promise<UserStatistics> {
    const params = new URLSearchParams(options as any);
    return this.request<UserStatistics>(`/statistics/${userId}?${params}`);
  }
  
  // Content management
  
  async getReviewContent(options: ContentOptions): Promise<ReviewableContent[]> {
    const params = new URLSearchParams(options as any);
    return this.request<ReviewableContent[]>(`/content?${params}`);
  }
  
  async pinContent(contentIds: string[]): Promise<void> {
    await this.request('/content/pin', {
      method: 'POST',
      body: JSON.stringify({ contentIds })
    });
  }
  
  async unpinContent(contentIds: string[]): Promise<void> {
    await this.request('/content/unpin', {
      method: 'POST',
      body: JSON.stringify({ contentIds })
    });
  }
  
  // Sync queue
  
  async processSyncQueue(items: SyncQueueItem[]): Promise<SyncResult[]> {
    return this.request<SyncResult[]>('/sync/batch', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  }
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}
```

### 2. Server Endpoints

```typescript
// app/api/review/v2/session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { ReviewSessionService } from '@/lib/services/review-session.service';
import { z } from 'zod';

const CreateSessionSchema = z.object({
  items: z.array(z.any()),
  mode: z.enum(['recognition', 'recall', 'listening']),
  config: z.object({
    shuffleOrder: z.boolean().optional(),
    allowRetry: z.boolean().optional(),
    showHints: z.boolean().optional(),
    autoAdvance: z.boolean().optional(),
    timeLimit: z.number().optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const session = await validateSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validated = CreateSessionSchema.parse(body);
    
    // Create review session
    const service = new ReviewSessionService();
    const reviewSession = await service.createSession({
      userId: session.userId,
      ...validated
    });
    
    // Log session creation
    await logActivity({
      userId: session.userId,
      action: 'session.created',
      metadata: { sessionId: reviewSession.id }
    });
    
    return NextResponse.json(reviewSession);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const service = new ReviewSessionService();
    const sessions = await service.getUserSessions(session.userId);
    
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/review/v2/answer/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { AnswerService } from '@/lib/services/answer.service';
import { ValidatorRegistry } from '@/lib/review-engine/validation/registry';
import { rateLimit } from '@/lib/middleware/rate-limit';

const SubmitAnswerSchema = z.object({
  sessionId: z.string(),
  itemId: z.string(),
  answer: z.string(),
  confidence: z.number().min(1).max(5).optional(),
  responseTime: z.number()
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      max: 500,
      window: '1h'
    });
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    // Validate authentication
    const session = await validateSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse and validate request
    const body = await request.json();
    const validated = SubmitAnswerSchema.parse(body);
    
    // Verify session ownership
    const service = new AnswerService();
    const reviewSession = await service.getSession(validated.sessionId);
    
    if (reviewSession.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Process answer
    const result = await service.processAnswer({
      ...validated,
      userId: session.userId
    });
    
    // Update statistics in background
    queueMicrotask(async () => {
      await updateUserStatistics(session.userId, result);
    });
    
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Answer submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/review/v2/sync/batch/route.ts

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { items } = body;
    
    const results: SyncResult[] = [];
    const service = new SyncService();
    
    // Process each sync item
    for (const item of items) {
      try {
        await service.processItem(item, session.userId);
        results.push({
          id: item.id,
          status: 'success'
        });
      } catch (error) {
        results.push({
          id: item.id,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 3. WebSocket Support (Optional)

```typescript
// lib/api/review/websocket.ts

import { Server } from 'socket.io';
import { ReviewEventType } from '@/lib/review-engine/core/interfaces';

export class ReviewWebSocketServer {
  private io: Server;
  private userSockets: Map<string, string[]> = new Map();
  
  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL,
        credentials: true
      }
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.io.on('connection', async (socket) => {
      const userId = await this.authenticateSocket(socket);
      
      if (!userId) {
        socket.disconnect();
        return;
      }
      
      // Track user sockets
      const sockets = this.userSockets.get(userId) || [];
      sockets.push(socket.id);
      this.userSockets.set(userId, sockets);
      
      // Join user room
      socket.join(`user:${userId}`);
      
      // Handle events
      socket.on('session:start', (data) => this.handleSessionStart(socket, userId, data));
      socket.on('answer:submit', (data) => this.handleAnswerSubmit(socket, userId, data));
      socket.on('progress:request', () => this.handleProgressRequest(socket, userId));
      
      // Handle disconnect
      socket.on('disconnect', () => {
        const sockets = this.userSockets.get(userId) || [];
        const index = sockets.indexOf(socket.id);
        if (index > -1) {
          sockets.splice(index, 1);
          this.userSockets.set(userId, sockets);
        }
      });
    });
  }
  
  // Emit events to specific user
  emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
  
  // Broadcast progress updates
  broadcastProgress(userId: string, progress: ProgressUpdate) {
    this.emitToUser(userId, 'progress:update', progress);
  }
  
  // Broadcast achievement
  broadcastAchievement(userId: string, achievement: Achievement) {
    this.emitToUser(userId, 'achievement:unlocked', achievement);
  }
  
  private async authenticateSocket(socket: any): Promise<string | null> {
    const token = socket.handshake.auth.token;
    if (!token) return null;
    
    try {
      const session = await validateToken(token);
      return session?.userId || null;
    } catch {
      return null;
    }
  }
}
```

### 4. Error Handling Middleware

```typescript
// lib/middleware/error-handler.ts

export class APIErrorHandler {
  static handle(error: any): NextResponse {
    // Validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      );
    }
    
    // Authentication errors
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }
    
    // Permission errors
    if (error.code === 'FORBIDDEN') {
      return NextResponse.json(
        {
          error: 'Permission denied',
          code: 'FORBIDDEN'
        },
        { status: 403 }
      );
    }
    
    // Rate limiting
    if (error.code === 'RATE_LIMIT') {
      return NextResponse.json(
        {
          error: 'Too many requests',
          code: 'RATE_LIMIT',
          retryAfter: error.retryAfter
        },
        { status: 429 }
      );
    }
    
    // Database errors
    if (error.code?.startsWith('P')) { // Prisma errors
      return NextResponse.json(
        {
          error: 'Database operation failed',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }
    
    // Default error
    console.error('Unhandled API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
```

### 5. Rate Limiting

```typescript
// lib/middleware/rate-limit.ts

import { Redis } from '@upstash/redis';

interface RateLimitOptions {
  max: number;
  window: string; // e.g., '1h', '15m', '1d'
  identifier?: string;
}

export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  });
  
  // Get identifier (IP or user ID)
  const identifier = options.identifier || 
    request.headers.get('x-forwarded-for') || 
    'anonymous';
  
  // Parse window
  const windowSeconds = parseWindow(options.window);
  
  // Create rate limit key
  const key = `ratelimit:${identifier}:${request.nextUrl.pathname}`;
  
  // Increment counter
  const count = await redis.incr(key);
  
  // Set expiry on first request
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  
  // Get TTL
  const ttl = await redis.ttl(key);
  
  return {
    success: count <= options.max,
    remaining: Math.max(0, options.max - count),
    reset: Date.now() + (ttl * 1000)
  };
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid window format');
  
  const [, value, unit] = match;
  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };
  
  return parseInt(value) * multipliers[unit];
}
```

## Testing Requirements

```typescript
describe('API Integration', () => {
  describe('API Client', () => {
    it('should handle authentication');
    it('should retry failed requests');
    it('should handle timeouts');
    it('should process errors correctly');
  });
  
  describe('Server Endpoints', () => {
    it('should validate requests');
    it('should enforce rate limits');
    it('should handle concurrent requests');
    it('should sync data correctly');
  });
  
  describe('WebSocket', () => {
    it('should authenticate connections');
    it('should broadcast events');
    it('should handle reconnections');
  });
});
```

## Acceptance Criteria

- [ ] All endpoints authenticated
- [ ] Rate limiting implemented
- [ ] Error handling comprehensive
- [ ] Retry logic working
- [ ] WebSocket real-time updates
- [ ] Batch operations efficient
- [ ] API documentation complete
- [ ] 85% test coverage

## API Documentation

See [API.md](./API.md) for complete endpoint documentation with request/response examples.