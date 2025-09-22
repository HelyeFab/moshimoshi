'use client';

import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target, 
  Brain,
  Zap,
  Award,
  AlertCircle,
  Calendar,
  Activity
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useTheme } from '@/lib/theme/ThemeContext';
import { LoadingSkeleton, LoadingSpinner } from '@/components/ui/Loading';
import Alert from '@/components/ui/Alert';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface SessionMetrics {
  avgResponseTime: number;
  avgResponseTimeTrend: 'faster' | 'slower' | 'stable';
  accuracyByMode: {
    recognition: number;
    recall: number;
    listening: number;
  };
  confidenceCalibration: {
    overconfident: number;
    underconfident: number;
    calibrated: number;
  };
  hintUsageRate: number;
  hintImpact: number;
  scoreBreakdown: {
    baseScore: number;
    penalties: number;
    bonuses: number;
  };
  responseTimeDistribution: Array<{
    range: string;
    count: number;
  }>;
  accuracyTrend: Array<{
    date: string;
    accuracy: number;
  }>;
  performanceHeatmap: Array<{
    hour: number;
    day: string;
    performance: number;
  }>;
  sessionMetrics: {
    avgLength: number;
    completionRate: number;
    abandonmentReasons: Record<string, number>;
  };
}

const fetchSessionMetrics = async (): Promise<SessionMetrics> => {
  const response = await fetch('/api/review/stats/metrics');
  if (!response.ok) throw new Error('Failed to fetch session metrics');
  return response.json();
};

export default function SessionStats() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedMode, setSelectedMode] = useState<'all' | 'recognition' | 'recall' | 'listening'>('all');
  const { resolvedTheme } = useTheme();

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['sessionMetrics', selectedTimeRange],
    queryFn: fetchSessionMetrics,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getTrendIcon = (trend: 'faster' | 'slower' | 'stable') => {
    switch (trend) {
      case 'faster':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'slower':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const modeData = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.accuracyByMode).map(([mode, accuracy]) => ({
      mode: mode.charAt(0).toUpperCase() + mode.slice(1),
      accuracy: (accuracy * 100).toFixed(1),
      fullMark: 100,
    }));
  }, [metrics]);

  const confidenceData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Overconfident', value: metrics.confidenceCalibration.overconfident, color: '#ef4444' },
      { name: 'Well Calibrated', value: metrics.confidenceCalibration.calibrated, color: '#10b981' },
      { name: 'Underconfident', value: metrics.confidenceCalibration.underconfident, color: '#f59e0b' },
    ];
  }, [metrics]);

  const heatmapData = useMemo(() => {
    if (!metrics) return [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return hours.flatMap(hour => 
      days.map(day => {
        const dataPoint = metrics.performanceHeatmap.find(
          d => d.hour === hour && d.day === day
        );
        return {
          hour,
          day,
          value: dataPoint?.performance || 0,
        };
      })
    );
  }, [metrics]);

  // Chart colors based on theme
  const chartColors = {
    primary: resolvedTheme === 'dark' ? '#818cf8' : '#6366f1',
    secondary: resolvedTheme === 'dark' ? '#34d399' : '#10b981',
    accent: resolvedTheme === 'dark' ? '#fbbf24' : '#f59e0b',
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <LoadingSkeleton lines={3} showAvatar={false} />
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6">
        <Alert
          type="error"
          title="Failed to load statistics"
          message="Unable to fetch session statistics. Please try again later."
          showDoshi={true}
          doshiMood="sad"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Time Range Selector */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-50">Session Statistics</h2>
          <DoshiMascot size="xsmall" variant="static" />
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`min-w-[44px] min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTimeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-200 dark:hover:bg-dark-700'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-primary-600" />
            {getTrendIcon(metrics.avgResponseTimeTrend)}
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-400">Avg Response Time</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-50">
            {formatResponseTime(metrics.avgResponseTime)}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
            {metrics.avgResponseTimeTrend === 'faster' ? 'Getting faster!' : 
             metrics.avgResponseTimeTrend === 'slower' ? 'Slowing down' : 'Stable'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              {(metrics.sessionMetrics.completionRate * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-400">Completion Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-50">
            {metrics.sessionMetrics.avgLength.toFixed(0)} items
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Avg session length</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <div className="flex items-center justify-between mb-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-600">
              {(metrics.hintUsageRate * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-400">Hint Usage</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-50">
            -{metrics.hintImpact.toFixed(0)} pts
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Avg impact on score</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <div className="flex items-center justify-between mb-2">
            <Award className="w-5 h-5 text-yellow-600" />
            <Zap className="w-4 h-4 text-yellow-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-400">Score Breakdown</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-dark-50">
              {metrics.scoreBreakdown.baseScore.toFixed(0)}
            </span>
            <span className="text-sm text-red-500">
              {metrics.scoreBreakdown.penalties.toFixed(0)}
            </span>
            <span className="text-sm text-green-500">
              +{metrics.scoreBreakdown.bonuses.toFixed(0)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Base / Penalties / Bonuses</p>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-50">
            Response Time Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={metrics.responseTimeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="range" stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <YAxis stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
                  border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '0.5rem'
                }}
              />
              <Bar dataKey="count" fill={chartColors.primary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Accuracy by Mode */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-50">
            Accuracy by Review Mode
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={modeData}>
              <PolarGrid stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
              <PolarAngleAxis dataKey="mode" stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Radar
                name="Accuracy"
                dataKey="accuracy"
                stroke={chartColors.primary}
                fill={chartColors.primary}
                fillOpacity={0.6}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
                  border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '0.5rem'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Accuracy Trend */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-50">
            Accuracy Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={metrics.accuracyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="date" stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <YAxis domain={[0, 100]} stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
                  border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '0.5rem'
                }}
              />
              <Area
                type="monotone"
                dataKey="accuracy"
                stroke={chartColors.secondary}
                fill={chartColors.secondary}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Confidence Calibration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-50">
            Confidence Calibration
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={confidenceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {confidenceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
                  border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '0.5rem'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Performance Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-dark-700"
      >
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-50">
          Best Performance Time (Heatmap)
        </h3>
        <div className="grid grid-cols-8 gap-1">
          <div></div>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs text-center text-gray-600 dark:text-dark-400">
              {day}
            </div>
          ))}
          {Array.from({ length: 24 }, (_, hour) => (
            <React.Fragment key={hour}>
              <div className="text-xs text-right pr-2 text-gray-600 dark:text-dark-400">
                {hour}:00
              </div>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                const dataPoint = heatmapData.find(d => d.hour === hour && d.day === day);
                const intensity = dataPoint?.value || 0;
                return (
                  <div
                    key={`${hour}-${day}`}
                    className="aspect-square rounded cursor-pointer hover:ring-2 hover:ring-primary-400"
                    style={{
                      backgroundColor: `rgba(var(--palette-primary-500-rgb), ${intensity / 100})`,
                    }}
                    title={`${day} ${hour}:00 - Performance: ${intensity}%`}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center justify-center mt-4 gap-2">
          <span className="text-xs text-gray-600 dark:text-dark-400">Low</span>
          <div className="flex gap-1">
            {[0.2, 0.4, 0.6, 0.8, 1].map(opacity => (
              <div
                key={opacity}
                className="w-4 h-4 rounded"
                style={{ backgroundColor: `rgba(var(--palette-primary-500-rgb), ${opacity})` }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600 dark:text-dark-400">High</span>
        </div>
      </motion.div>
    </div>
  );
}