'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { useMonitoringData } from '@/hooks/useMonitoringData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';
import { RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Database, Download, Clock, Shield } from 'lucide-react';
import { QuotaChart } from '@/components/admin/charts/AdminCharts';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  issues: string[];
}

interface MetricSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

interface DashboardData {
  timestamp: string;
  health: HealthStatus;
  summary: {
    review: Record<string, MetricSummary>;
    api: Record<string, MetricSummary>;
    sync: Record<string, MetricSummary>;
    cache: Record<string, MetricSummary>;
    database: Record<string, MetricSummary>;
  };
  system: {
    uptime: number;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  };
}

interface BackupStatus {
  pitr: {
    enabled: boolean;
    earliestRestoreTime: string | null;
    retentionDays: number;
    status: string;
  };
  backups: {
    total: number;
    successful: number;
    failed: number;
    inProgress: number;
    lastSuccessful: {
      id: string;
      timestamp: string;
      type: string;
    } | null;
    lastFailed?: {
      id: string;
      timestamp: string;
      error: string;
    } | null;
  };
  storage?: {
    bucket: string;
    backupPath: string;
  };
  health: {
    status: string;
    message?: string;
  };
}

interface QuotaData {
  quota: {
    reads: {
      used: number;
      limit: number;
      percentage: number;
      remaining: number;
    };
    writes: {
      used: number;
      limit: number;
      percentage: number;
      remaining: number;
    };
    deletes: {
      used: number;
      limit: number;
      percentage: number;
      remaining: number;
    };
    storage: {
      used: number;
      limit: number;
      percentage: number;
      remaining: number;
      unit: string;
    };
  };
  status: 'healthy' | 'warning' | 'critical';
  billingPlan: string;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
}

export default function MonitoringDashboard() {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Use optimized monitoring hook (15s refresh instead of 5s, single batch request)
  const {
    data: monitoringData,
    loading,
    error,
    refresh,
    lastUpdated,
  } = useMonitoringData({
    enabled: isAdmin,
    autoRefresh,
    refreshInterval: 15000, // 15 seconds instead of 5
  });

  // Extract data from batch response
  const data = monitoringData.metrics as DashboardData | null;
  const backupStatus = monitoringData.backup?.status as BackupStatus | null;
  const quotaData = monitoringData.quota as QuotaData | null;

  // Memoized computed values
  const errorRate = useMemo(() => {
    if (!data?.summary?.api) return '0.00';
    const errorCount = data.summary.api['api.error.count']?.sum || 0;
    const requestCount = data.summary.api['api.request.count']?.sum || 1;
    return ((errorCount / requestCount) * 100).toFixed(2);
  }, [data?.summary?.api]);

  const cacheHitRate = useMemo(() => {
    if (!data?.summary?.cache) return '0.0';
    const hits = data.summary.cache['cache.hit']?.sum || 0;
    const misses = data.summary.cache['cache.miss']?.sum || 1;
    return ((hits / (hits + misses)) * 100).toFixed(1);
  }, [data?.summary?.cache]);

  const syncSuccessRate = useMemo(() => {
    if (!data?.summary?.sync) return '0.0';
    const success = data.summary.sync['sync.success']?.sum || 0;
    const failure = data.summary.sync['sync.failure']?.sum || 1;
    return ((success / (success + failure)) * 100).toFixed(1);
  }, [data?.summary?.sync]);

  // Prepare quota chart data
  const quotaChartData = useMemo(() => {
    if (!quotaData?.quota) return [];
    return [
      { name: 'Reads', used: quotaData.quota.reads.used, limit: quotaData.quota.reads.limit, percentage: quotaData.quota.reads.percentage },
      { name: 'Writes', used: quotaData.quota.writes.used, limit: quotaData.quota.writes.limit, percentage: quotaData.quota.writes.percentage },
      { name: 'Deletes', used: quotaData.quota.deletes.used, limit: quotaData.quota.deletes.limit, percentage: quotaData.quota.deletes.percentage },
    ];
  }, [quotaData]);

  // Memoized callbacks
  const handleAutoRefreshToggle = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const triggerBackup = useCallback(async () => {
    setBackupLoading(true);
    setBackupMessage(null);

    try {
      const response = await fetch('/api/admin/backup/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Manual backup from monitoring dashboard',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBackupMessage('✅ Backup initiated successfully! This may take several minutes.');
        // Refresh data after 2 seconds to get updated backup status
        setTimeout(() => {
          refresh();
        }, 2000);
      } else {
        setBackupMessage(`❌ Backup failed: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      setBackupMessage(`❌ Error: ${err instanceof Error ? err.message : 'Failed to trigger backup'}`);
    } finally {
      setBackupLoading(false);
      setTimeout(() => setBackupMessage(null), 10000);
    }
  }, [refresh]);

  const checkBackupStatus = useCallback(async () => {
    setCheckingStatus(true);

    try {
      const response = await fetch('/api/admin/backup/check-status', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setBackupMessage(`✅ Checked ${result.checked} backups, updated ${result.updated} to completed`);
        // Refresh data to get updated status
        setTimeout(() => {
          refresh();
        }, 1000);
      } else {
        setBackupMessage(`❌ Status check failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setBackupMessage(`❌ Error: ${err instanceof Error ? err.message : 'Failed to check status'}`);
    } finally {
      setCheckingStatus(false);
      setTimeout(() => setBackupMessage(null), 5000);
    }
  }, [refresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5" />;
      case 'unhealthy': return <XCircle className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  };

  if (adminLoading || (loading && !data)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {adminLoading ? 'Verifying admin access...' : 'Loading monitoring data...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You do not have admin privileges</p>
        </div>
      </div>
    );
  }

  return (
    <AdminErrorBoundary componentName="System Monitoring">
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header - Mobile responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold">System Monitoring</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Real-time metrics and health status</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {lastUpdated && (
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={handleAutoRefreshToggle}
            size="sm"
            className="text-xs sm:text-sm"
          >
            {autoRefresh ? '⏱️ 15s' : '⏸️ Off'}
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-red-500 bg-red-50">
          <p className="text-red-600">Error: {error}</p>
        </Card>
      )}

      {data && (
        <>
          {/* Health Status Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">System Health</h2>
              <div className={`flex items-center gap-2 ${getStatusColor(data.health.status)}`}>
                {getStatusIcon(data.health.status)}
                <span className="font-medium uppercase">{data.health.status}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold">{data.health.score}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">System Uptime</p>
                <p className="text-2xl font-bold">{formatUptime(data.system.uptime)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm">{new Date(data.timestamp).toLocaleString()}</p>
              </div>
            </div>

            {data.health.issues.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="font-medium text-yellow-800 mb-2">Active Issues:</p>
                <ul className="list-disc list-inside text-sm text-yellow-700">
                  {data.health.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* API Metrics */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">API Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.summary.api['api.request.duration'] && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Response Time</p>
                    <p className="text-xl font-semibold">
                      {data.summary.api['api.request.duration'].avg.toFixed(0)}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">P95 Response Time</p>
                    <p className="text-xl font-semibold">
                      {data.summary.api['api.request.duration'].p95.toFixed(0)}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-xl font-semibold">
                      {data.summary.api['api.request.count']?.sum || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Error Rate</p>
                    <p className="text-xl font-semibold">
                      {errorRate}%
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Review Engine Metrics */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Review Engine</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.summary.review['review.completion.count'] && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Sessions Completed</p>
                    <p className="text-xl font-semibold">
                      {data.summary.review['review.completion.count'].sum}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                    <p className="text-xl font-semibold">
                      {(data.summary.review['review.completion.accuracy']?.avg * 100 || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Response Time</p>
                    <p className="text-xl font-semibold">
                      {(data.summary.review['review.completion.response_time']?.avg || 0).toFixed(0)}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Queue Gen Time</p>
                    <p className="text-xl font-semibold">
                      {(data.summary.review['queue.generation.time']?.avg || 0).toFixed(0)}ms
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Cache & Sync Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Cache Performance</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
                  <span className="font-semibold">
                    {cacheHitRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Hits</span>
                  <span className="font-semibold">{data.summary.cache['cache.hit']?.sum || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Misses</span>
                  <span className="font-semibold">{data.summary.cache['cache.miss']?.sum || 0}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Offline Sync</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="font-semibold">
                    {syncSuccessRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Successful Syncs</span>
                  <span className="font-semibold">{data.summary.sync['sync.success']?.sum || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Failed Syncs</span>
                  <span className="font-semibold">{data.summary.sync['sync.failure']?.sum || 0}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* System Resources */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">System Resources</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Memory (RSS)</p>
                <p className="text-xl font-semibold">
                  {formatBytes(data.system.memory.rss)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Heap Used</p>
                <p className="text-xl font-semibold">
                  {formatBytes(data.system.memory.heapUsed)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Heap Total</p>
                <p className="text-xl font-semibold">
                  {formatBytes(data.system.memory.heapTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">External</p>
                <p className="text-xl font-semibold">
                  {formatBytes(data.system.memory.external)}
                </p>
              </div>
            </div>
          </Card>

          {/* Database Backup & Protection */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Database Backup & Protection</h2>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={checkBackupStatus}
                  disabled={checkingStatus}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                  {checkingStatus ? 'Checking...' : 'Check Status'}
                </Button>
                <Button
                  onClick={triggerBackup}
                  disabled={backupLoading}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <Download className={`w-4 h-4 ${backupLoading ? 'animate-spin' : ''}`} />
                  {backupLoading ? 'Creating Backup...' : 'Backup Now'}
                </Button>
              </div>
            </div>

            {backupMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                backupMessage.startsWith('✅')
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}>
                {backupMessage}
              </div>
            )}

            {backupStatus && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PITR Status */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4" />
                    <h3 className="font-semibold">Point-in-Time Recovery</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className={`font-semibold flex items-center gap-1 ${
                        backupStatus.pitr.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {backupStatus.pitr.enabled ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {backupStatus.pitr.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    {backupStatus.pitr.enabled && (
                      <>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                          <span className="text-sm text-muted-foreground">Retention</span>
                          <span className="font-semibold">{backupStatus.pitr.retentionDays} days</span>
                        </div>
                        {backupStatus.pitr.earliestRestoreTime && (
                          <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <span className="text-sm text-muted-foreground">Earliest Restore</span>
                            <span className="text-xs font-medium">
                              {new Date(backupStatus.pitr.earliestRestoreTime).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {!backupStatus.pitr.enabled && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-800 dark:text-red-200 font-medium">
                          ⚠️ CRITICAL: Enable PITR immediately for disaster recovery
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Backup Statistics */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" />
                    <h3 className="font-semibold">Backup History</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-sm text-muted-foreground">Total Backups</span>
                      <span className="font-semibold">{backupStatus.backups.total}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-sm text-muted-foreground">Successful</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {backupStatus.backups.successful}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-sm text-muted-foreground">Failed</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {backupStatus.backups.failed}
                      </span>
                    </div>
                    {backupStatus.backups.lastSuccessful && (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <p className="text-xs text-green-800 dark:text-green-200">
                          Last successful: {new Date(backupStatus.backups.lastSuccessful.timestamp).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!backupStatus && (
              <div className="text-center py-8 text-muted-foreground">
                Loading backup status...
              </div>
            )}
          </Card>

          {/* Firebase Quota Monitoring */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Firebase Quota Usage</h2>
              </div>
              {quotaData && (
                <div className={`flex items-center gap-2 ${
                  quotaData.status === 'healthy' ? 'text-green-600 dark:text-green-400' :
                  quotaData.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {quotaData.status === 'healthy' && <CheckCircle className="w-5 h-5" />}
                  {quotaData.status === 'warning' && <AlertTriangle className="w-5 h-5" />}
                  {quotaData.status === 'critical' && <XCircle className="w-5 h-5" />}
                  <span className="font-medium uppercase">{quotaData.status}</span>
                </div>
              )}
            </div>

            {quotaData ? (
              <>
                {/* Quota Chart - Visual representation */}
                <div className="mb-4 sm:mb-6 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">Usage Overview</p>
                  <QuotaChart data={quotaChartData} />
                </div>

                {/* Quota Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4">
                  {/* Reads */}
                  <div className="p-2 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Reads</p>
                    <p className={`text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1 ${
                      quotaData.quota.reads.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.reads.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.reads.percentage}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {quotaData.quota.reads.used >= 1000
                        ? `${(quotaData.quota.reads.used / 1000).toFixed(1)}K`
                        : quotaData.quota.reads.used}
                      <span className="hidden sm:inline"> / {quotaData.quota.reads.limit.toLocaleString()}</span>
                    </p>
                    <div className="mt-1 sm:mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className={`h-1.5 sm:h-2 rounded-full transition-all ${
                          quotaData.quota.reads.percentage > 80 ? 'bg-red-600' :
                          quotaData.quota.reads.percentage > 60 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(quotaData.quota.reads.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Writes */}
                  <div className="p-2 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Writes</p>
                    <p className={`text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1 ${
                      quotaData.quota.writes.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.writes.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.writes.percentage}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {quotaData.quota.writes.used >= 1000
                        ? `${(quotaData.quota.writes.used / 1000).toFixed(1)}K`
                        : quotaData.quota.writes.used}
                      <span className="hidden sm:inline"> / {quotaData.quota.writes.limit.toLocaleString()}</span>
                    </p>
                    <div className="mt-1 sm:mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className={`h-1.5 sm:h-2 rounded-full transition-all ${
                          quotaData.quota.writes.percentage > 80 ? 'bg-red-600' :
                          quotaData.quota.writes.percentage > 60 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(quotaData.quota.writes.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Deletes */}
                  <div className="p-2 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Deletes</p>
                    <p className={`text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1 ${
                      quotaData.quota.deletes.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.deletes.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.deletes.percentage}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {quotaData.quota.deletes.used >= 1000
                        ? `${(quotaData.quota.deletes.used / 1000).toFixed(1)}K`
                        : quotaData.quota.deletes.used}
                      <span className="hidden sm:inline"> / {quotaData.quota.deletes.limit.toLocaleString()}</span>
                    </p>
                    <div className="mt-1 sm:mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className={`h-1.5 sm:h-2 rounded-full transition-all ${
                          quotaData.quota.deletes.percentage > 80 ? 'bg-red-600' :
                          quotaData.quota.deletes.percentage > 60 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(quotaData.quota.deletes.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Storage */}
                  <div className="p-2 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Storage</p>
                    <p className={`text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1 ${
                      quotaData.quota.storage.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.storage.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.storage.percentage}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {quotaData.quota.storage.used}{quotaData.quota.storage.unit}
                      <span className="hidden sm:inline"> / {quotaData.quota.storage.limit}{quotaData.quota.storage.unit}</span>
                    </p>
                    <div className="mt-1 sm:mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className={`h-1.5 sm:h-2 rounded-full transition-all ${
                          quotaData.quota.storage.percentage > 80 ? 'bg-red-600' :
                          quotaData.quota.storage.percentage > 60 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(quotaData.quota.storage.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Billing Plan & Alerts */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Plan:</strong> {quotaData.billingPlan === 'free' ? 'Free (Spark)' : 'Blaze (Pay-as-you-go)'}
                    </p>
                  </div>

                  {quotaData.alerts && quotaData.alerts.length > 0 && (
                    <div className="flex-1 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200 text-xs mb-1">Active Alerts:</p>
                      <ul className="list-disc list-inside text-xs text-yellow-700 dark:text-yellow-300">
                        {quotaData.alerts.map((alert, i) => (
                          <li key={i}>{alert.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-3 italic">
                  Note: Usage estimates are based on typical patterns. Enable real-time tracking for accurate data.
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Loading quota data...
              </div>
            )}
          </Card>
        </>
      )}
    </div>
    </AdminErrorBoundary>
  );
}