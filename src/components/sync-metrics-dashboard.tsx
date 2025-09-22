/**
 * Sync Performance Metrics Dashboard
 * Real-time monitoring of offline sync system health and performance
 */

import React, { useEffect, useState, useCallback } from 'react';
import { syncTelemetry } from '@/lib/review-engine/offline/sync-telemetry';
import { ImprovedSyncQueue } from '@/lib/review-engine/offline/improved-sync-queue';

interface DashboardProps {
  syncQueue: ImprovedSyncQueue;
  refreshInterval?: number;
}

interface MetricsState {
  performance: {
    averageSyncTime: number;
    p50SyncTime: number;
    p95SyncTime: number;
    p99SyncTime: number;
    syncRate: number;
    dataRate: number;
    successRate: number;
    conflictRate: number;
    retryRate: number;
    deadLetterRate: number;
    circuitBreakerTrips: number;
    averageRecoveryTime: number;
    averageQueueSize: number;
    maxQueueSize: number;
    averageQueueLatency: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    isOnline: boolean;
    circuitBreakerOpen: boolean;
    queueBacklog: number;
    recentErrors: string[];
    lastSuccessfulSync?: number;
    recommendations: string[];
  };
  queueStatus: {
    pending: number;
    syncing: number;
    failed: number;
    total: number;
    circuitBreakerOpen: boolean;
  };
  syncHistory: Array<{
    type: string;
    timestamp: number;
    details: any;
    error?: string;
  }>;
}

export const SyncMetricsDashboard: React.FC<DashboardProps> = ({ 
  syncQueue, 
  refreshInterval = 2000 
}) => {
  const [metrics, setMetrics] = useState<MetricsState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const [performance, queueStatus, history] = await Promise.all([
        syncTelemetry.getPerformanceMetrics(),
        syncQueue.getQueueStatus(),
        Promise.resolve(syncTelemetry.getSyncHistory(20))
      ]);

      const health = syncTelemetry.getHealthStatus(
        queueStatus.total,
        queueStatus.circuitBreakerOpen
      );

      setMetrics({
        performance,
        health,
        queueStatus,
        syncHistory: history
      });
    } catch (error) {
      console.error('Failed to fetch sync metrics:', error);
    }
  }, [syncQueue]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  if (!metrics) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="animate-pulse">Loading sync metrics...</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const timeSinceLastSync = metrics.health.lastSuccessfulSync
    ? Date.now() - metrics.health.lastSuccessfulSync
    : null;

  return (
    <div className="bg-soft-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Sync Performance Dashboard
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-500 hover:text-blue-600"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Health Status Bar */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={`text-2xl ${getStatusColor(metrics.health.status)}`}>
              {metrics.health.status === 'healthy' ? '✓' : 
               metrics.health.status === 'degraded' ? '⚠' : '✗'}
            </span>
            <span className={`font-semibold ${getStatusColor(metrics.health.status)}`}>
              {metrics.health.status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <span className={metrics.health.isOnline ? 'text-green-500' : 'text-red-500'}>
              {metrics.health.isOnline ? '🌐 Online' : '🔌 Offline'}
            </span>
            <span className={metrics.health.circuitBreakerOpen ? 'text-red-500' : 'text-green-500'}>
              Circuit: {metrics.health.circuitBreakerOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </div>
        
        {metrics.health.recommendations.length > 0 && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="font-semibold mb-1">Recommendations:</div>
            {metrics.health.recommendations.map((rec, idx) => (
              <div key={idx} className="ml-2">• {rec}</div>
            ))}
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Success Rate"
          value={formatPercentage(metrics.performance.successRate)}
          color={metrics.performance.successRate > 95 ? 'green' : 
                 metrics.performance.successRate > 90 ? 'yellow' : 'red'}
        />
        <MetricCard
          label="Sync Rate"
          value={`${metrics.performance.syncRate}/min`}
          color="blue"
        />
        <MetricCard
          label="Queue Size"
          value={metrics.queueStatus.total.toString()}
          color={metrics.queueStatus.total < 10 ? 'green' : 
                 metrics.queueStatus.total < 50 ? 'yellow' : 'red'}
        />
        <MetricCard
          label="Avg Sync Time"
          value={formatTime(metrics.performance.averageSyncTime)}
          color={metrics.performance.averageSyncTime < 1000 ? 'green' : 
                 metrics.performance.averageSyncTime < 5000 ? 'yellow' : 'red'}
        />
      </div>

      {/* Queue Status */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Queue Status</h3>
        <div className="flex space-x-4">
          <QueueStatusBar
            label="Pending"
            value={metrics.queueStatus.pending}
            total={metrics.queueStatus.total}
            color="blue"
          />
          <QueueStatusBar
            label="Syncing"
            value={metrics.queueStatus.syncing}
            total={metrics.queueStatus.total}
            color="yellow"
          />
          <QueueStatusBar
            label="Failed"
            value={metrics.queueStatus.failed}
            total={metrics.queueStatus.total}
            color="red"
          />
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Performance Details */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Performance Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>P50 Latency: {formatTime(metrics.performance.p50SyncTime)}</div>
              <div>P95 Latency: {formatTime(metrics.performance.p95SyncTime)}</div>
              <div>P99 Latency: {formatTime(metrics.performance.p99SyncTime)}</div>
              <div>Retry Rate: {formatPercentage(metrics.performance.retryRate)}</div>
              <div>Conflict Rate: {formatPercentage(metrics.performance.conflictRate)}</div>
              <div>Dead Letter Rate: {formatPercentage(metrics.performance.deadLetterRate)}</div>
              <div>Data Rate: {metrics.performance.dataRate.toFixed(1)} KB/min</div>
              <div>CB Trips: {metrics.performance.circuitBreakerTrips}</div>
              <div>Avg Recovery: {formatTime(metrics.performance.averageRecoveryTime)}</div>
            </div>
          </div>

          {/* Recent Sync History */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Recent Activity
            </h3>
            <div className="max-h-40 overflow-y-auto text-sm space-y-1">
              {metrics.syncHistory.map((event, idx) => (
                <div
                  key={idx}
                  className={`flex items-center space-x-2 ${
                    event.type === 'sync_failed' ? 'text-red-500' : 
                    event.type === 'sync_completed' ? 'text-green-500' : 
                    'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{event.type.replace('_', ' ')}</span>
                  {event.error && <span className="text-xs">({event.error})</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Errors */}
          {metrics.health.recentErrors.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Recent Errors
              </h3>
              <div className="space-y-1 text-sm text-red-500">
                {metrics.health.recentErrors.map((error, idx) => (
                  <div key={idx}>• {error}</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Last Sync Time */}
      {timeSinceLastSync !== null && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Last successful sync: {formatTime(timeSinceLastSync)} ago
        </div>
      )}
    </div>
  );
};

// Sub-components
const MetricCard: React.FC<{
  label: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
}> = ({ label, value, color }) => {
  const colorClasses = {
    green: 'text-green-500 bg-green-50 dark:bg-green-900/20',
    yellow: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    red: 'text-red-500 bg-red-50 dark:bg-red-900/20',
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="text-xs opacity-75 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
};

const QueueStatusBar: React.FC<{
  label: string;
  value: number;
  total: number;
  color: 'blue' | 'yellow' | 'red';
}> = ({ label, value, total, color }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const colorClasses = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className="flex-1">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default SyncMetricsDashboard;