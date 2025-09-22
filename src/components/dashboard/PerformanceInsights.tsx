'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Clock,
  Target,
  Brain,
  Cpu,
  Database,
  Shield,
  Activity,
  BarChart3,
  Lightbulb,
  ChevronRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface PerformanceMetric {
  name: string;
  current: number;
  target: number;
  unit: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
}

interface ValidationInsight {
  commonTypos: Array<{
    incorrect: string;
    correct: string;
    frequency: number;
  }>;
  strictnessScore: number; // 0-1, where 1 is very strict
  falsePositiveRate: number;
  falseNegativeRate: number;
  fuzzyMatchAcceptance: number;
}

interface PerformanceInsights {
  metrics: PerformanceMetric[];
  validation: ValidationInsight;
  suggestions: Array<{
    type: 'time' | 'duration' | 'mode' | 'general';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    icon: React.ReactNode;
  }>;
  systemHealth: {
    score: number; // 0-100
    issues: string[];
  };
}

const fetchPerformanceInsights = async (): Promise<PerformanceInsights> => {
  const response = await fetch('/api/review/performance/insights');
  if (!response.ok) throw new Error('Failed to fetch performance insights');
  return response.json();
};

export default function PerformanceInsights() {
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['performanceInsights'],
    queryFn: fetchPerformanceInsights,
    refetchInterval: 60000, // Refresh every minute
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'good':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'critical':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="w-4 h-4" />;
      case 'good':
        return <Activity className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'degrading':
        return <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />;
      default:
        return <Activity className="w-3 h-3 text-gray-500" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'border-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const mockInsights: PerformanceInsights = useMemo(() => ({
    metrics: [
      {
        name: 'SRS Calculation',
        current: 0.8,
        target: 10,
        unit: 'ms',
        status: 'excellent',
        trend: 'stable'
      },
      {
        name: 'Queue Generation',
        current: 85,
        target: 100,
        unit: 'ms',
        status: 'good',
        trend: 'improving'
      },
      {
        name: 'Validation Time',
        current: 18,
        target: 20,
        unit: 'ms',
        status: 'good',
        trend: 'stable'
      },
      {
        name: 'Sync Latency',
        current: 95,
        target: 100,
        unit: 'ms',
        status: 'good',
        trend: 'improving'
      },
      {
        name: 'Session Save',
        current: 45,
        target: 50,
        unit: 'ms',
        status: 'good',
        trend: 'stable'
      },
      {
        name: 'IndexedDB Read',
        current: 12,
        target: 15,
        unit: 'ms',
        status: 'excellent',
        trend: 'stable'
      }
    ],
    validation: {
      commonTypos: [
        { incorrect: 'arigatou', correct: 'arigato', frequency: 45 },
        { incorrect: 'konnichiha', correct: 'konnichiwa', frequency: 38 },
        { incorrect: 'sayonara', correct: 'sayounara', frequency: 32 },
        { incorrect: 'sumimasen', correct: 'suimasen', frequency: 28 },
        { incorrect: 'ohayo', correct: 'ohayou', frequency: 25 }
      ],
      strictnessScore: 0.75,
      falsePositiveRate: 2.3,
      falseNegativeRate: 1.8,
      fuzzyMatchAcceptance: 78.5
    },
    suggestions: [
      {
        type: 'time',
        title: 'You perform best at 9-11 AM',
        description: 'Your accuracy is 15% higher during morning hours. Consider scheduling review sessions at this time.',
        impact: 'high',
        icon: <Clock className="w-5 h-5" />
      },
      {
        type: 'duration',
        title: 'Try shorter sessions for better retention',
        description: 'Sessions over 30 minutes show declining performance. Break them into 20-minute chunks.',
        impact: 'medium',
        icon: <BarChart3 className="w-5 h-5" />
      },
      {
        type: 'mode',
        title: 'Your recall mode needs practice',
        description: 'Recall accuracy is 20% lower than recognition. Focus on active recall exercises.',
        impact: 'high',
        icon: <Brain className="w-5 h-5" />
      },
      {
        type: 'general',
        title: 'Enable offline mode for better performance',
        description: 'You have a stable connection. Enabling offline mode can reduce latency by 30%.',
        impact: 'low',
        icon: <Database className="w-5 h-5" />
      }
    ],
    systemHealth: {
      score: 94,
      issues: []
    }
  }), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const data = insights || mockInsights;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Insights</h2>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            System Health: {data.systemHealth.score}%
          </span>
        </div>
      </div>

      {/* Performance Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-600" />
          Performance Against Targets
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.metrics.map((metric, index) => (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {metric.name}
                </h4>
                <div className="flex items-center gap-1">
                  {getTrendIcon(metric.trend)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(metric.status)}`}>
                    {getStatusIcon(metric.status)}
                    {metric.status}
                  </span>
                </div>
              </div>
              
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metric.current}
                </span>
                <span className="text-sm text-gray-500">
                  / {metric.target} {metric.unit}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className={`h-full rounded-full ${
                    metric.status === 'excellent' ? 'bg-green-500' :
                    metric.status === 'good' ? 'bg-blue-500' :
                    metric.status === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (metric.current / metric.target) * 100)}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Fuzzy Matching Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-600" />
          Validation & Fuzzy Matching Insights
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Validation Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Validation Analysis
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Strictness Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${data.validation.strictnessScore * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{(data.validation.strictnessScore * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Fuzzy Match Acceptance</span>
                <span className="text-sm font-medium text-green-600">{data.validation.fuzzyMatchAcceptance}%</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">False Positive Rate</span>
                <span className="text-sm font-medium text-yellow-600">{data.validation.falsePositiveRate}%</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">False Negative Rate</span>
                <span className="text-sm font-medium text-yellow-600">{data.validation.falseNegativeRate}%</span>
              </div>
            </div>
          </div>
          
          {/* Common Typos */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Most Common Typos Accepted
            </h4>
            <div className="space-y-2">
              {data.validation.commonTypos.map((typo, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600 line-through">{typo.incorrect}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                    <span className="text-sm text-green-600">{typo.correct}</span>
                  </div>
                  <span className="text-xs text-gray-500">{typo.frequency}x</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Optimization Suggestions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Optimization Suggestions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.suggestions.map((suggestion, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className={`border-l-4 rounded-lg p-4 ${getImpactColor(suggestion.impact)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">{suggestion.icon}</div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {suggestion.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {suggestion.description}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      suggestion.impact === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      suggestion.impact === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {suggestion.impact} impact
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* System Health Issues */}
      {data.systemHealth.issues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
              System Health Issues
            </h4>
          </div>
          <ul className="space-y-1">
            {data.systemHealth.issues.map((issue, index) => (
              <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                • {issue}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}