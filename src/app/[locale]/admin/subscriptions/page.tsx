'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { useToast } from '@/components/ui/Toast/ToastContext'
import Modal from '@/components/ui/Modal'
import Dropdown from '@/components/ui/Dropdown'
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary'

interface User {
  uid: string
  email: string
  displayName?: string
  subscription: {
    plan: 'free' | 'premium_monthly' | 'premium_yearly'
    status: string
    subscribedAt?: string
    cancelAtPeriodEnd?: boolean
    metadata?: {
      updatedBy?: string
      reason?: string
    }
  }
  createdAt?: any
  updatedAt?: any
}

interface DiscountStatus {
  hasDiscount: boolean
  eligible?: boolean
  redeemed?: boolean
  discountType?: string
  discountLabel?: string
  source?: string
  grantedAt?: string
  grantedBy?: string
  redeemedAt?: string
}

interface DiscountTypeInfo {
  id: string
  label: string
  description: string
  sources: string[]
  adminGrantable: boolean
}

// Helper to format source labels
const formatSourceLabel = (source: string) =>
  source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function AdminSubscriptionsPage() {
  const { isAdmin } = useAdmin()
  const { showToast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'premium_monthly' | 'premium_yearly'>('premium_monthly')
  const [upgradeReason, setUpgradeReason] = useState('')
  const [upgrading, setUpgrading] = useState(false)

  // Discount state
  const [discountStatus, setDiscountStatus] = useState<DiscountStatus | null>(null)
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountTypes, setDiscountTypes] = useState<DiscountTypeInfo[]>([])
  const [selectedDiscountType, setSelectedDiscountType] = useState<string>('')
  const [selectedDiscountSource, setSelectedDiscountSource] = useState<string>('')
  const [grantingDiscount, setGrantingDiscount] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
      fetchDiscountTypes()
    }
  }, [isAdmin])

  const fetchDiscountTypes = async () => {
    try {
      const response = await fetch('/api/admin/discounts?types=true')
      if (!response.ok) throw new Error('Failed to fetch discount types')
      const data = await response.json()
      setDiscountTypes(data.types)
      // Set defaults if types available
      if (data.types.length > 0) {
        setSelectedDiscountType(data.types[0].id)
        if (data.types[0].sources.length > 0) {
          setSelectedDiscountSource(data.types[0].sources[0])
        }
      }
    } catch (error) {
      console.error('Error fetching discount types:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/subscriptions/upgrade')
      if (!response.ok) throw new Error('Failed to fetch users')

      const data = await response.json()
      setUsers(data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
      showToast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchDiscountStatus = useCallback(async (uid: string) => {
    setDiscountLoading(true)
    try {
      const response = await fetch(`/api/admin/discounts?uid=${uid}`)
      if (!response.ok) throw new Error('Failed to fetch discount status')
      const data = await response.json()
      setDiscountStatus(data.status)
    } catch (error) {
      console.error('Error fetching discount status:', error)
      setDiscountStatus({ hasDiscount: false })
    } finally {
      setDiscountLoading(false)
    }
  }, [])

  const handleGrantDiscount = async () => {
    if (!selectedUser || !selectedDiscountType || !selectedDiscountSource) return

    setGrantingDiscount(true)
    try {
      const response = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.uid,
          discountType: selectedDiscountType,
          source: selectedDiscountSource,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to grant discount')
      }

      const selectedType = discountTypes.find(t => t.id === selectedDiscountType)
      showToast(`${selectedType?.label || 'Discount'} granted to ${selectedUser.email}`, 'success')
      await fetchDiscountStatus(selectedUser.uid)
    } catch (error) {
      console.error('Error granting discount:', error)
      showToast(error instanceof Error ? error.message : 'Failed to grant discount', 'error')
    } finally {
      setGrantingDiscount(false)
    }
  }

  const handleRevokeDiscount = async () => {
    if (!selectedUser) return

    setGrantingDiscount(true)
    try {
      const response = await fetch('/api/admin/discounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: selectedUser.uid }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to revoke discount')
      }

      showToast(`Discount revoked from ${selectedUser.email}`, 'success')
      await fetchDiscountStatus(selectedUser.uid)
    } catch (error) {
      console.error('Error revoking discount:', error)
      showToast(error instanceof Error ? error.message : 'Failed to revoke discount', 'error')
    } finally {
      setGrantingDiscount(false)
    }
  }

  const handleUpgradeUser = async () => {
    if (!selectedUser || !upgradeReason) {
      showToast('Please provide a reason for the change', 'error')
      return
    }

    setUpgrading(true)
    try {
      const response = await fetch('/api/admin/subscriptions/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetUserId: selectedUser.uid,
          plan: selectedPlan,
          reason: upgradeReason
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update subscription')
      }

      const result = await response.json()

      showToast(
        `Successfully updated ${selectedUser.email} from ${result.previousPlan} to ${result.newPlan}`,
        'success'
      )

      // Update the user in the local state immediately
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.uid === selectedUser.uid
            ? {
                ...user,
                subscription: {
                  ...user.subscription,
                  plan: result.newPlan
                }
              }
            : user
        )
      )

      // Also refresh users list from server
      await fetchUsers()

      // Close modal
      setUpgradeModalOpen(false)
      setSelectedUser(null)
      setUpgradeReason('')
      setSelectedPlan('premium_monthly')
    } catch (error) {
      console.error('Error upgrading user:', error)
      showToast(error instanceof Error ? error.message : 'Failed to update subscription', 'error')
    } finally {
      setUpgrading(false)
    }
  }

  // Filter users based on search and plan filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPlan = filterPlan === 'all' || user.subscription.plan === filterPlan
    return matchesSearch && matchesPlan
  })

  // Stats
  const stats = {
    total: users.length,
    free: users.filter(u => u.subscription.plan === 'free').length,
    monthly: users.filter(u => u.subscription.plan === 'premium_monthly').length,
    yearly: users.filter(u => u.subscription.plan === 'premium_yearly').length
  }

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'free':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'premium_monthly':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'premium_yearly':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'trialing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'canceled':
      case 'past_due':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading subscriptions...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminErrorBoundary componentName="Subscriptions">
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Optimized */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Subscription Management</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">Manage user subscriptions and billing</p>
      </div>

      {/* Stats - Mobile Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <div className="bg-white dark:bg-dark-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Users</div>
        </div>
        <div className="bg-white dark:bg-dark-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">{stats.free}</div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Free Tier</div>
        </div>
        <div className="bg-white dark:bg-dark-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.monthly}</div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Monthly</div>
        </div>
        <div className="bg-white dark:bg-dark-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.yearly}</div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yearly</div>
        </div>
      </div>

      {/* Filters - Mobile Responsive */}
      <div className="bg-white dark:bg-dark-900 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Dropdown
            value={filterPlan}
            onChange={(value) => setFilterPlan(value)}
            size="small"
            options={[
              { value: 'all', label: 'All Plans' },
              { value: 'free', label: 'Free' },
              { value: 'premium_monthly', label: 'Monthly' },
              { value: 'premium_yearly', label: 'Yearly' },
            ]}
          />
        </div>
      </div>

      {/* Users Table - Mobile Responsive */}
      <div className="bg-white dark:bg-dark-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Status
                </th>
                <th className="text-left px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Subscribed
                </th>
                <th className="text-left px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                    <div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        {user.displayName || 'Unknown'}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px] sm:max-w-none">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getPlanBadge(user.subscription.plan)}`}>
                      {user.subscription.plan.replace('premium_', '').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(user.subscription.status)}`}>
                      {user.subscription.status}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell">
                    <div className="text-xs sm:text-sm text-gray-900 dark:text-white">
                      {user.subscription.subscribedAt
                        ? new Date(user.subscription.subscribedAt).toLocaleDateString('en-GB')
                        : 'N/A'}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                    <button
                      onClick={() => {
                        setSelectedUser(user)
                        setSelectedPlan(user.subscription.plan === 'free' ? 'premium_monthly' : user.subscription.plan)
                        setDiscountStatus(null)
                        fetchDiscountStatus(user.uid)
                        setUpgradeModalOpen(true)
                      }}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 text-xs sm:text-sm font-medium"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          {filteredUsers.map((user) => (
            <div key={user.uid} className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {user.displayName || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(user)
                    setSelectedPlan(user.subscription.plan === 'free' ? 'premium_monthly' : user.subscription.plan)
                    setDiscountStatus(null)
                    fetchDiscountStatus(user.uid)
                    setUpgradeModalOpen(true)
                  }}
                  className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
                >
                  Manage
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPlanBadge(user.subscription.plan)}`}>
                  {user.subscription.plan.replace('premium_', '').replace('_', ' ')}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(user.subscription.status)}`}>
                  {user.subscription.status}
                </span>
              </div>
              {user.subscription.subscribedAt && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Subscribed: {new Date(user.subscription.subscribedAt).toLocaleDateString('en-GB')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Modal */}
      <Modal
        isOpen={upgradeModalOpen && !!selectedUser}
        onClose={() => {
          setUpgradeModalOpen(false)
          setSelectedUser(null)
          setUpgradeReason('')
          setDiscountStatus(null)
        }}
        title="Manage User"
        size="md"
      >
        {selectedUser && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User
                </label>
                <div className="text-sm text-gray-900 dark:text-white">
                  {selectedUser.email}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Current: {selectedUser.subscription.plan}
                </div>
              </div>

              <div>
                <Dropdown
                  label="New Plan"
                  value={selectedPlan}
                  onChange={(value) => setSelectedPlan(value as any)}
                  options={[
                    { value: 'free', label: 'Free' },
                    { value: 'premium_monthly', label: 'Premium Monthly' },
                    { value: 'premium_yearly', label: 'Premium Yearly' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Change
                </label>
                <textarea
                  value={upgradeReason}
                  onChange={(e) => setUpgradeReason(e.target.value)}
                  placeholder="e.g., Promotional upgrade, Support compensation, Testing..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>

              {selectedPlan !== 'free' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    ℹ️ User will be upgraded without payment (100% discount coupon applied)
                  </p>
                </div>
              )}

              {selectedPlan === 'free' && selectedUser.subscription.plan !== 'free' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    ⚠️ This will cancel any active Stripe subscription
                  </p>
                </div>
              )}

              {/* Discount Section Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Grant Discount
                </h3>

                {discountLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading discount status...
                  </div>
                ) : discountStatus?.hasDiscount ? (
                  <div className="space-y-3">
                    {/* Current Status */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Type:</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {discountStatus.discountLabel || discountStatus.discountType || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Status:</span>
                        {discountStatus.redeemed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Redeemed
                          </span>
                        ) : discountStatus.eligible ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Eligible (not yet used)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            Revoked
                          </span>
                        )}
                      </div>
                      {discountStatus.source && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Source: {formatSourceLabel(discountStatus.source.replace(/^(prelaunch|thankyou)_/, ''))}
                        </div>
                      )}
                      {discountStatus.grantedAt && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Granted: {new Date(discountStatus.grantedAt).toLocaleDateString('en-GB')}
                        </div>
                      )}
                      {discountStatus.redeemedAt && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Redeemed: {new Date(discountStatus.redeemedAt).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </div>

                    {/* Revoke Button (only if eligible and not redeemed) */}
                    {discountStatus.eligible && !discountStatus.redeemed && (
                      <button
                        onClick={handleRevokeDiscount}
                        disabled={grantingDiscount}
                        className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        {grantingDiscount ? 'Revoking...' : 'Revoke Discount'}
                      </button>
                    )}
                  </div>
                ) : discountTypes.length > 0 ? (
                  <div className="space-y-3">
                    {/* Discount Type Selection (if multiple types available) */}
                    {discountTypes.length > 1 && (
                      <Dropdown
                        label="Discount Type"
                        value={selectedDiscountType}
                        onChange={(value) => {
                          setSelectedDiscountType(value)
                          const type = discountTypes.find(t => t.id === value)
                          if (type && type.sources.length > 0) {
                            setSelectedDiscountSource(type.sources[0])
                          }
                        }}
                        options={discountTypes.map(t => ({ value: t.id, label: t.label }))}
                      />
                    )}

                    {/* Source/Reason Selection */}
                    {(() => {
                      const currentType = discountTypes.find(t => t.id === selectedDiscountType)
                      if (!currentType) return null
                      return (
                        <Dropdown
                          label="Reason"
                          value={selectedDiscountSource}
                          onChange={(value) => setSelectedDiscountSource(value)}
                          options={currentType.sources.map(s => ({
                            value: s,
                            label: formatSourceLabel(s)
                          }))}
                        />
                      )
                    })()}

                    <button
                      onClick={handleGrantDiscount}
                      disabled={grantingDiscount || !selectedDiscountType || !selectedDiscountSource}
                      className="w-full px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {grantingDiscount
                        ? 'Granting...'
                        : `Grant ${discountTypes.find(t => t.id === selectedDiscountType)?.label || 'Discount'}`
                      }
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Discount will be auto-applied at checkout
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No discount types available
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setUpgradeModalOpen(false)
                  setSelectedUser(null)
                  setUpgradeReason('')
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                disabled={upgrading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpgradeUser}
                className="flex-1 px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={upgrading || !upgradeReason}
              >
                {upgrading ? 'Updating...' : 'Update Subscription'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
    </AdminErrorBoundary>
  )
}