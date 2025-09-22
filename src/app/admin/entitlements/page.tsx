'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Section from '@/components/ui/Section';
import StatCard, { StatCardGrid } from '@/components/ui/StatCard';
import ConfigurationDisplay from '@/components/admin/ConfigurationDisplay';

interface UsageStats {
  feature: string;
  totalUsage: number;
  uniqueUsers: number;
  deniedRequests: number;
  allowedRequests: number;
  averageUsagePerUser: number;
}

interface PlanDistribution {
  plan: string;
  userCount: number;
  percentage: number;
  color: string;
}

interface FeatureConfig {
  id: string;
  name: string;
  category: string;
  limitType: string;
  description: string;
  metadata?: any;
}

interface ConfigData {
  version: number;
  lastUpdated: string;
  plans: Record<string, any>;
  features: FeatureConfig[];
  limits: Record<string, any>;
  metadata: any;
}

export default function EntitlementsDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats[]>([]);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [configData, setConfigData] = useState<ConfigData | null>(null);
  const [codeData, setCodeData] = useState<any>(null);

  useEffect(() => {
    // Add a small delay to ensure Firebase auth is ready
    console.log('EntitlementsPage: User state changed:', user);
    const timer = setTimeout(() => {
      if (user) {
        console.log('EntitlementsPage: Fetching data for user:', user.email);
        fetchDashboardData();
        fetchConfigData();
        fetchCodeData();
      } else {
        console.log('EntitlementsPage: No user, skipping data fetch');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [user]);

  const fetchConfigData = async () => {
    try {
      // Just fetch - session is handled via cookies
      const response = await fetch('/api/admin/entitlements/config', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setConfigData(data);
      } else {
        console.error('Failed to fetch configuration data:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error fetching configuration:', error);
    }
  };

  const fetchCodeData = async () => {
    try {
      const response = await fetch('/api/admin/entitlements/types', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setCodeData(data);
      } else {
        console.error('Failed to fetch TypeScript types:', response.status);
      }
    } catch (error) {
      console.error('Error fetching TypeScript types:', error);
    }
  };

  const handleGenerateTypes = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/admin/entitlements/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok) {
        showToast(
          `${result.message}. The TypeScript types have been regenerated successfully! Configuration will refresh automatically.`,
          'success',
          5000
        );
        // Refresh configuration data
        setTimeout(() => {
          fetchConfigData();
          fetchCodeData();
          fetchDashboardData();
        }, 1500);
      } else {
        showToast(
          `Failed to generate types: ${result.error || 'Unknown error'}`,
          'error',
          6000
        );
        console.error('Generation error details:', result.details);
      }
    } catch (error) {
      console.error('Failed to generate types:', error);
      showToast(
        'Failed to connect to the generation API. Please check the console for details.',
        'error',
        6000
      );
    } finally {
      setGenerating(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch real usage data from Firebase (session handled via cookies)
      const [usersResponse, decisionsResponse] = await Promise.all([
        fetch('/api/admin/stats', { credentials: 'include' }),
        fetch('/api/admin/decision-logs', { credentials: 'include' })
      ]);

      if (usersResponse.ok) {
        const data = await usersResponse.json();
        console.log('Stats API response:', data);
        // Use the direct premium and free user counts from the API
        const totalUsers = data.totalUsers || 0;
        const premiumUsers = data.premiumUsers || 0;
        const freeUsers = data.freeUsers || 0;

        setPlanDistribution([
          { plan: 'Free', userCount: freeUsers, percentage: totalUsers > 0 ? Math.round((freeUsers / totalUsers) * 100) : 0, color: 'bg-green-500' },
          { plan: 'Premium', userCount: premiumUsers, percentage: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0, color: 'bg-purple-500' }
        ]);
      } else {
        console.error('Stats API error:', usersResponse.status, await usersResponse.text());
      }

      if (decisionsResponse.ok) {
        const decisions = await decisionsResponse.json();
        console.log('Decision logs API response:', decisions);
        // Process decision logs to get feature usage stats
        const featureStats: { [key: string]: UsageStats } = {};

        decisions.logs?.forEach((log: any) => {
          if (!log.feature) return;

          if (!featureStats[log.feature]) {
            featureStats[log.feature] = {
              feature: log.feature,
              totalUsage: 0,
              uniqueUsers: 0,
              deniedRequests: 0,
              allowedRequests: 0,
              averageUsagePerUser: 0
            };
          }

          featureStats[log.feature].totalUsage++;
          if (log.decision === 'allowed') {
            featureStats[log.feature].allowedRequests++;
          } else {
            featureStats[log.feature].deniedRequests++;
          }
        });

        setStats(Object.values(featureStats));
        setRecentDecisions(decisions.logs?.slice(0, 5) || []);
      } else {
        console.error('Decision logs API error:', decisionsResponse.status, await decisionsResponse.text());
        // Set empty data if API fails
        setStats([]);
        setRecentDecisions([]);
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalUsers = planDistribution.reduce((sum, p) => sum + p.userCount, 0);
  const totalUsage = stats.reduce((sum, s) => sum + s.totalUsage, 0);
  const totalDenied = stats.reduce((sum, s) => sum + s.deniedRequests, 0);

  // Check if user is admin
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Please sign in to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading entitlements dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Entitlements Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Monitor usage limits and subscription metrics
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link
            href="/admin/decision-explorer"
            className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-primary-500 text-white text-sm sm:text-base rounded-lg hover:bg-primary-600 transition-colors text-center"
          >
            <span className="hidden sm:inline">View Decision Logs</span>
            <span className="sm:hidden">Logs</span>
          </Link>
          <button
            onClick={() => {
              fetchDashboardData();
              fetchConfigData();
            }}
            className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm sm:text-base rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <StatCardGrid columns={2} smColumns={2} mdColumns={4}>
        <StatCard
          label="Total Users"
          value={totalUsers}
          icon="👥"
        />
        <StatCard
          label="Total Usage"
          value={totalUsage}
          icon="📊"
        />
        <StatCard
          label="Denied Requests"
          value={totalDenied}
          icon="🚫"
          color="red"
        />
        <StatCard
          label="Success Rate"
          value={totalUsage > 0 ? `${((1 - totalDenied / totalUsage) * 100).toFixed(1)}%` : '100%'}
          icon="✅"
          color="green"
        />
      </StatCardGrid>

      {/* Plan Distribution */}
      <Section title="Plan Distribution">
        <div className="space-y-3 sm:space-y-4">
          {planDistribution.map((plan) => (
            <div key={plan.plan} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-full sm:w-32 text-xs sm:text-sm font-medium">{plan.plan}</div>
              <div className="flex-1">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-6 sm:h-8 overflow-hidden">
                  <div
                    className={`${plan.color} h-full flex items-center justify-center text-white text-[10px] sm:text-xs font-medium transition-all duration-500 px-2`}
                    style={{ width: `${plan.percentage || 1}%` }}
                  >
                    <span className="truncate">{plan.userCount} ({plan.percentage}%)</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Feature Usage Stats */}
      {stats.length > 0 ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {stats.map((stat) => (
          <div key={stat.feature} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2 sm:mb-3 lg:mb-4 capitalize truncate">
              {stat.feature.replace('_', ' ')} Statistics
            </h3>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Usage</span>
                <span className="text-xs sm:text-sm font-medium">{stat.totalUsage.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Unique Users</span>
                <span className="text-xs sm:text-sm font-medium">{stat.uniqueUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Avg per User</span>
                <span className="text-xs sm:text-sm font-medium">{stat.averageUsagePerUser.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
                <span className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">
                  {((stat.allowedRequests / stat.totalUsage) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Denied</span>
                <span className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                  {stat.deniedRequests}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No usage data available yet</p>
        </div>
      )}

      {/* Configuration Overview with Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <ConfigurationDisplay
          configData={configData}
          codeData={codeData}
          onRegenerateTypes={handleGenerateTypes}
          generating={generating}
        />
      </div>

    </div>
  );
}