'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface StripeEvent {
  id: string
  type: string
  timestamp: string
  status: 'processing' | 'success' | 'error'
  steps: {
    name: string
    status: 'pending' | 'running' | 'success' | 'error'
    duration?: number
    details?: string
  }[]
}

export default function StripeEventMonitor() {
  const [events, setEvents] = useState<StripeEvent[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)

  // Mock event for demonstration - in real implementation, this would connect to SSE or polling
  useEffect(() => {
    if (!isMonitoring) return

    // Check URL params for checkout success
    const params = new URLSearchParams(window.location.search)
    const testStatus = params.get('test')

    if (testStatus === 'success') {
      // Simulate event processing
      const mockEvent: StripeEvent = {
        id: 'evt_test_' + Date.now(),
        type: 'checkout.session.completed',
        timestamp: new Date().toISOString(),
        status: 'processing',
        steps: [
          { name: 'Webhook received', status: 'success', duration: 12 },
          { name: 'Signature verified', status: 'success', duration: 8 },
          { name: 'Idempotency check', status: 'success', duration: 15 },
          { name: 'Customer mapping', status: 'success', duration: 23 },
          { name: 'Firestore update', status: 'success', duration: 45 },
          { name: 'Cache invalidation', status: 'success', duration: 18 },
        ],
      }

      setEvents(prev => [mockEvent, ...prev])

      // Simulate processing steps
      setTimeout(() => {
        setEvents(prev => prev.map(e =>
          e.id === mockEvent.id ? { ...e, status: 'success' as const } : e
        ))
      }, 500)
    }
  }, [isMonitoring])

  return (
    <div className="bg-white dark:bg-dark-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>📡</span>
          Live Event Monitor
        </h2>
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isMonitoring
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          {isMonitoring ? '🟢 Monitoring' : '⚫ Stopped'}
        </button>
      </div>

      {!isMonitoring && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          Click "Start Monitoring" to view webhook events in real-time
        </div>
      )}

      {isMonitoring && events.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            Waiting for events...
          </div>
        </div>
      )}

      <AnimatePresence>
        <div className="space-y-3">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className={`border rounded-lg p-4 ${
                event.status === 'success'
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                  : event.status === 'error'
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
              }`}
            >
              {/* Event Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {event.status === 'success' ? '✅' : event.status === 'error' ? '❌' : '⏳'}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {event.type}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {event.id.slice(0, 20)}...
                </div>
              </div>

              {/* Processing Steps */}
              <div className="space-y-1.5 ml-7">
                {event.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        {step.status === 'success' ? '✓' :
                         step.status === 'error' ? '✗' :
                         step.status === 'running' ? '⟳' : '○'}
                      </span>
                      <span className={
                        step.status === 'success' ? 'text-green-700 dark:text-green-300' :
                        step.status === 'error' ? 'text-red-700 dark:text-red-300' :
                        'text-gray-600 dark:text-gray-400'
                      }>
                        {step.name}
                      </span>
                    </div>
                    {step.duration && (
                      <span className="text-gray-500 dark:text-gray-500">
                        {step.duration}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Total Duration */}
              {event.status === 'success' && (
                <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300 font-medium">
                  Total: {event.steps.reduce((sum, s) => sum + (s.duration || 0), 0)}ms
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  )
}
