'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/client';

interface WaitlistEntry {
  id: string;
  email: string;
  joinedAt: string | null;
  linkedUid: string | null;
  discountGranted: boolean;
}

interface WaitlistData {
  count: number;
  entries: WaitlistEntry[];
}

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

interface UserStatsData {
  userId: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  xp: {
    total: number;
    level: number;
    xpGainedToday: number;
    lastXPDate: string | null;
    weeklyXP: number;
    monthlyXP: number;
  };
  streak: {
    current: number;
    best: number;
    freezesRemaining: number;
    lastActivityDate: string | null;
    isActiveToday: boolean;
    brokenAt: string | null;
  };
  sessions: {
    total: number;
    today: number;
    week: number;
    month: number;
    totalItemsReviewed: number;
    averageAccuracy: number;
    totalStudyTimeMinutes: number;
  };
  leaderboard: {
    weeklyXP: number;
    monthlyXP: number;
    allTimeXP: number;
    weeklyRank: number | null;
    monthlyRank: number | null;
    allTimeRank: number | null;
  } | null;
  achievements: {
    total: number;
    unlocked: number;
    locked: number;
    recentUnlocked: any[];
  };
  subscription: {
    status: string;
    tier: string;
    plan: string | null;
  };
  metadata: {
    createdAt: string;
    lastSignIn: string;
    schemaVersion: string;
    lastUpdated: string | null;
  };
}

interface UserEntitlementsData {
  userId: string;
  tier: string;
  status: string;
  usage: {
    byDate: Record<string, {
      features: Record<string, number>;
      updatedAt: string | null;
      hasOldSchema: boolean;
      isToday: boolean;
      isThisMonth: boolean;
    }>;
    totals: {
      today: Record<string, number>;
      month: Record<string, number>;
      allTime: Record<string, number>;
    };
    totalDates: number;
  };
  schemaIssues: Array<{ date: string; type: string }>;
}

interface UserContentData {
  userId: string;
  anki: {
    deckCount: number;
    totalCards: number;
    decks: Array<{
      id: string;
      name: string;
      cardCount: number;
      createdAt: any;
      lastModified: any;
    }>;
    metadata: any;
  };
  lists: {
    count: number;
    totalItems: number;
    lists: Array<{
      id: string;
      name: string;
      itemCount: number;
      createdAt: any;
      lastModified: any;
    }>;
  };
  subcollections: Array<{
    name: string;
    documentCount: number;
    sampleDocs: string[];
  }>;
}

interface UserPromotionsData {
  userId: string;
  email: string | undefined;
  waitlist: {
    onWaitlist: boolean;
    linkedUid?: string | null;
    discountGranted?: boolean;
    joinedAt?: string | null;
  } | null;
  discount: {
    eligible: boolean;
    promotionCodeId?: string | null;
    source?: string | null;
    redeemed?: boolean;
    redeemedAt?: string | null;
    status: string;
  } | null;
}

export default function UserLookupPage() {
  const { strings } = useI18n();
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStatsData, setUserStatsData] = useState<UserStatsData | null>(null);
  const [userEntitlementsData, setUserEntitlementsData] = useState<UserEntitlementsData | null>(null);
  const [userContentData, setUserContentData] = useState<UserContentData | null>(null);
  const [userPromotionsData, setUserPromotionsData] = useState<UserPromotionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [entitlementsError, setEntitlementsError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [promotionsError, setPromotionsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'xpstreak' | 'sessions' | 'activity' | 'entitlements' | 'content' | 'promotions' | 'raw'>('profile');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Waitlist data
  const [waitlistData, setWaitlistData] = useState<WaitlistData | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  // Analytics data
  const [landingPageViews, setLandingPageViews] = useState<number>(0);
  const [landingUniqueVisitors, setLandingUniqueVisitors] = useState<number>(0);
  const [waitlistPageViews, setWaitlistPageViews] = useState<number>(0);
  const [waitlistUniqueVisitors, setWaitlistUniqueVisitors] = useState<number>(0);
  const [totalPageViews, setTotalPageViews] = useState<number>(0);
  const [totalUniqueVisitors, setTotalUniqueVisitors] = useState<number>(0);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorsError, setVisitorsError] = useState<string | null>(null);

  // Fetch waitlist data on mount
  useEffect(() => {
    const fetchWaitlist = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setWaitlistLoading(false);
          return;
        }

        const response = await fetch('/api/admin/waitlist', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch waitlist');
        }

        const result = await response.json();
        setWaitlistData({ count: result.count, entries: result.entries });
      } catch (err) {
        setWaitlistError(err instanceof Error ? err.message : 'Failed to load waitlist');
      } finally {
        setWaitlistLoading(false);
      }
    };

    if (user) {
      fetchWaitlist();
    }
  }, [user]);

  // Fetch analytics data on mount
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setVisitorsLoading(false);
          return;
        }

        // Fetch visitor counts from Firestore
        const response = await fetch('/api/admin/analytics/visitors', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const result = await response.json();

        if (result.error) {
          setVisitorsError(result.message || result.error);
        } else {
          setLandingPageViews(result.landing?.pageViews || 0);
          setLandingUniqueVisitors(result.landing?.uniqueVisitors || 0);
          setWaitlistPageViews(result.waitlist?.pageViews || 0);
          setWaitlistUniqueVisitors(result.waitlist?.uniqueVisitors || 0);
          setTotalPageViews(result.totals?.pageViews || 0);
          setTotalUniqueVisitors(result.totals?.uniqueVisitors || 0);
        }
      } catch (err) {
        setVisitorsError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setVisitorsLoading(false);
      }
    };

    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchUserStats = async (userId: string) => {
    setStatsLoading(true);
    setStatsError(null);
    setUserStatsData(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user stats');
      }

      const result = await response.json();
      setUserStatsData(result.data);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUserEntitlements = async (userId: string) => {
    setEntitlementsLoading(true);
    setEntitlementsError(null);
    setUserEntitlementsData(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/entitlements`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch entitlements data');
      }

      const result = await response.json();
      setUserEntitlementsData(result.data);
    } catch (err) {
      setEntitlementsError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setEntitlementsLoading(false);
    }
  };

  const fetchUserContent = async (userId: string) => {
    setContentLoading(true);
    setContentError(null);
    setUserContentData(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/content`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user content');
      }

      const result = await response.json();
      setUserContentData(result.data);
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setContentLoading(false);
    }
  };

  const fetchUserPromotions = async (userId: string) => {
    setPromotionsLoading(true);
    setPromotionsError(null);
    setUserPromotionsData(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/promotions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch promotions data');
      }

      const result = await response.json();
      setUserPromotionsData(result.data);
    } catch (err) {
      setPromotionsError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setPromotionsLoading(false);
    }
  };

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
    setUserStatsData(null);
    setUserEntitlementsData(null);
    setUserContentData(null);
    setUserPromotionsData(null);

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

      // Fetch all additional data
      const userId = result.data.userId;
      await Promise.all([
        fetchUserStats(userId),
        fetchUserEntitlements(userId),
        fetchUserContent(userId),
        fetchUserPromotions(userId)
      ]);
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

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Total Page Views Card */}
        <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-2xl">
              📊
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Metrics</p>
              {visitorsLoading ? (
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
              ) : visitorsError ? (
                <p className="text-red-500 text-xs">{visitorsError}</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPageViews} <span className="text-sm font-normal text-gray-500">views</span></p>
                  <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">{totalUniqueVisitors} <span className="text-xs font-normal text-gray-500">unique</span></p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Landing Page Card */}
        <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl">
              🏠
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Landing Page</p>
              {visitorsLoading ? (
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
              ) : visitorsError ? (
                <p className="text-red-500 text-xs">{visitorsError}</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{landingPageViews} <span className="text-sm font-normal text-gray-500">views</span></p>
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{landingUniqueVisitors} <span className="text-xs font-normal text-gray-500">unique</span></p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Waitlist Page Card */}
        <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl">
              👁️
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Waitlist Page</p>
              {visitorsLoading ? (
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
              ) : visitorsError ? (
                <p className="text-red-500 text-xs">{visitorsError}</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{waitlistPageViews} <span className="text-sm font-normal text-gray-500">views</span></p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">{waitlistUniqueVisitors} <span className="text-xs font-normal text-gray-500">unique</span></p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Waitlist Signups Card */}
        <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-japanese-sakura to-primary-500 flex items-center justify-center text-white text-2xl">
              📋
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Waitlist Signups</p>
              {waitlistLoading ? (
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
              ) : waitlistError ? (
                <p className="text-red-500 text-sm">Error</p>
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{waitlistData?.count || 0}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {waitlistData?.count && waitlistUniqueVisitors ?
                      `${((waitlistData.count / waitlistUniqueVisitors) * 100).toFixed(1)}% conversion` :
                      'All time'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Waitlist Emails Card */}
        <div className="lg:col-span-4 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              📧 Waitlist Emails
            </h3>
            {waitlistData && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {waitlistData.count} total
              </span>
            )}
          </div>

          {waitlistLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
              ))}
            </div>
          ) : waitlistError ? (
            <p className="text-red-500 text-sm">❌ {waitlistError}</p>
          ) : waitlistData?.entries.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No waitlist entries yet</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-hide">
              {waitlistData?.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {entry.email}
                    </span>
                    {entry.linkedUid && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                        linked
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                    {entry.joinedAt
                      ? new Date(entry.joinedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          )}
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
                { id: 'xpstreak', label: '🔥 XP & Streak', icon: '🔥' },
                { id: 'entitlements', label: '💳 Entitlements', icon: '💳' },
                { id: 'content', label: '🗂️ User Content', icon: '🗂️' },
                { id: 'promotions', label: '🎟️ Promotions', icon: '🎟️' },
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

              {/* XP & Streak Tab */}
              {activeTab === 'xpstreak' && (
                <div className="space-y-4">
                  {statsLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {statsError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-800 dark:text-red-200 text-sm">❌ {statsError}</p>
                    </div>
                  )}

                  {userStatsData && !statsLoading && (
                    <>
                      {/* XP Information */}
                      <DataSection
                        title="⭐ XP & Level"
                        data={{
                          'Total XP': userStatsData.xp.total,
                          'Current Level': userStatsData.xp.level,
                          'XP Gained Today': userStatsData.xp.xpGainedToday,
                          'Last XP Date': userStatsData.xp.lastXPDate || 'N/A',
                          'Weekly XP': userStatsData.xp.weeklyXP,
                          'Monthly XP': userStatsData.xp.monthlyXP
                        }}
                      />

                      {/* Streak Information */}
                      <DataSection
                        title="🔥 Streak"
                        data={{
                          'Current Streak': `${userStatsData.streak.current} days`,
                          'Best Streak': `${userStatsData.streak.best} days`,
                          'Streak Freezes Remaining': userStatsData.streak.freezesRemaining,
                          'Last Activity Date': userStatsData.streak.lastActivityDate || 'N/A',
                          'Is Active Today': userStatsData.streak.isActiveToday ? 'Yes' : 'No',
                          'Broken At': userStatsData.streak.brokenAt || 'N/A'
                        }}
                      />

                      {/* Session Statistics */}
                      <DataSection
                        title="📊 Sessions & Study Time"
                        data={{
                          'Total Sessions': userStatsData.sessions.total,
                          'Today Sessions': userStatsData.sessions.today,
                          'Week Sessions': userStatsData.sessions.week,
                          'Month Sessions': userStatsData.sessions.month,
                          'Total Items Reviewed': userStatsData.sessions.totalItemsReviewed,
                          'Average Accuracy': userStatsData.sessions.averageAccuracy ? `${(userStatsData.sessions.averageAccuracy * 100).toFixed(1)}%` : 'N/A',
                          'Total Study Time': `${userStatsData.sessions.totalStudyTimeMinutes} minutes`
                        }}
                      />

                      {/* Leaderboard Data */}
                      {userStatsData.leaderboard && (
                        <DataSection
                          title="🏆 Leaderboard"
                          data={{
                            'Weekly XP': userStatsData.leaderboard.weeklyXP,
                            'Weekly Rank': userStatsData.leaderboard.weeklyRank ? `#${userStatsData.leaderboard.weeklyRank}` : 'N/A',
                            'Monthly XP': userStatsData.leaderboard.monthlyXP,
                            'Monthly Rank': userStatsData.leaderboard.monthlyRank ? `#${userStatsData.leaderboard.monthlyRank}` : 'N/A',
                            'All-Time XP': userStatsData.leaderboard.allTimeXP,
                            'All-Time Rank': userStatsData.leaderboard.allTimeRank ? `#${userStatsData.leaderboard.allTimeRank}` : 'N/A'
                          }}
                        />
                      )}

                      {/* Achievements */}
                      <DataSection
                        title="🏅 Achievements"
                        data={{
                          'Total Achievements': userStatsData.achievements.total,
                          'Unlocked': userStatsData.achievements.unlocked,
                          'Locked': userStatsData.achievements.locked,
                          'Completion Rate': userStatsData.achievements.total > 0 ? `${((userStatsData.achievements.unlocked / userStatsData.achievements.total) * 100).toFixed(1)}%` : 'N/A'
                        }}
                      />

                      {userStatsData.achievements.recentUnlocked.length > 0 && (
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Achievements Unlocked</h4>
                          <div className="space-y-2">
                            {userStatsData.achievements.recentUnlocked.map((achievement: any) => (
                              <div key={achievement.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
                                <span className="text-sm text-gray-900 dark:text-white">🏅 {achievement.name || achievement.id}</span>
                                {achievement.unlockedAt && (
                                  <span className="text-xs text-gray-500">{formatFirebaseTimestamp(achievement.unlockedAt)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Subscription */}
                      <DataSection
                        title="💳 Subscription"
                        data={{
                          'Status': userStatsData.subscription.status,
                          'Tier': userStatsData.subscription.tier,
                          'Plan': userStatsData.subscription.plan || 'N/A'
                        }}
                      />

                      {/* Metadata */}
                      <DataSection
                        title="📝 Metadata"
                        data={{
                          'Account Created': userStatsData.metadata.createdAt,
                          'Last Sign In': userStatsData.metadata.lastSignIn,
                          'Schema Version': userStatsData.metadata.schemaVersion,
                          'Last Stats Update': userStatsData.metadata.lastUpdated || 'N/A'
                        }}
                      />
                    </>
                  )}

                  {!userStatsData && !statsLoading && !statsError && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Search for a user to view their XP & Streak data</p>
                  )}
                </div>
              )}

              {/* Entitlements Tab */}
              {activeTab === 'entitlements' && (
                <div className="space-y-4">
                  {entitlementsLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {entitlementsError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-800 dark:text-red-200 text-sm">❌ {entitlementsError}</p>
                    </div>
                  )}

                  {userEntitlementsData && !entitlementsLoading && (
                    <>
                      <DataSection
                        title="💳 Subscription Tier"
                        data={{
                          'Tier': userEntitlementsData.tier,
                          'Status': userEntitlementsData.status,
                          'Total Usage Dates': userEntitlementsData.usage.totalDates
                        }}
                      />

                      {userEntitlementsData.schemaIssues.length > 0 && (
                        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                          <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">⚠️ Schema Issues Detected</h4>
                          <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            Found {userEntitlementsData.schemaIssues.length} documents using old schema
                          </p>
                        </div>
                      )}

                      <DataSection
                        title="📊 Today's Usage"
                        data={Object.keys(userEntitlementsData.usage.totals.today).length > 0
                          ? userEntitlementsData.usage.totals.today
                          : { 'No usage today': 'N/A' }}
                      />

                      <DataSection
                        title="📅 This Month's Usage"
                        data={Object.keys(userEntitlementsData.usage.totals.month).length > 0
                          ? userEntitlementsData.usage.totals.month
                          : { 'No usage this month': 'N/A' }}
                      />

                      <DataSection
                        title="🔢 All-Time Usage"
                        data={Object.keys(userEntitlementsData.usage.totals.allTime).length > 0
                          ? userEntitlementsData.usage.totals.allTime
                          : { 'No usage recorded': 'N/A' }}
                      />

                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Usage by Date</h4>
                        <div className="space-y-3">
                          {Object.entries(userEntitlementsData.usage.byDate).map(([date, usage]) => (
                            <details key={date} className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                              <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                                {date} {usage.isToday && '(Today)'} {usage.isThisMonth && '(This Month)'} {usage.hasOldSchema && '⚠️'}
                              </summary>
                              <div className="mt-2 space-y-1">
                                {Object.entries(usage.features).map(([feature, count]) => (
                                  <div key={feature} className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                                    <span className="text-gray-900 dark:text-white font-medium">{count}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!userEntitlementsData && !entitlementsLoading && !entitlementsError && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Search for a user to view their entitlements data</p>
                  )}
                </div>
              )}

              {/* User Content Tab */}
              {activeTab === 'content' && (
                <div className="space-y-4">
                  {contentLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {contentError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-800 dark:text-red-200 text-sm">❌ {contentError}</p>
                    </div>
                  )}

                  {userContentData && !contentLoading && (
                    <>
                      <DataSection
                        title="📚 Anki Decks"
                        data={{
                          'Total Decks': userContentData.anki.deckCount,
                          'Total Cards': userContentData.anki.totalCards
                        }}
                      />

                      {userContentData.anki.decks.length > 0 && (
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Anki Decks Details</h4>
                          <div className="space-y-2">
                            {userContentData.anki.decks.map((deck) => (
                              <div key={deck.id} className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{deck.name}</p>
                                    <p className="text-xs text-gray-500">{deck.cardCount} cards</p>
                                  </div>
                                  <span className="text-xs text-gray-400">{deck.id}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <DataSection
                        title="📝 Custom Lists"
                        data={{
                          'Total Lists': userContentData.lists.count,
                          'Total Items': userContentData.lists.totalItems
                        }}
                      />

                      {userContentData.lists.lists.length > 0 && (
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Lists Details</h4>
                          <div className="space-y-2">
                            {userContentData.lists.lists.map((list) => (
                              <div key={list.id} className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{list.name}</p>
                                    <p className="text-xs text-gray-500">{list.itemCount} items</p>
                                  </div>
                                  <span className="text-xs text-gray-400">{list.id}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">User Subcollections</h4>
                        <div className="space-y-2">
                          {userContentData.subcollections.map((subcol) => (
                            <div key={subcol.name} className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                              <div className="flex justify-between items-center">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{subcol.name}</p>
                                <span className="text-xs text-gray-500">{subcol.documentCount} docs</span>
                              </div>
                              {subcol.sampleDocs.length > 0 && (
                                <p className="text-xs text-gray-400 mt-1">Sample: {subcol.sampleDocs.join(', ')}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!userContentData && !contentLoading && !contentError && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Search for a user to view their content data</p>
                  )}
                </div>
              )}

              {/* Promotions Tab */}
              {activeTab === 'promotions' && (
                <div className="space-y-4">
                  {promotionsLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {promotionsError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-800 dark:text-red-200 text-sm">❌ {promotionsError}</p>
                    </div>
                  )}

                  {userPromotionsData && !promotionsLoading && (
                    <>
                      {userPromotionsData.waitlist && (
                        <DataSection
                          title="📋 Waitlist Status"
                          data={userPromotionsData.waitlist.onWaitlist ? {
                            'On Waitlist': 'Yes',
                            'Linked UID': userPromotionsData.waitlist.linkedUid || 'N/A',
                            'Discount Granted': userPromotionsData.waitlist.discountGranted ? 'Yes' : 'No',
                            'Joined At': userPromotionsData.waitlist.joinedAt || 'N/A'
                          } : {
                            'On Waitlist': 'No'
                          }}
                        />
                      )}

                      {userPromotionsData.discount && (
                        <>
                          <DataSection
                            title="🎟️ Discount Eligibility"
                            data={{
                              'Eligible': userPromotionsData.discount.eligible ? 'Yes' : 'No',
                              'Status': userPromotionsData.discount.status,
                              'Promotion Code ID': userPromotionsData.discount.promotionCodeId || 'N/A',
                              'Source': userPromotionsData.discount.source || 'N/A',
                              'Redeemed': userPromotionsData.discount.redeemed ? 'Yes' : 'No',
                              'Redeemed At': userPromotionsData.discount.redeemedAt || 'N/A'
                            }}
                          />

                          {userPromotionsData.discount.eligible && !userPromotionsData.discount.redeemed && (
                            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                              <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                                ✅ User is eligible for discount and has not redeemed it yet
                              </p>
                            </div>
                          )}

                          {userPromotionsData.discount.redeemed && (
                            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                              <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                                ℹ️ User has already redeemed their discount
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {!userPromotionsData && !promotionsLoading && !promotionsError && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Search for a user to view their promotions data</p>
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
                <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto scrollbar-hide">
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
