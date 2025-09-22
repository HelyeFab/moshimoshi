/**
 * Distributed Tracing Implementation
 * Provides request flow visibility across the entire system
 */

import { randomBytes } from 'crypto'
import { AsyncLocalStorage } from 'async_hooks'

// Trace context storage
const traceContext = new AsyncLocalStorage<TraceContext>()

export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  baggage?: Record<string, string>
  startTime: number
}

export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  operationName: string
  startTime: number
  endTime?: number
  duration?: number
  tags: Record<string, any>
  logs: LogEntry[]
  status: SpanStatus
  kind: SpanKind
}

export interface LogEntry {
  timestamp: number
  message: string
  level: 'info' | 'warn' | 'error'
  fields?: Record<string, any>
}

export enum SpanStatus {
  OK = 'ok',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

export enum SpanKind {
  SERVER = 'server',
  CLIENT = 'client',
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
  INTERNAL = 'internal',
}

/**
 * Distributed tracing service
 */
export class TracingService {
  private static instance: TracingService
  private spans: Map<string, Span> = new Map()
  private exporters: Array<(span: Span) => void> = []
  
  private constructor() {
    this.initializeExporters()
  }
  
  static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService()
    }
    return TracingService.instance
  }
  
  /**
   * Initialize trace exporters
   */
  private initializeExporters() {
    // Console exporter for development
    if (process.env.NODE_ENV === 'development') {
      this.addExporter((span) => {
        console.log('[TRACE]', JSON.stringify(span, null, 2))
      })
    }
    
    // Add production exporters (DataDog, Jaeger, etc.)
    // this.addExporter(new DataDogExporter())
  }
  
  /**
   * Start a new trace
   */
  startTrace(operationName: string, kind: SpanKind = SpanKind.SERVER): Span {
    const traceId = this.generateId()
    const spanId = this.generateId()
    
    const span: Span = {
      traceId,
      spanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: SpanStatus.OK,
      kind,
    }
    
    this.spans.set(spanId, span)
    
    // Set trace context
    const context: TraceContext = {
      traceId,
      spanId,
      startTime: span.startTime,
    }
    
    return span
  }
  
  /**
   * Start a child span
   */
  startSpan(
    operationName: string,
    kind: SpanKind = SpanKind.INTERNAL
  ): Span | null {
    const context = traceContext.getStore()
    if (!context) return null
    
    const spanId = this.generateId()
    
    const span: Span = {
      traceId: context.traceId,
      spanId,
      parentSpanId: context.spanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: SpanStatus.OK,
      kind,
    }
    
    this.spans.set(spanId, span)
    
    return span
  }
  
  /**
   * End a span
   */
  endSpan(spanId: string, status: SpanStatus = SpanStatus.OK): void {
    const span = this.spans.get(spanId)
    if (!span) return
    
    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
    span.status = status
    
    // Export the completed span
    this.exportSpan(span)
    
    // Clean up
    this.spans.delete(spanId)
  }
  
  /**
   * Add tags to a span
   */
  addTags(spanId: string, tags: Record<string, any>): void {
    const span = this.spans.get(spanId)
    if (!span) return
    
    span.tags = { ...span.tags, ...tags }
  }
  
  /**
   * Add a log entry to a span
   */
  addLog(
    spanId: string,
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    fields?: Record<string, any>
  ): void {
    const span = this.spans.get(spanId)
    if (!span) return
    
    span.logs.push({
      timestamp: Date.now(),
      message,
      level,
      fields,
    })
  }
  
  /**
   * Record an error on a span
   */
  recordError(spanId: string, error: Error): void {
    const span = this.spans.get(spanId)
    if (!span) return
    
    span.status = SpanStatus.ERROR
    span.tags.error = true
    span.tags.error_message = error.message
    span.tags.error_type = error.name
    
    this.addLog(spanId, error.message, 'error', {
      stack: error.stack,
    })
  }
  
  /**
   * Run a function with trace context
   */
  async runWithTrace<T>(
    operationName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.startTrace(operationName)
    
    const context: TraceContext = {
      traceId: span.traceId,
      spanId: span.spanId,
      startTime: span.startTime,
    }
    
    try {
      const result = await traceContext.run(context, fn)
      this.endSpan(span.spanId, SpanStatus.OK)
      return result
    } catch (error) {
      this.recordError(span.spanId, error as Error)
      this.endSpan(span.spanId, SpanStatus.ERROR)
      throw error
    }
  }
  
  /**
   * Trace decorator for methods
   */
  trace(operationName?: string, kind: SpanKind = SpanKind.INTERNAL) {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) => {
      const originalMethod = descriptor.value
      const name = operationName || `${target.constructor.name}.${propertyKey}`
      
      descriptor.value = async function (...args: any[]) {
        const span = tracing.startSpan(name, kind)
        if (!span) {
          return originalMethod.apply(this, args)
        }
        
        try {
          const result = await originalMethod.apply(this, args)
          tracing.endSpan(span.spanId, SpanStatus.OK)
          return result
        } catch (error) {
          tracing.recordError(span.spanId, error as Error)
          tracing.endSpan(span.spanId, SpanStatus.ERROR)
          throw error
        }
      }
      
      return descriptor
    }
  }
  
  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | undefined {
    return traceContext.getStore()
  }
  
  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string>): TraceContext | null {
    const traceId = headers['x-trace-id']
    const parentSpanId = headers['x-span-id']
    
    if (!traceId) return null
    
    return {
      traceId,
      spanId: this.generateId(),
      parentSpanId,
      startTime: Date.now(),
    }
  }
  
  /**
   * Inject trace context into headers
   */
  injectContext(headers: Record<string, string>): void {
    const context = traceContext.getStore()
    if (!context) return
    
    headers['x-trace-id'] = context.traceId
    headers['x-span-id'] = context.spanId
  }
  
  /**
   * Export a completed span
   */
  private exportSpan(span: Span): void {
    this.exporters.forEach(exporter => {
      try {
        exporter(span)
      } catch (error) {
        console.error('Failed to export span:', error)
      }
    })
  }
  
  /**
   * Add a span exporter
   */
  addExporter(exporter: (span: Span) => void): void {
    this.exporters.push(exporter)
  }
  
  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return randomBytes(8).toString('hex')
  }
  
  /**
   * Get all active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.spans.values())
  }
  
  /**
   * Clear all spans
   */
  clear(): void {
    this.spans.clear()
  }
}

/**
 * Express/Next.js middleware for tracing
 */
export function tracingMiddleware() {
  const tracer = TracingService.getInstance()
  
  return async (req: any, res: any, next: any) => {
    // Extract or create trace context
    let context = tracer.extractContext(req.headers)
    
    if (!context) {
      // Start new trace
      const span = tracer.startTrace(
        `${req.method} ${req.path}`,
        SpanKind.SERVER
      )
      
      context = {
        traceId: span.traceId,
        spanId: span.spanId,
        startTime: span.startTime,
      }
    }
    
    // Add trace headers to response
    res.setHeader('x-trace-id', context.traceId)
    
    // Run request in trace context
    traceContext.run(context, () => {
      // Track request completion
      const originalSend = res.send
      res.send = function (data: any) {
        // End span when response is sent
        if (context) {
          tracer.addTags(context.spanId, {
            'http.method': req.method,
            'http.url': req.url,
            'http.status_code': res.statusCode,
            'user.id': req.userId,
          })
          
          const status = res.statusCode >= 400 ? 
            SpanStatus.ERROR : SpanStatus.OK
          
          tracer.endSpan(context.spanId, status)
        }
        
        return originalSend.call(this, data)
      }
      
      next()
    })
  }
}

/**
 * Trace async functions
 */
export async function traceAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, any>
): Promise<T> {
  const tracer = TracingService.getInstance()
  const span = tracer.startSpan(name)
  
  if (!span) {
    return fn()
  }
  
  if (tags) {
    tracer.addTags(span.spanId, tags)
  }
  
  try {
    const result = await fn()
    tracer.endSpan(span.spanId, SpanStatus.OK)
    return result
  } catch (error) {
    tracer.recordError(span.spanId, error as Error)
    tracer.endSpan(span.spanId, SpanStatus.ERROR)
    throw error
  }
}

/**
 * Trace sync functions
 */
export function traceSync<T>(
  name: string,
  fn: () => T,
  tags?: Record<string, any>
): T {
  const tracer = TracingService.getInstance()
  const span = tracer.startSpan(name)
  
  if (!span) {
    return fn()
  }
  
  if (tags) {
    tracer.addTags(span.spanId, tags)
  }
  
  try {
    const result = fn()
    tracer.endSpan(span.spanId, SpanStatus.OK)
    return result
  } catch (error) {
    tracer.recordError(span.spanId, error as Error)
    tracer.endSpan(span.spanId, SpanStatus.ERROR)
    throw error
  }
}

// Export singleton
export const tracing = TracingService.getInstance()