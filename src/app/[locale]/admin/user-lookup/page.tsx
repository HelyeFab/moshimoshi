'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/client';

interface UserData {
  userId: string;
  users: any;
  user_stats: any;
  leaderboard_stats: any;
  usage: any;
  drill_sessions: any[];
  review_sessions: any[];
  subcollections: Record<string, any[]>;
  recent_activity: any[];
  entitlement_decisions: any[];
  summary: {
    totalCollections: number;
    drillSessionsCount: number;
    reviewSessionsCount: number;
    recentActivityCount: number;
    hasUserStats: boolean;
    hasLeaderboardStats: boolean;
    accountStatus: string;
    subscription: string;
    isAdmin: boolean;
    emailVerified: boolean;
  };
}

export default function UserLookupPage() {
  const { strings } = useI18n();
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'sessions' | 'activity' | 'raw'>('profile');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      setError('Please enter a user UUID or email');
      return;
    }

    if (!user) {
      setError('You must be logged in to search user data');
      return;
    }

    setLoading(true);
    setError(null);
    setUserData(null);

    try {
      // Get Firebase ID token for authentication
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(searchInput.trim())}/data`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user data');
      }

      const result = await response.json();
      setUserData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const downloadJSON = () => {
    if (!userData) return;
    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-data-${userData.userId}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object' && value.formatted) return value.formatted;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-6"
    >
      {/* Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-transparent dark:from-primary-900/20 dark:via-primary-800/10 dark:to-transparent rounded-2xl p-6 shadow-sm">
        <div className="relative">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
            👤 User Data Lookup
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View comprehensive user data from all Firebase collections
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter user UUID or email..."
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '🔍 Searching...' : '🔍 Search'}
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p className="text-red-800 dark:text-red-200 text-sm">❌ {error}</p>
          </motion.div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* User Data Display */}
      {userData && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* User Summary Card */}
          <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                  {userData.users?.profile?.displayName?.[0]?.toUpperCase() || '👤'}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userData.users?.profile?.displayName || userData.users?.email || 'Unknown User'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{userData.userId}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{userData.users?.email}</p>
                </div>
              </div>
              <button
                onClick={downloadJSON}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                📥 Export JSON
              </button>
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(userData.summary.accountStatus)}`}>
                  {userData.summary.accountStatus}
                </span>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-gray-600 dark:text-gray-400">Subscription</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">{userData.summary.subscription}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-gray-600 dark:text-gray-400">Email Verified</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{userData.summary.emailVerified ? '✅' : '❌'}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-gray-600 dark:text-gray-400">Admin</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{userData.summary.isAdmin ? '👑 Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 overflow-hidden">
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
              {[
                { id: 'profile', label: '📋 Profile', icon: '📋' },
                { id: 'stats', label: '📊 Stats', icon: '📊' },
                { id: 'sessions', label: '🎯 Sessions', icon: '🎯' },
                { id: 'activity', label: '⚡ Activity', icon: '⚡' },
                { id: 'raw', label: '🔍 Raw Data', icon: '🔍' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <DataSection
                    title="Basic Info"
                    data={{
                      'Display Name': userData.users?.profile?.displayName,
                      'Email': userData.users?.email,
                      'Email Verified': userData.users?.emailVerified,
                      'Locale': userData.users?.locale,
                      'User State': userData.users?.userState,
                      'Is Admin': userData.users?.isAdmin,
                      'Created At': userData.users?.createdAt,
                      'Last Login At': userData.users?.lastLoginAt,
                      'Updated At': userData.users?.updatedAt
                    }}
                  />

                  {userData.users?.subscription && (
                    <DataSection
                      title="Subscription"
                      data={{
                        'Plan': userData.users.subscription.plan,
                        'Status': userData.users.subscription.status,
                        'Stripe Customer ID': userData.users.subscription.stripeCustomerId,
                        'Stripe Subscription ID': userData.users.subscription.stripeSubscriptionId,
                        'Current Period End': userData.users.subscription.currentPeriodEnd,
                        'Cancel At Period End': userData.users.subscription.cancelAtPeriodEnd
                      }}
                    />
                  )}

                  {userData.users?.preferences && (
                    <DataSection
                      title="Preferences"
                      data={userData.users.preferences}
                    />
                  )}
                </div>
              )}

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="space-y-4">
                  {userData.user_stats && (
                    <>
                      <DataSection
                        title="XP & Levels"
                        data={{
                          'Total XP': userData.user_stats.xp?.total,
                          'Level': userData.user_stats.xp?.level,
                          'Level Title': userData.user_stats.xp?.levelTitle,
                          'XP to Next Level': userData.user_stats.xp?.xpToNextLevel,
                          'Weekly XP': userData.user_stats.xp?.weeklyXP,
                          'Monthly XP': userData.user_stats.xp?.monthlyXP,
                          'XP Gained Today': userData.user_stats.xp?.xpGainedToday
                        }}
                      />

                      <DataSection
                        title="Streak"
                        data={{
                          'Current Streak': userData.user_stats.streak?.current,
                          'Best Streak': userData.user_stats.streak?.best,
                          'Last Activity Date': userData.user_stats.dates?.lastActivityDate,
                          'Is Active Today': userData.user_stats.dates?.isActiveToday
                        }}
                      />

                      <DataSection
                        title="Sessions"
                        data={{
                          'Total Sessions': userData.user_stats.sessions?.totalSessions,
                          'Today Sessions': userData.user_stats.sessions?.todaySessions,
                          'Week Sessions': userData.user_stats.sessions?.weekSessions,
                          'Month Sessions': userData.user_stats.sessions?.monthSessions,
                          'Total Items Reviewed': userData.user_stats.sessions?.totalItemsReviewed,
                          'Average Accuracy': userData.user_stats.sessions?.averageAccuracy,
                          'Total Study Time (min)': userData.user_stats.sessions?.totalStudyTimeMinutes
                        }}
                      />

                      <DataSection
                        title="Achievements"
                        data={{
                          'Total Points': userData.user_stats.achievements?.totalPoints,
                          'Unlocked Count': userData.user_stats.achievements?.unlockedCount,
                          'Completion %': userData.user_stats.achievements?.completionPercentage,
                          'Unlocked IDs': userData.user_stats.achievements?.unlockedIds
                        }}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && (
                <div className="space-y-4">
                  <CollectionList
                    title={`📝 Drill Sessions (${userData.drill_sessions?.length || 0})`}
                    items={userData.drill_sessions || []}
                    expanded={expandedSections['drill_sessions']}
                    onToggle={() => toggleSection('drill_sessions')}
                  />

                  <CollectionList
                    title={`📚 Review Sessions (${userData.review_sessions?.length || 0})`}
                    items={userData.review_sessions || []}
                    expanded={expandedSections['review_sessions']}
                    onToggle={() => toggleSection('review_sessions')}
                  />
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <CollectionList
                    title={`⚡ Recent Activity (${userData.recent_activity?.length || 0})`}
                    items={userData.recent_activity || []}
                    expanded={expandedSections['recent_activity']}
                    onToggle={() => toggleSection('recent_activity')}
                  />

                  {Object.entries(userData.subcollections || {}).map(([name, items]) => (
                    <CollectionList
                      key={name}
                      title={`${name} (${items.length})`}
                      items={items}
                      expanded={expandedSections[name]}
                      onToggle={() => toggleSection(name)}
                    />
                  ))}
                </div>
              )}

              {/* Raw Data Tab */}
              {activeTab === 'raw' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Raw JSON Data</h3>
                    <button
                      onClick={() => copyToClipboard(userData)}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-auto max-h-[600px] text-xs scrollbar-hide">
                    {JSON.stringify(userData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Helper Components
// Helper function to format Firebase timestamps
function formatFirebaseTimestamp(value: any): string {
  if (!value) return 'N/A';

  // Check if it's a Firebase timestamp
  if (typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
    const date = new Date(value._seconds * 1000);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  // Check if it's an ISO string
  if (typeof value === 'string' && value.includes('T')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(date);
      }
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function DataSection({ title, data }: { title: string; data: any }) {
  return (
    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(data).map(([key, value]) => {
          let displayValue: string;

          if (value === null || value === undefined) {
            displayValue = 'N/A';
          } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
          } else if (typeof value === 'object' && '_seconds' in value) {
            displayValue = formatFirebaseTimestamp(value);
          } else if (typeof value === 'object') {
            displayValue = JSON.stringify(value);
          } else {
            displayValue = String(value);
          }

          return (
            <div key={key}>
              <p className="text-xs text-gray-500 dark:text-gray-400">{key}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                {displayValue}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CollectionList({ title, items, expanded, onToggle }: {
  title: string;
  items: any[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
        <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="p-4 space-y-2 max-h-96 overflow-auto scrollbar-hide">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No items</p>
          ) : (
            items.map((item, idx) => (
              <details key={idx} className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                  Item {idx + 1} {item.id ? `(${item.id})` : ''}
                </summary>
                <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}
