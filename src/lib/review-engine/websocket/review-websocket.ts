/**
 * WebSocket support for real-time review features
 * Handles live collaboration, progress updates, and notifications
 */

import { EventEmitter } from 'events';
import { reviewLogger } from '@/lib/monitoring/logger';

export interface WebSocketConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  authToken?: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  id?: string;
}

export type MessageHandler = (message: WebSocketMessage) => void;

export class ReviewWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  
  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnectDelay: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config
    };
  }
  
  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }
    
    this.isConnecting = true;
    
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Add auth token to URL if provided
        const url = this.config.authToken
          ? `${this.config.url}?token=${this.config.authToken}`
          : this.config.url;
        
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          reviewLogger.info('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          this.emit('connected');
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Send queued messages
          this.flushMessageQueue();
          
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            this.handleMessage(message);
          } catch (error) {
            reviewLogger.error('Failed to parse WebSocket message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          reviewLogger.error('WebSocket error:', error);
          this.emit('error', error);
          
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        };
        
        this.ws.onclose = (event) => {
          reviewLogger.info('WebSocket disconnected', { code: event.code, reason: event.reason });
          this.ws = null;
          this.isConnecting = false;
          
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Attempt reconnection if not a normal closure
          if (event.code !== 1000 && event.code !== 1001) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
    
    return this.connectionPromise;
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.cancelReconnect();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.messageQueue = [];
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }
  
  /**
   * Send message through WebSocket
   */
  send(type: string, payload: any): void {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
      id: this.generateMessageId()
    };
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.emit('message.sent', message);
      } catch (error) {
        reviewLogger.error('Failed to send message:', error);
        this.queueMessage(message);
      }
    } else {
      this.queueMessage(message);
      
      // Attempt to reconnect if not connected
      if (!this.isConnecting) {
        this.connect();
      }
    }
  }
  
  /**
   * Subscribe to specific message type
   */
  onMessage(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    
    this.handlers.get(type)!.add(handler);
  }
  
  /**
   * Unsubscribe from message type
   */
  offMessage(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    }
  }
  
  /**
   * Join a room for collaborative features
   */
  joinRoom(roomId: string): void {
    this.send('room.join', { roomId });
  }
  
  /**
   * Leave a room
   */
  leaveRoom(roomId: string): void {
    this.send('room.leave', { roomId });
  }
  
  /**
   * Request real-time progress updates
   */
  subscribeToProgress(userId: string): void {
    this.send('progress.subscribe', { userId });
  }
  
  /**
   * Stop receiving progress updates
   */
  unsubscribeFromProgress(userId: string): void {
    this.send('progress.unsubscribe', { userId });
  }
  
  /**
   * Send progress update
   */
  sendProgressUpdate(progress: any): void {
    this.send('progress.update', progress);
  }
  
  /**
   * Request leaderboard updates
   */
  subscribeToLeaderboard(options?: any): void {
    this.send('leaderboard.subscribe', options || {});
  }
  
  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    this.emit('message.received', message);
    
    // Handle system messages
    switch (message.type) {
      case 'ping':
        this.handlePing(message);
        break;
        
      case 'auth.required':
        this.handleAuthRequired(message);
        break;
        
      case 'auth.success':
        this.handleAuthSuccess(message);
        break;
        
      case 'error':
        this.handleError(message);
        break;
        
      default:
        // Dispatch to registered handlers
        const handlers = this.handlers.get(message.type);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              reviewLogger.error(`Handler error for ${message.type}:`, error);
            }
          });
        }
        
        // Emit typed event
        this.emit(message.type, message.payload);
    }
  }
  
  /**
   * Handle ping message
   */
  private handlePing(message: WebSocketMessage): void {
    this.send('pong', { timestamp: message.timestamp });
  }
  
  /**
   * Handle auth required message
   */
  private handleAuthRequired(message: WebSocketMessage): void {
    if (this.config.authToken) {
      this.send('auth.token', { token: this.config.authToken });
    } else {
      this.emit('auth.required', message.payload);
    }
  }
  
  /**
   * Handle auth success message
   */
  private handleAuthSuccess(message: WebSocketMessage): void {
    this.emit('auth.success', message.payload);
  }
  
  /**
   * Handle error message
   */
  private handleError(message: WebSocketMessage): void {
    reviewLogger.error('WebSocket error message:', message.payload);
    this.emit('error', message.payload);
  }
  
  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }
  
  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      reviewLogger.error('Max reconnection attempts reached');
      this.emit('reconnect.failed');
      return;
    }
    
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );
    
    reviewLogger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
    
    this.emit('reconnect.scheduled', {
      attempt: this.reconnectAttempts,
      delay
    });
  }
  
  /**
   * Cancel scheduled reconnection
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Queue message for sending when connected
   */
  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }
  
  /**
   * Send all queued messages
   */
  private flushMessageQueue(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      try {
        this.ws.send(JSON.stringify(message));
        this.emit('message.sent', message);
      } catch (error) {
        reviewLogger.error('Failed to send queued message:', error);
        // Re-queue the message
        this.messageQueue.unshift(message);
        break;
      }
    }
  }
  
  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get connection state
   */
  getState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.handlers.clear();
    this.messageQueue = [];
  }
}