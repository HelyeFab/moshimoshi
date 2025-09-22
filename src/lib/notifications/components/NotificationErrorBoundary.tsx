/**
 * NotificationErrorBoundary
 * Error boundary for notification components with recovery mechanisms
 */

import React, { Component, ReactNode, ErrorInfo } from 'react'
import { reviewLogger } from '@/lib/monitoring/logger'
import { CircuitBreaker, CircuitBreakerFactory } from '../utils/CircuitBreaker'

/**
 * Error boundary props
 */
interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean
  componentName?: string
}

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCount: number
  lastErrorTime: Date | null
  isRecovering: boolean
}

/**
 * NotificationErrorBoundary class
 * Provides error isolation and recovery for notification components
 */
export class NotificationErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private circuitBreaker: CircuitBreaker
  private retryTimeout?: NodeJS.Timeout
  private resetKeysRef: Array<string | number> = []

  constructor(props: ErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null,
      isRecovering: false
    }

    // Create circuit breaker for error recovery
    const componentName = props.componentName || 'NotificationComponent'
    this.circuitBreaker = CircuitBreakerFactory.getBreaker(
      `error-boundary-${componentName}`,
      {
        failureThreshold: 3,
        resetTimeout: 30000, // 30 seconds
        requestTimeout: 5000
      }
    )

    this.resetKeysRef = props.resetKeys || []
  }

  /**
   * Catch errors in child components
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: new Date()
    }
  }

  /**
   * Log errors and handle recovery
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, componentName } = this.props
    const { errorCount } = this.state

    // Update error count
    const newErrorCount = errorCount + 1
    this.setState({
      errorInfo,
      errorCount: newErrorCount
    })

    // Log error with context
    reviewLogger.error('NotificationErrorBoundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      componentName,
      errorCount: newErrorCount,
      timestamp: new Date().toISOString()
    })

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo)
      } catch (handlerError) {
        reviewLogger.error('Error in custom error handler', handlerError)
      }
    }

    // Track error event
    this.trackErrorEvent(error, errorInfo)

    // Attempt automatic recovery if not too many errors
    if (newErrorCount <= 3) {
      this.attemptRecovery()
    } else {
      reviewLogger.error('Too many errors, not attempting automatic recovery', {
        errorCount: newErrorCount,
        componentName
      })
    }
  }

  /**
   * Check if component should reset when props change
   */
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    if (!hasError) return

    // Check if reset keys changed
    if (resetKeys && this.hasResetKeyChanged(prevProps.resetKeys || [])) {
      this.resetErrorBoundary()
      return
    }

    // Reset on any props change if configured
    if (resetOnPropsChange && this.propsHaveChanged(prevProps)) {
      this.resetErrorBoundary()
    }
  }

  /**
   * Clean up on unmount
   */
  componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  /**
   * Check if reset keys have changed
   */
  private hasResetKeyChanged(prevKeys: Array<string | number>): boolean {
    const currentKeys = this.props.resetKeys || []

    if (prevKeys.length !== currentKeys.length) return true

    return currentKeys.some((key, index) => key !== prevKeys[index])
  }

  /**
   * Check if props have changed
   */
  private propsHaveChanged(prevProps: ErrorBoundaryProps): boolean {
    const propsToCheck = ['children', 'fallback', 'isolate']

    return propsToCheck.some(prop =>
      (this.props as any)[prop] !== (prevProps as any)[prop]
    )
  }

  /**
   * Attempt automatic recovery
   */
  private attemptRecovery(): void {
    this.setState({ isRecovering: true })

    // Use circuit breaker to manage recovery attempts
    this.circuitBreaker.execute(async () => {
      // Wait before recovery attempt
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Reset error state
      this.resetErrorBoundary()

      return true
    }).catch(error => {
      reviewLogger.error('Recovery attempt failed', error)
      this.setState({ isRecovering: false })
    })
  }

  /**
   * Reset error boundary state
   */
  resetErrorBoundary = (): void => {
    reviewLogger.info('Resetting error boundary', {
      componentName: this.props.componentName,
      errorCount: this.state.errorCount
    })

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false
    })
  }

  /**
   * Track error event for analytics
   */
  private trackErrorEvent(error: Error, errorInfo: ErrorInfo): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'error_boundary_triggered', {
        event_category: 'Errors',
        event_label: this.props.componentName || 'NotificationComponent',
        error_message: error.message,
        error_stack: error.stack?.substring(0, 500) // Limit stack trace length
      })
    }
  }

  /**
   * Render error fallback or children
   */
  render(): ReactNode {
    const { hasError, error, errorInfo, isRecovering, errorCount } = this.state
    const { children, fallback, isolate } = this.props

    if (hasError && error) {
      // If recovering, show loading state
      if (isRecovering) {
        return (
          <div className="flex items-center justify-center p-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recovering from error...
              </p>
            </div>
          </div>
        )
      }

      // Too many errors, show permanent error state
      if (errorCount > 3) {
        return (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Notification System Error
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  The notification system encountered multiple errors and cannot recover.
                  Please refresh the page to try again.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                >
                  Refresh Page →
                </button>
              </div>
            </div>
          </div>
        )
      }

      // Custom fallback
      if (typeof fallback === 'function') {
        return <>{fallback(error, errorInfo!)}</>
      }

      // Static fallback
      if (fallback) {
        return <>{fallback}</>
      }

      // Default fallback
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Notification Component Error
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>Something went wrong with the notification system.</p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Error details</summary>
                    <pre className="mt-1 text-xs overflow-auto">
                      {error.toString()}
                    </pre>
                  </details>
                )}
              </div>
              <div className="mt-3">
                <button
                  onClick={this.resetErrorBoundary}
                  className="text-sm font-medium text-yellow-600 hover:text-yellow-500 dark:text-yellow-400 dark:hover:text-yellow-300"
                >
                  Try again →
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // No error, render children normally
    // Optionally isolate children to prevent cascading failures
    if (isolate) {
      return (
        <div className="notification-boundary-container">
          {children}
        </div>
      )
    }

    return children
  }
}

/**
 * Higher-order component to wrap any component with error boundary
 */
export function withNotificationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <NotificationErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </NotificationErrorBoundary>
  )

  WrappedComponent.displayName = `withNotificationErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

/**
 * Hook to programmatically trigger error boundary
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    throw error // This will be caught by nearest error boundary
  }
}