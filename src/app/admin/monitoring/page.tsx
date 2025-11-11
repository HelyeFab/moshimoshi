'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Database, Download, Clock, Shield } from 'lucide-react';

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
    lastFailed: {
      id: string;
      timestamp: string;
      error: string;
    } | null;
  };
  health: {
    status: string;
    message: string;
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/health/metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const metrics = await response.json();
      setData(metrics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupStatus = async () => {
    try {
      const response = await fetch('/api/admin/backup/status');
      if (!response.ok) {
        console.error('Failed to fetch backup status');
        return;
      }
      const result = await response.json();
      if (result.success) {
        setBackupStatus(result.status);
      }
    } catch (err) {
      console.error('Error fetching backup status:', err);
    }
  };

  const fetchQuotaData = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/quota');
      if (!response.ok) {
        console.error('Failed to fetch quota data');
        return;
      }
      const result = await response.json();
      if (result.success) {
        setQuotaData(result);
      }
    } catch (err) {
      console.error('Error fetching quota data:', err);
    }
  };

  const triggerBackup = async () => {
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
        // Refresh backup status after 2 seconds
        setTimeout(() => {
          fetchBackupStatus();
        }, 2000);
      } else {
        setBackupMessage(`❌ Backup failed: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      setBackupMessage(`❌ Error: ${err instanceof Error ? err.message : 'Failed to trigger backup'}`);
    } finally {
      setBackupLoading(false);
      // Clear message after 10 seconds
      setTimeout(() => setBackupMessage(null), 10000);
    }
  };

  const checkBackupStatus = async () => {
    setCheckingStatus(true);

    try {
      const response = await fetch('/api/admin/backup/check-status', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setBackupMessage(`✅ Checked ${result.checked} backups, updated ${result.updated} to completed`);
        // Refresh backup status
        setTimeout(() => {
          fetchBackupStatus();
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
  };

  useEffect(() => {
    fetchMetrics();
    fetchBackupStatus();
    fetchQuotaData();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
        fetchBackupStatus();
        fetchQuotaData();
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring Dashboard</h1>
          <p className="text-muted-foreground">Real-time metrics and health status</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={fetchMetrics} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
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
                      {((data.summary.api['api.error.count']?.sum || 0) / 
                        (data.summary.api['api.request.count']?.sum || 1) * 100).toFixed(2)}%
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
                    {((data.summary.cache['cache.hit']?.sum || 0) / 
                      ((data.summary.cache['cache.hit']?.sum || 0) + 
                       (data.summary.cache['cache.miss']?.sum || 1)) * 100).toFixed(1)}%
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
                    {((data.summary.sync['sync.success']?.sum || 0) / 
                      ((data.summary.sync['sync.success']?.sum || 0) + 
                       (data.summary.sync['sync.failure']?.sum || 1)) * 100).toFixed(1)}%
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
                {/* Quota Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {/* Reads */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm text-muted-foreground mb-1">Reads</p>
                    <p className={`text-2xl font-bold mb-1 ${
                      quotaData.quota.reads.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.reads.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.reads.percentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {quotaData.quota.reads.used.toLocaleString()} / {quotaData.quota.reads.limit.toLocaleString()}
                    </p>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          quotaData.quota.reads.percentage > 80 ? 'bg-red-600' :
                          quotaData.quota.reads.percentage > 60 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(quotaData.quota.reads.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Writes */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm text-muted-foreground mb-1">Writes</p>
                    <p className={`text-2xl font-bold mb-1 ${
                      quotaData.quota.writes.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.writes.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.writes.percentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {quotaData.quota.writes.used.toLocaleString()} / {quotaData.quota.writes.limit.toLocaleString()}
                    </p>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          quotaData.quota.writes.percentage > 80 ? 'bg-red-600' :
                          quotaData.quota.writes.percentage > 60 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(quotaData.quota.writes.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Deletes */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm text-muted-foreground mb-1">Deletes</p>
                    <p className={`text-2xl font-bold mb-1 ${
                      quotaData.quota.deletes.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.deletes.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.deletes.percentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {quotaData.quota.deletes.used.toLocaleString()} / {quotaData.quota.deletes.limit.toLocaleString()}
                    </p>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          quotaData.quota.deletes.percentage > 80 ? 'bg-red-600' :
                          quotaData.quota.deletes.percentage > 60 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(quotaData.quota.deletes.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Storage */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm text-muted-foreground mb-1">Storage</p>
                    <p className={`text-2xl font-bold mb-1 ${
                      quotaData.quota.storage.percentage > 80 ? 'text-red-600 dark:text-red-400' :
                      quotaData.quota.storage.percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {quotaData.quota.storage.percentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {quotaData.quota.storage.used}{quotaData.quota.storage.unit} / {quotaData.quota.storage.limit}{quotaData.quota.storage.unit}
                    </p>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
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
  );
}