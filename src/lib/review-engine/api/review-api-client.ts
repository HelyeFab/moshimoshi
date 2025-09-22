/**
 * Review API Client
 * Handles all API communication for the review engine
 */

import { ReviewableContent } from '../core/interfaces';
import { ReviewSession, SessionStatistics } from '../core/session.types';
import { ProgressData } from '../progress/progress-tracker';

export interface APIConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export class ReviewAPIClient {
  private config: APIConfig;
  private authToken: string | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private rateLimiter: RateLimiter;
  
  constructor(config: APIConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
  }
  
  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }
  
  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.authToken = null;
  }
  
  // ========== Session Management ==========
  
  /**
   * Create a new review session
   */
  async createSession(
    userId: string,
    content: ReviewableContent[],
    mode: string,
    config?: any
  ): Promise<APIResponse<ReviewSession>> {
    return this.post('/api/review/sessions', {
      userId,
      content,
      mode,
      config
    });
  }
  
  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<APIResponse<ReviewSession>> {
    return this.get(`/api/review/sessions/${sessionId}`);
  }
  
  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    updates: Partial<ReviewSession>
  ): Promise<APIResponse<ReviewSession>> {
    return this.patch(`/api/review/sessions/${sessionId}`, updates);
  }
  
  /**
   * Complete session
   */
  async completeSession(
    sessionId: string,
    statistics: SessionStatistics
  ): Promise<APIResponse<SessionStatistics>> {
    return this.post(`/api/review/sessions/${sessionId}/complete`, {
      statistics
    });
  }
  
  /**
   * Get user sessions
   */
  async getUserSessions(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<APIResponse<PaginatedResponse<ReviewSession>>> {
    const params = new URLSearchParams();
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    
    return this.get(`/api/review/users/${userId}/sessions?${params}`);
  }
  
  // ========== Content Management ==========
  
  /**
   * Get reviewable content
   */
  async getContent(
    contentType: string,
    options?: {
      page?: number;
      limit?: number;
      difficulty?: string;
      tags?: string[];
    }
  ): Promise<APIResponse<PaginatedResponse<ReviewableContent>>> {
    const params = new URLSearchParams();
    params.append('type', contentType);
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    
    return this.get(`/api/review/content?${params}`);
  }
  
  /**
   * Get content by IDs
   */
  async getContentByIds(ids: string[]): Promise<APIResponse<ReviewableContent[]>> {
    return this.post('/api/review/content/batch', { ids });
  }
  
  /**
   * Search content
   */
  async searchContent(
    query: string,
    options?: {
      contentTypes?: string[];
      limit?: number;
    }
  ): Promise<APIResponse<ReviewableContent[]>> {
    return this.post('/api/review/content/search', {
      query,
      ...options
    });
  }
  
  // ========== Progress Management ==========
  
  /**
   * Submit answer
   */
  async submitAnswer(data: {
    sessionId: string;
    contentId: string;
    answer: string;
    correct: boolean;
    responseTime: number;
    confidence?: number;
  }): Promise<APIResponse<void>> {
    return this.post('/api/review/answers', data);
  }
  
  /**
   * Update progress
   */
  async updateProgress(
    userId: string,
    progressData: ProgressData[]
  ): Promise<APIResponse<void>> {
    return this.post(`/api/review/users/${userId}/progress`, {
      progress: progressData
    });
  }
  
  /**
   * Get user progress
   */
  async getUserProgress(
    userId: string,
    contentType?: string
  ): Promise<APIResponse<ProgressData[]>> {
    const url = contentType
      ? `/api/review/users/${userId}/progress?type=${contentType}`
      : `/api/review/users/${userId}/progress`;
    
    return this.get(url);
  }
  
  /**
   * Save session statistics
   */
  async saveStatistics(
    sessionId: string,
    statistics: SessionStatistics
  ): Promise<APIResponse<void>> {
    return this.post(`/api/review/sessions/${sessionId}/statistics`, statistics);
  }
  
  /**
   * Get user statistics
   */
  async getUserStatistics(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      groupBy?: 'day' | 'week' | 'month';
    }
  ): Promise<APIResponse<any>> {
    const params = new URLSearchParams();
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value instanceof Date ? value.toISOString() : String(value));
        }
      });
    }
    
    return this.get(`/api/review/users/${userId}/statistics?${params}`);
  }
  
  // ========== Sync Operations ==========
  
  /**
   * Sync offline data
   */
  async syncOfflineData(data: {
    sessions: ReviewSession[];
    answers: any[];
    progress: ProgressData[];
    timestamp: number;
  }): Promise<APIResponse<{
    synced: number;
    conflicts: any[];
  }>> {
    return this.post('/api/review/sync', data);
  }
  
  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<APIResponse<{
    lastSync: number;
    pendingItems: number;
    conflicts: number;
  }>> {
    return this.get(`/api/review/users/${userId}/sync-status`);
  }
  
  // ========== Achievements ==========
  
  /**
   * Get user achievements
   */
  async getUserAchievements(userId: string): Promise<APIResponse<any>> {
    return this.get(`/api/review/users/${userId}/achievements`);
  }
  
  /**
   * Unlock achievement
   */
  async unlockAchievement(
    userId: string,
    achievementId: string
  ): Promise<APIResponse<void>> {
    return this.post(`/api/review/users/${userId}/achievements/${achievementId}/unlock`);
  }
  
  // ========== Leaderboard ==========
  
  /**
   * Get leaderboard
   */
  async getLeaderboard(options?: {
    period?: 'daily' | 'weekly' | 'monthly' | 'all-time';
    contentType?: string;
    limit?: number;
  }): Promise<APIResponse<any[]>> {
    const params = new URLSearchParams();
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    
    return this.get(`/api/review/leaderboard?${params}`);
  }
  
  /**
   * Get user rank
   */
  async getUserRank(userId: string): Promise<APIResponse<{
    rank: number;
    total: number;
    percentile: number;
  }>> {
    return this.get(`/api/review/users/${userId}/rank`);
  }
  
  // ========== HTTP Methods ==========
  
  /**
   * Make GET request
   */
  private async get<T>(path: string): Promise<APIResponse<T>> {
    return this.request<T>('GET', path);
  }
  
  /**
   * Make POST request
   */
  private async post<T>(path: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, data);
  }
  
  /**
   * Make PATCH request
   */
  private async patch<T>(path: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', path, data);
  }
  
  /**
   * Make DELETE request
   */
  private async delete<T>(path: string): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path);
  }
  
  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    attempt: number = 1
  ): Promise<APIResponse<T>> {
    // Check rate limit
    await this.rateLimiter.checkLimit();
    
    // Deduplicate requests
    const requestKey = `${method}:${path}:${JSON.stringify(data || {})}`;
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey);
    }
    
    const requestPromise = this.performRequest<T>(method, path, data, attempt);
    this.requestQueue.set(requestKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.requestQueue.delete(requestKey);
    }
  }
  
  /**
   * Perform actual HTTP request
   */
  private async performRequest<T>(
    method: string,
    path: string,
    data?: any,
    attempt: number = 1
  ): Promise<APIResponse<T>> {
    const url = `${this.config.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        // Handle specific error status codes
        if (response.status === 401) {
          this.handleAuthError();
        } else if (response.status === 429) {
          return this.handleRateLimit(response, method, path, data, attempt);
        } else if (response.status >= 500) {
          return this.handleServerError(response, method, path, data, attempt);
        }
        
        const errorData = await response.json().catch(() => ({}));
        
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          message: errorData.message || response.statusText,
          timestamp: Date.now()
        };
      }
      
      const responseData = await response.json();
      
      return {
        success: true,
        data: responseData,
        timestamp: Date.now()
      };
      
    } catch (error: any) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'TIMEOUT',
          message: 'Request timed out',
          timestamp: Date.now()
        };
      }
      
      // Network error - retry if applicable
      if (attempt < this.config.retryAttempts!) {
        await this.delay(this.config.retryDelay! * attempt);
        return this.performRequest(method, path, data, attempt + 1);
      }
      
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: error.message || 'Network request failed',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Handle authentication error
   */
  private handleAuthError(): void {
    this.clearAuth();
    // Emit event for re-authentication
    window.dispatchEvent(new CustomEvent('auth-required'));
  }
  
  /**
   * Handle rate limiting
   */
  private async handleRateLimit<T>(
    response: Response,
    method: string,
    path: string,
    data: any,
    attempt: number
  ): Promise<APIResponse<T>> {
    const retryAfter = response.headers.get('Retry-After');
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.config.retryDelay! * 2;
    
    if (attempt < this.config.retryAttempts!) {
      await this.delay(delay);
      return this.performRequest(method, path, data, attempt + 1);
    }
    
    return {
      success: false,
      error: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      timestamp: Date.now()
    };
  }
  
  /**
   * Handle server error with retry
   */
  private async handleServerError<T>(
    response: Response,
    method: string,
    path: string,
    data: any,
    attempt: number
  ): Promise<APIResponse<T>> {
    if (attempt < this.config.retryAttempts!) {
      await this.delay(this.config.retryDelay! * Math.pow(2, attempt - 1));
      return this.performRequest(method, path, data, attempt + 1);
    }
    
    return {
      success: false,
      error: `SERVER_ERROR_${response.status}`,
      message: `Server error: ${response.statusText}`,
      timestamp: Date.now()
    };
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rate limiter for API requests
 */
class RateLimiter {
  private requests: number[] = [];
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  async checkLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart);
    
    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - now;
      
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }
    
    this.requests.push(now);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}