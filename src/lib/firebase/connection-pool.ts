import { Firestore, Settings } from 'firebase-admin/firestore';
import { adminFirestore } from './admin';
import { ComponentLogger } from '../monitoring/logger';
import { reviewMetrics } from '../monitoring/metrics-dashboard';

// Connection pool configuration
interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

// Connection statistics
interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  averageResponseTime: number;
  lastError?: string;
  lastErrorTime?: Date;
}

// Database connection pool manager
export class FirestoreConnectionPool {
  private static instance: FirestoreConnectionPool;
  private db: Firestore | null = null;
  private config: PoolConfig;
  private stats: ConnectionStats;
  private logger: ComponentLogger;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private responseTimeBuffer: number[] = [];

  private constructor() {
    this.logger = new ComponentLogger('firestore-pool');
    
    // Configure connection pool based on environment
    this.config = {
      maxConnections: parseInt(process.env.FIRESTORE_MAX_CONNECTIONS || '10'),
      minConnections: parseInt(process.env.FIRESTORE_MIN_CONNECTIONS || '2'),
      connectionTimeout: parseInt(process.env.FIRESTORE_CONNECTION_TIMEOUT || '10000'),
      idleTimeout: parseInt(process.env.FIRESTORE_IDLE_TIMEOUT || '60000'),
      maxRetries: parseInt(process.env.FIRESTORE_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.FIRESTORE_RETRY_DELAY || '1000')
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      failedConnections: 0,
      averageResponseTime: 0
    };

    this.initializePool();
    this.startHealthCheck();
  }

  static getInstance(): FirestoreConnectionPool {
    if (!FirestoreConnectionPool.instance) {
      FirestoreConnectionPool.instance = new FirestoreConnectionPool();
    }
    return FirestoreConnectionPool.instance;
  }

  private initializePool() {
    if (!adminFirestore) {
      this.logger.error('Firebase Admin not initialized');
      throw new Error('Firebase Admin SDK not properly configured');
    }

    this.db = adminFirestore;

    // Configure Firestore settings for optimal performance
    const settings: Settings = {
      // Use persistent connections
      ignoreUndefinedProperties: true,
      
      // Configure for production
      ...(process.env.NODE_ENV === 'production' && {
        host: process.env.FIRESTORE_HOST,
        ssl: true
      })
    };

    this.db.settings(settings);

    this.logger.info('Firestore connection pool initialized', {
      config: this.config
    });
  }

  private startHealthCheck() {
    // Periodic health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);
  }

  private async performHealthCheck() {
    try {
      const startTime = Date.now();
      
      // Simple read operation to check connectivity
      await this.db!.collection('_health').doc('check').get();
      
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      
      this.logger.debug('Health check successful', {
        responseTime,
        stats: this.stats
      });
    } catch (error) {
      this.stats.failedConnections++;
      this.stats.lastError = error instanceof Error ? error.message : String(error);
      this.stats.lastErrorTime = new Date();
      
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
        stats: this.stats
      });
    }
  }

  private updateResponseTime(time: number) {
    this.responseTimeBuffer.push(time);
    
    // Keep only last 100 measurements
    if (this.responseTimeBuffer.length > 100) {
      this.responseTimeBuffer.shift();
    }
    
    // Calculate average
    const sum = this.responseTimeBuffer.reduce((a, b) => a + b, 0);
    this.stats.averageResponseTime = Math.round(sum / this.responseTimeBuffer.length);
  }

  // Execute query with retry logic
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        this.stats.activeConnections++;
        
        const result = await this.withTimeout(
          operation(),
          this.config.connectionTimeout
        );
        
        const duration = Date.now() - startTime;
        this.updateResponseTime(duration);
        
        // Track metrics
        reviewMetrics.trackDatabasePerformance(operationName, 'firestore', {
          duration,
          error: false
        });
        
        this.logger.debug(`Operation ${operationName} successful`, {
          attempt,
          duration
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.stats.failedConnections++;
        
        this.logger.warn(`Operation ${operationName} failed (attempt ${attempt})`, {
          error: error instanceof Error ? error.message : String(error),
          attempt,
          maxRetries: this.config.maxRetries
        });
        
        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      } finally {
        this.stats.activeConnections--;
      }
    }
    
    // All retries failed
    reviewMetrics.trackDatabasePerformance(operationName, 'firestore', {
      duration: 0,
      error: true
    });
    
    throw lastError;
  }

  // Add timeout to operations
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  // Sleep helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get Firestore instance
  getDb(): Firestore {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    return this.db;
  }

  // Get connection statistics
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  // Batch operations with optimized batching
  async batchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete';
    ref: any;
    data?: any;
  }>) {
    const BATCH_SIZE = 500; // Firestore limit
    const batches = [];
    
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const batch = this.db!.batch();
      const batchOps = operations.slice(i, i + BATCH_SIZE);
      
      for (const op of batchOps) {
        switch (op.type) {
          case 'set':
            batch.set(op.ref, op.data);
            break;
          case 'update':
            batch.update(op.ref, op.data);
            break;
          case 'delete':
            batch.delete(op.ref);
            break;
        }
      }
      
      batches.push(batch);
    }
    
    // Execute all batches
    const results = await Promise.all(
      batches.map((batch, index) => 
        this.executeWithRetry(
          () => batch.commit(),
          `batch_write_${index}`
        )
      )
    );
    
    this.logger.info('Batch write completed', {
      totalOperations: operations.length,
      batches: batches.length
    });
    
    return results;
  }

  // Transaction with retry
  async runTransaction<T>(
    updateFunction: (transaction: any) => Promise<T>
  ): Promise<T> {
    return this.executeWithRetry(
      () => this.db!.runTransaction(updateFunction),
      'transaction'
    );
  }

  // Cleanup
  async close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.logger.info('Connection pool closed', {
      finalStats: this.stats
    });
  }
}

// Helper functions for common operations
export class DatabaseOperations {
  private pool: FirestoreConnectionPool;
  private logger: ComponentLogger;

  constructor() {
    this.pool = FirestoreConnectionPool.getInstance();
    this.logger = new ComponentLogger('db-operations');
  }

  // Paginated query with cursor
  async paginatedQuery(
    collection: string,
    pageSize: number,
    lastDocId?: string,
    filters?: Array<{ field: string; operator: any; value: any }>
  ) {
    return this.pool.executeWithRetry(async () => {
      const db = this.pool.getDb();
      let query = db.collection(collection).limit(pageSize);
      
      // Apply filters
      if (filters) {
        for (const filter of filters) {
          query = query.where(filter.field, filter.operator, filter.value);
        }
      }
      
      // Apply cursor if provided
      if (lastDocId) {
        const lastDoc = await db.collection(collection).doc(lastDocId).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }
      
      const snapshot = await query.get();
      
      return {
        docs: snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })),
        hasMore: snapshot.docs.length === pageSize,
        lastDocId: snapshot.docs[snapshot.docs.length - 1]?.id
      };
    }, `paginated_query_${collection}`);
  }

  // Bulk read with caching hints
  async bulkRead(collection: string, ids: string[]) {
    const CHUNK_SIZE = 10; // Firestore 'in' query limit
    const chunks = [];
    
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }
    
    const results = await Promise.all(
      chunks.map(chunk => 
        this.pool.executeWithRetry(async () => {
          const db = this.pool.getDb();
          const snapshot = await db
            .collection(collection)
            .where('__name__', 'in', chunk)
            .get();
          
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }, `bulk_read_${collection}`)
      )
    );
    
    return results.flat();
  }

  // Optimized count query
  async getCount(
    collection: string,
    filters?: Array<{ field: string; operator: any; value: any }>
  ): Promise<number> {
    return this.pool.executeWithRetry(async () => {
      const db = this.pool.getDb();
      let query: any = db.collection(collection);
      
      if (filters) {
        for (const filter of filters) {
          query = query.where(filter.field, filter.operator, filter.value);
        }
      }
      
      const snapshot = await query.count().get();
      return snapshot.data().count;
    }, `count_${collection}`);
  }
}

// Export singleton instances
export const dbPool = FirestoreConnectionPool.getInstance();
export const dbOps = new DatabaseOperations();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await dbPool.close();
});

process.on('SIGINT', async () => {
  await dbPool.close();
});