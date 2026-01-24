/**
 * AdminErrorBoundary
 * Error boundary for admin dashboard pages with retry and circuit breaker
 */

'use client'

import React, { Component, ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react'

/**
 * Error boundary props
 */
interface AdminErrorBoundaryProps {
  children: ReactNode
  componentName?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

/**
 * Error boundary state
 */
interface AdminErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCount: number
  isRecovering: boolean
}

/**
 * Maximum errors before permanent failure state
 */
const MAX_ERROR_COUNT = 3

/**
 * AdminErrorBoundary class
 * Provides error isolation and recovery for admin dashboard components
 */
export class AdminErrorBoundary extends Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout

  constructor(props: AdminErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      isRecovering: false,
    }
  }

  /**
   * Catch errors in child components
   */
  static getDerivedStateFromError(error: Error): Partial<AdminErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  /**
   * Log errors and handle recovery
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, componentName } = this.props
    const { errorCount } = this.state
    const newErrorCount = errorCount + 1

    this.setState({
      errorInfo,
      errorCount: newErrorCount,
    })

    // Log error with context
    console.error('[AdminErrorBoundary] Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      componentName,
      errorCount: newErrorCount,
      timestamp: new Date().toISOString(),
    })

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo)
      } catch (handlerError) {
        console.error('[AdminErrorBoundary] Error in custom handler:', handlerError)
      }
    }

    // Track error event for analytics
    this.trackErrorEvent(error)
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
   * Reset error boundary state
   */
  resetErrorBoundary = (): void => {
    console.log('[AdminErrorBoundary] Resetting error boundary', {
      componentName: this.props.componentName,
      errorCount: this.state.errorCount,
    })

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
    })
  }

  /**
   * Attempt automatic recovery with delay
   */
  attemptRecovery = (): void => {
    const { errorCount } = this.state

    if (errorCount >= MAX_ERROR_COUNT) {
      console.warn('[AdminErrorBoundary] Too many errors, not attempting recovery')
      return
    }

    this.setState({ isRecovering: true })

    this.retryTimeout = setTimeout(() => {
      this.resetErrorBoundary()
    }, 2000)
  }

  /**
   * Track error event for analytics
   */
  private trackErrorEvent(error: Error): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'admin_error_boundary_triggered', {
        event_category: 'Admin Errors',
        event_label: this.props.componentName || 'AdminComponent',
        error_message: error.message,
      })
    }
  }

  /**
   * Render error fallback or children
   */
  render(): ReactNode {
    const { hasError, error, errorInfo, isRecovering, errorCount } = this.state
    const { children, componentName } = this.props

    if (hasError && error) {
      // Recovering state - show loading spinner
      if (isRecovering) {
        return (
          <div className="flex items-center justify-center p-8 min-h-[200px]">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recovering...
              </p>
            </div>
          </div>
        )
      }

      // Permanent failure state (too many errors)
      if (errorCount >= MAX_ERROR_COUNT) {
        return (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 m-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">
                  {componentName || 'Component'} Failed
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  This section encountered multiple errors and cannot recover automatically.
                  Please refresh the page to try again.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-red-600 dark:text-red-400">
                      Error details (dev only)
                    </summary>
                    <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/40 rounded-lg text-xs overflow-auto max-h-40 text-red-800 dark:text-red-200">
                      {error.toString()}
                      {errorInfo?.componentStack && (
                        <>
                          {'\n\nComponent Stack:'}
                          {errorInfo.componentStack}
                        </>
                      )}
                    </pre>
                  </details>
                )}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      // Recoverable error state
      return (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 m-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                {componentName || 'Component'} Error
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Something went wrong loading this section. You can try again or refresh the page.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-amber-600 dark:text-amber-400">
                    Error details (dev only)
                  </summary>
                  <pre className="mt-2 p-3 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-xs overflow-auto max-h-40 text-amber-800 dark:text-amber-200">
                    {error.toString()}
                  </pre>
                </details>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={this.resetErrorBoundary}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={this.attemptRecovery}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Auto-Retry
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Errors: {errorCount}/{MAX_ERROR_COUNT} (page refresh required after {MAX_ERROR_COUNT})
              </p>
            </div>
          </div>
        </div>
      )
    }

    // No error, render children normally
    return children
  }
}

/**
 * Higher-order component to wrap any component with admin error boundary
 */
export function withAdminErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <AdminErrorBoundary componentName={componentName}>
      <Component {...props} />
    </AdminErrorBoundary>
  )

  WrappedComponent.displayName = `withAdminErrorBoundary(${Component.displayName || Component.name || componentName})`

  return WrappedComponent
}

export default AdminErrorBoundary
