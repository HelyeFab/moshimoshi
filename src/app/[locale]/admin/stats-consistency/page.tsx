'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, TrendingUp, Users, Activity } from 'lucide-react';

interface StatisticalAnalysis {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  outlierThreshold: {
    lower: number;
    upper: number;
  };
}

interface Outlier {
  userId: string;
  email?: string;
  value: number;
}

interface SuspiciousPattern {
  userId: string;
  email?: string;
  xpTotal: number;
  level: number;
  achievementsCount: number;
  totalSessions: number;
  reason: string;
}

interface ConsistencyData {
  summary: {
    totalUsers: number;
    healthyUsers: number;
    unhealthyUsers: number;
    suspiciousPatterns: number;
    totalOutliers: number;
  };
  statistics: {
    xpTotal: StatisticalAnalysis;
    currentStreak: StatisticalAnalysis;
    bestStreak: StatisticalAnalysis;
    achievementsCount: StatisticalAnalysis;
    totalSessions: StatisticalAnalysis;
  };
  outliers: {
    xpTotal: Outlier[];
    currentStreak: Outlier[];
    bestStreak: Outlier[];
    achievementsCount: Outlier[];
    totalSessions: Outlier[];
  };
  unhealthyUsers: Array<{
    userId: string;
    email?: string;
    dataHealth: string;
  }>;
  suspiciousPatterns: SuspiciousPattern[];
}

export default function StatsConsistencyPage() {
  const [data, setData] = useState<ConsistencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<keyof ConsistencyData['outliers']>('xpTotal');

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/stats-consistency');
      if (!response.ok) {
        throw new Error('Failed to fetch stats consistency data');
      }

      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  const getHealthColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const metricLabels = {
    xpTotal: 'Total XP',
    currentStreak: 'Current Streak',
    bestStreak: 'Best Streak',
    achievementsCount: 'Achievements',
    totalSessions: 'Total Sessions'
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6 border-red-500 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const healthPercentage = (data.summary.healthyUsers / data.summary.totalUsers) * 100;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Stats Consistency Checker</h1>
          <p className="text-muted-foreground">Analyze user statistics for outliers and inconsistencies</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <p className="text-2xl font-bold">{data.summary.totalUsers}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-sm text-muted-foreground">Healthy</p>
          </div>
          <p className={`text-2xl font-bold ${getHealthColor(healthPercentage)}`}>
            {data.summary.healthyUsers}
          </p>
          <p className="text-xs text-muted-foreground">{formatNumber(healthPercentage, 1)}%</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <p className="text-sm text-muted-foreground">Unhealthy</p>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {data.summary.unhealthyUsers}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-muted-foreground">Outliers</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {data.summary.totalOutliers}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-muted-foreground">Suspicious</p>
          </div>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {data.summary.suspiciousPatterns}
          </p>
        </Card>
      </div>

      {/* Statistical Overview */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Statistical Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-2">Metric</th>
                <th className="text-right p-2">Mean</th>
                <th className="text-right p-2">Median</th>
                <th className="text-right p-2">Std Dev</th>
                <th className="text-right p-2">Min</th>
                <th className="text-right p-2">Max</th>
                <th className="text-right p-2">Outliers</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.statistics).map(([key, stats]) => (
                <tr key={key} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-2 font-medium">{metricLabels[key as keyof typeof metricLabels]}</td>
                  <td className="text-right p-2">{formatNumber(stats.mean)}</td>
                  <td className="text-right p-2">{formatNumber(stats.median)}</td>
                  <td className="text-right p-2">{formatNumber(stats.stdDev)}</td>
                  <td className="text-right p-2">{formatNumber(stats.min, 0)}</td>
                  <td className="text-right p-2">{formatNumber(stats.max, 0)}</td>
                  <td className="text-right p-2">
                    <span className={`font-semibold ${
                      data.outliers[key as keyof typeof data.outliers].length > 0
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {data.outliers[key as keyof typeof data.outliers].length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Outliers Detail */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Outliers Analysis</h2>

        {/* Metric Selector */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.keys(metricLabels).map((metric) => (
            <Button
              key={metric}
              variant={selectedMetric === metric ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMetric(metric as keyof ConsistencyData['outliers'])}
            >
              {metricLabels[metric as keyof typeof metricLabels]}
              {data.outliers[metric as keyof typeof data.outliers].length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                  {data.outliers[metric as keyof typeof data.outliers].length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Outlier List */}
        {data.outliers[selectedMetric].length > 0 ? (
          <div className="space-y-2">
            {data.outliers[selectedMetric].map((outlier, index) => (
              <div
                key={outlier.userId}
                className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
              >
                <div>
                  <p className="font-medium text-sm">{outlier.email || outlier.userId}</p>
                  <p className="text-xs text-muted-foreground">{outlier.userId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-yellow-700 dark:text-yellow-300">
                    {formatNumber(outlier.value, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {outlier.value > data.statistics[selectedMetric].outlierThreshold.upper ? 'Above' : 'Below'} threshold
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>No outliers detected for {metricLabels[selectedMetric]}</p>
          </div>
        )}
      </Card>

      {/* Suspicious Patterns */}
      {data.suspiciousPatterns.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Suspicious Patterns Detected
          </h2>
          <div className="space-y-2">
            {data.suspiciousPatterns.map((pattern) => (
              <div
                key={pattern.userId}
                className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{pattern.email || pattern.userId}</p>
                    <p className="text-xs text-muted-foreground">{pattern.userId}</p>
                  </div>
                  <span className="px-2 py-1 text-xs bg-orange-600 text-white rounded-full">
                    {pattern.reason}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">XP</p>
                    <p className="font-semibold">{formatNumber(pattern.xpTotal, 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Level</p>
                    <p className="font-semibold">{pattern.level}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Achievements</p>
                    <p className="font-semibold">{pattern.achievementsCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Sessions</p>
                    <p className="font-semibold">{pattern.totalSessions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Unhealthy Data */}
      {data.unhealthyUsers.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            Users with Unhealthy Data
          </h2>
          <div className="space-y-2">
            {data.unhealthyUsers.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              >
                <div>
                  <p className="font-medium text-sm">{user.email || user.userId}</p>
                  <p className="text-xs text-muted-foreground">{user.userId}</p>
                </div>
                <span className="px-3 py-1 text-xs bg-red-600 text-white rounded-full uppercase">
                  {user.dataHealth}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
