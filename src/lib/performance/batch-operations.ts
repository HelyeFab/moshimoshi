/**
 * Batch Operations Utility
 * Week 2 - Performance Optimization
 * Provides utilities for batching database and cache operations
 */

import { redis } from '@/lib/redis/client'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * Batch Redis operations to avoid N+1 queries
 */
export class RedisBatchOperations {
  /**
   * Batch get multiple keys
   */
  static async batchGet(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return []
    
    // Use MGET for batch retrieval
    return await redis.mget(...keys)
  }
  
  /**
   * Batch set multiple key-value pairs with TTL
   */
  static async batchSetWithTTL(
    items: Array<{ key: string; value: any; ttl: number }>
  ): Promise<void> {
    if (items.length === 0) return
    
    // Use pipeline for atomic batch operations
    const pipeline = redis.pipeline()
    
    for (const item of items) {
      pipeline.setex(item.key, item.ttl, JSON.stringify(item.value))
    }
    
    await pipeline.exec()
  }
  
  /**
   * Batch delete multiple keys
   */
  static async batchDelete(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0
    
    return await redis.del(...keys)
  }
  
  /**
   * Batch check existence of keys
   */
  static async batchExists(keys: string[]): Promise<boolean[]> {
    if (keys.length === 0) return []
    
    const pipeline = redis.pipeline()
    keys.forEach(key => pipeline.exists(key))
    
    const results = await pipeline.exec()
    return results ? results.map(([err, result]: [any, any]) => result === 1) : []
  }
}

/**
 * Batch Firestore operations to avoid N+1 queries
 */
export class FirestoreBatchOperations {
  /**
   * Batch get documents by IDs
   */
  static async batchGetDocuments<T = any>(
    collection: string,
    ids: string[]
  ): Promise<Map<string, T>> {
    if (ids.length === 0) return new Map()
    
    const collectionRef = adminFirestore!.collection(collection)
    const results = new Map<string, T>()
    
    // Firestore limits batch gets to 10 documents
    const chunks = this.chunkArray(ids, 10)
    
    for (const chunk of chunks) {
      const refs = chunk.map(id => collectionRef.doc(id))
      const docs = await adminFirestore!.getAll(...refs)
      
      docs.forEach((doc, index) => {
        if (doc.exists) {
          results.set(chunk[index], doc.data() as T)
        }
      })
    }
    
    return results
  }
  
  /**
   * Batch write documents
   */
  static async batchWriteDocuments(
    operations: Array<{
      collection: string
      id: string
      data?: any
      delete?: boolean
      merge?: boolean
    }>
  ): Promise<void> {
    if (operations.length === 0) return
    
    // Firestore limits batch writes to 500 operations
    const chunks = this.chunkArray(operations, 500)
    
    for (const chunk of chunks) {
      const batch = adminFirestore!.batch()
      
      for (const op of chunk) {
        const ref = adminFirestore!.collection(op.collection).doc(op.id)
        
        if (op.delete) {
          batch.delete(ref)
        } else if (op.data) {
          if (op.merge) {
            batch.set(ref, op.data, { merge: true })
          } else {
            batch.set(ref, op.data)
          }
        }
      }
      
      await batch.commit()
    }
  }
  
  /**
   * Batch query with pagination
   */
  static async batchQuery<T = any>(
    collection: string,
    field: string,
    values: any[],
    limit: number = 1000
  ): Promise<T[]> {
    if (values.length === 0) return []
    
    const results: T[] = []
    const collectionRef = adminFirestore!.collection(collection)
    
    // Firestore 'in' queries limited to 10 values
    const chunks = this.chunkArray(values, 10)
    
    for (const chunk of chunks) {
      const query = collectionRef
        .where(field, 'in', chunk)
        .limit(limit)
      
      const snapshot = await query.get()
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() } as T)
      })
    }
    
    return results
  }
  
  /**
   * Helper to chunk arrays
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

/**
 * Parallel processing utilities
 */
export class ParallelProcessing {
  /**
   * Process items in parallel with concurrency limit
   */
  static async processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrencyLimit: number = 5
  ): Promise<R[]> {
    const results: R[] = []
    const queue = [...items]
    const inProgress: Promise<void>[] = []
    
    while (queue.length > 0 || inProgress.length > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.length < concurrencyLimit && queue.length > 0) {
        const item = queue.shift()!
        const task = processor(item)
          .then(result => {
            results.push(result)
          })
          .catch(error => {
            console.error('Parallel processing error:', error)
            results.push(null as any)
          })
        
        inProgress.push(task)
      }
      
      // Wait for at least one task to complete
      if (inProgress.length > 0) {
        await Promise.race(inProgress)
        // Remove completed tasks
        for (let i = inProgress.length - 1; i >= 0; i--) {
          if (await isPromiseSettled(inProgress[i])) {
            inProgress.splice(i, 1)
          }
        }
      }
    }
    
    return results
  }
  
  /**
   * Batch process with rate limiting
   */
  static async batchProcessWithRateLimit<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 10,
    delayMs: number = 100
  ): Promise<R[]> {
    const results: R[] = []
    const batches = this.createBatches(items, batchSize)
    
    for (const batch of batches) {
      const batchResults = await processor(batch)
      results.push(...batchResults)
      
      // Rate limiting delay
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    
    return results
  }
  
  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }
}

/**
 * Memory-efficient data processing
 */
export class MemoryEfficientProcessing {
  /**
   * Process large datasets in chunks to avoid memory issues
   */
  static async *processInChunks<T>(
    dataSource: () => AsyncIterator<T>,
    chunkSize: number = 100
  ): AsyncGenerator<T[], void, unknown> {
    const iterator = dataSource()
    let chunk: T[] = []
    
    while (true) {
      const { value, done } = await iterator.next()
      
      if (done) {
        if (chunk.length > 0) {
          yield chunk
        }
        break
      }
      
      chunk.push(value)
      
      if (chunk.length >= chunkSize) {
        yield chunk
        chunk = []
      }
    }
  }
  
  /**
   * Stream process with backpressure
   */
  static async streamProcess<T, R>(
    source: AsyncIterable<T>,
    processor: (item: T) => Promise<R>,
    maxBufferSize: number = 100
  ): Promise<void> {
    const buffer: Promise<R>[] = []
    
    for await (const item of source) {
      // Add to buffer
      buffer.push(processor(item))
      
      // Apply backpressure when buffer is full
      if (buffer.length >= maxBufferSize) {
        await Promise.all(buffer)
        buffer.length = 0
      }
    }
    
    // Process remaining items
    if (buffer.length > 0) {
      await Promise.all(buffer)
    }
  }
}

/**
 * Helper to check if a promise is settled
 */
async function isPromiseSettled(promise: Promise<any>): Promise<boolean> {
  return Promise.race([
    promise.then(() => true).catch(() => true),
    Promise.resolve(false)
  ])
}

/**
 * Performance monitoring decorator
 */
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value
  
  descriptor.value = async function(...args: any[]) {
    const start = performance.now()
    
    try {
      const result = await originalMethod.apply(this, args)
      const duration = performance.now() - start
      
      // Log if slow
      if (duration > 100) {
        console.warn(`Slow operation: ${propertyKey} took ${duration.toFixed(2)}ms`)
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      console.error(`Operation failed: ${propertyKey} after ${duration.toFixed(2)}ms`, error)
      throw error
    }
  }
  
  return descriptor
}