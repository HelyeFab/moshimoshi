'use client'

import { AlertTriangle, Shield, Clock, User } from 'lucide-react'

interface Props {
  data: any
}

export function AnomalyAlerts({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Anomaly Alerts
        </h2>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available
        </div>
      </div>
    )
  }

  const violations = data.violations?.recent || []
  const hasViolations = violations.length > 0

  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Anomaly Alerts
        </h2>
        <div className="flex items-center">
          {hasViolations ? (
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
          ) : (
            <Shield className="w-5 h-5 text-green-500" />
          )}
        </div>
      </div>

      {!hasViolations ? (
        <div className="flex flex-col items-center justify-center h-48">
          <Shield className="w-16 h-16 text-green-500 mb-3" />
          <p className="text-lg font-semibold text-green-700 dark:text-green-400">
            System Protected
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
            No violations detected. Free users are properly blocked from Firebase.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {violations.slice(0, 10).map((violation: any, index: number) => (
            <div
              key={`${violation.userId}-${violation.timestamp}-${index}`}
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                    <span className="font-semibold text-red-900 dark:text-red-200">
                      {violation.operation?.toUpperCase() || 'WRITE'} Violation
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center text-xs text-red-700 dark:text-red-300">
                      <User className="w-3 h-3 mr-1" />
                      User: {violation.userId?.substring(0, 8)}...
                    </div>
                    <div className="flex items-center text-xs text-red-700 dark:text-red-300">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(violation.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      Collection: {violation.collection}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      Source: {violation.source}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {violations.length > 10 && (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                And {violations.length - 10} more violations...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Violations</p>
            <p className={`text-2xl font-bold ${hasViolations ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {data.summary.violations || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
            <p className={`text-sm font-semibold ${hasViolations ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {hasViolations ? '🚨 CRITICAL' : '✅ SECURE'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}