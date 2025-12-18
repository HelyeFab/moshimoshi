'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase/client'
import { motion } from 'framer-motion'
import Modal from '@/components/ui/Modal'
import type { EmailCampaign, SendCampaignRequest } from '@/lib/email/campaigns/types'

export default function EmailCampaignsPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<{ id: string; name: string } | null>(
    null
  )
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [campaignToSend, setCampaignToSend] = useState<{ id: string; name: string } | null>(null)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // Fetch campaigns on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchCampaigns()
    }
  }, [user])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        setError('Not authenticated')
        return
      }

      const response = await fetch('/api/admin/campaigns', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch campaigns')
      }

      setCampaigns(data.campaigns || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
      console.error('[EmailCampaigns] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCampaign = async (campaignData: SendCampaignRequest) => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create campaign')
      }

      // Refresh campaigns list
      await fetchCampaigns()
      setShowNewCampaignModal(false)
      setSuccessMessage('Campaign created successfully!')
      setSuccessModalOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create campaign')
      setErrorModalOpen(true)
      console.error('[EmailCampaigns] Create error:', err)
    }
  }

  const handleSendClick = (campaignId: string, campaignName: string) => {
    setCampaignToSend({ id: campaignId, name: campaignName })
    setSendModalOpen(true)
  }

  const handleSendCampaign = async () => {
    if (!campaignToSend) return

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/admin/campaigns/${campaignToSend.id}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send campaign')
      }

      setSendModalOpen(false)
      setCampaignToSend(null)
      setSuccessMessage('Campaign sending started! Check the dashboard for progress.')
      setSuccessModalOpen(true)

      // Refresh campaigns to show updated status
      await fetchCampaigns()
    } catch (err) {
      setSendModalOpen(false)
      setCampaignToSend(null)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send campaign')
      setErrorModalOpen(true)
      console.error('[EmailCampaigns] Send error:', err)
    }
  }

  const handlePreviewCampaign = async (campaignId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/admin/campaigns/${campaignId}/preview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to preview campaign')
      }

      setPreviewData(data)
      setPreviewModalOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to preview campaign')
      setErrorModalOpen(true)
      console.error('[EmailCampaigns] Preview error:', err)
    }
  }

  const handleDeleteClick = (campaignId: string, campaignName: string) => {
    setCampaignToDelete({ id: campaignId, name: campaignName })
    setDeleteModalOpen(true)
  }

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/admin/campaigns/${campaignToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete campaign')
      }

      // Close modal and reset state
      setDeleteModalOpen(false)
      setCampaignToDelete(null)
      setSuccessMessage('Campaign deleted successfully!')
      setSuccessModalOpen(true)

      // Refresh campaigns list
      await fetchCampaigns()
    } catch (err) {
      setDeleteModalOpen(false)
      setCampaignToDelete(null)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete campaign')
      setErrorModalOpen(true)
      console.error('[EmailCampaigns] Delete error:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading campaigns...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Email Campaigns
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and send bulk email campaigns to segmented users
            </p>
          </div>
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            New Campaign
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          <p className="font-medium">Error loading campaigns</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length === 0 && !error ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📧</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No campaigns yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first email campaign to get started
          </p>
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onSend={() => handleSendClick(campaign.id, campaign.name)}
              onPreview={() => handlePreviewCampaign(campaign.id)}
              onDelete={() => handleDeleteClick(campaign.id, campaign.name)}
              onRefresh={fetchCampaigns}
            />
          ))}
        </div>
      )}

      {/* New Campaign Modal */}
      {showNewCampaignModal && (
        <NewCampaignModal
          onClose={() => setShowNewCampaignModal(false)}
          onCreate={handleCreateCampaign}
        />
      )}

      {/* Delete Campaign Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Campaign"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete{' '}
            <strong>&quot;{campaignToDelete?.name}&quot;</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteCampaign}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Send Campaign Confirmation Modal */}
      <Modal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Send Campaign"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to send{' '}
            <strong>&quot;{campaignToSend?.name}&quot;</strong>?
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            This will send emails to all eligible recipients immediately.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setSendModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendCampaign}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Send Now
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Campaign Modal */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Campaign Preview"
        size="md"
      >
        {previewData && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Recipients</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {previewData.totalRecipients}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Segment</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {previewData.segment.type}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Respect Marketing Preferences
                </span>
                <span
                  className={`text-sm font-medium ${previewData.segment.respectMarketingPrefs ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {previewData.segment.respectMarketingPrefs ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Email Verified Only
                </span>
                <span
                  className={`text-sm font-medium ${previewData.segment.emailVerifiedOnly ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  {previewData.segment.emailVerifiedOnly ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">❌</div>
            <p className="text-gray-700 dark:text-gray-300">{errorMessage}</p>
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setErrorModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Success"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">✅</div>
            <p className="text-gray-700 dark:text-gray-300">{successMessage}</p>
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setSuccessModalOpen(false)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Campaign Card Component
 */
function CampaignCard({
  campaign,
  onSend,
  onPreview,
  onDelete,
  onRefresh,
}: {
  campaign: EmailCampaign
  onSend: () => void
  onPreview: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const statusColors = {
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    sending: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    sent: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {campaign.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{campaign.subject}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}
        >
          {campaign.status.toUpperCase()}
        </span>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Template</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {campaign.template}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Segment</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {campaign.segment.type}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(campaign.createdAt as any)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sent</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(campaign.sentAt as any)}
          </p>
        </div>
      </div>

      {/* Stats */}
      {campaign.stats && campaign.stats.totalRecipients > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {campaign.stats.totalRecipients}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {campaign.stats.sentCount}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Sent</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {campaign.stats.failedCount}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Failed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {campaign.stats.skippedCount}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Skipped</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPreview}
          className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          Preview Recipients
        </button>
        {campaign.status === 'draft' && (
          <>
            <button
              onClick={onSend}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
            >
              Send Now
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              Delete
            </button>
          </>
        )}
        {campaign.status === 'sending' && (
          <button
            onClick={onRefresh}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            Refresh Status
          </button>
        )}
      </div>
    </motion.div>
  )
}

/**
 * New Campaign Modal Component
 */
function NewCampaignModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: SendCampaignRequest) => void
}) {
  const [formData, setFormData] = useState<SendCampaignRequest>({
    name: '',
    template: 'waitlist',
    subject: '',
    segment: {
      type: 'all',
      respectMarketingPrefs: true,
      emailVerifiedOnly: false,
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Create New Campaign
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Welcome Email 2025"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Template
            </label>
            <select
              value={formData.template}
              onChange={(e) =>
                setFormData({ ...formData, template: e.target.value as any })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="waitlist">Waitlist Thank You</option>
              <option value="welcome">Welcome Email</option>
              <option value="password_reset">Password Reset</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Subject
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Welcome to Moshimoshi!"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Segment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Segment
            </label>
            <select
              value={formData.segment.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  segment: { ...formData.segment, type: e.target.value as any },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Users</option>
              <option value="free">Free Users Only</option>
              <option value="premium_monthly">Premium Monthly Subscribers</option>
              <option value="premium_yearly">Premium Yearly Subscribers</option>
            </select>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.segment.respectMarketingPrefs}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    segment: {
                      ...formData.segment,
                      respectMarketingPrefs: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Respect marketing email preferences (recommended)
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.segment.emailVerifiedOnly}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    segment: { ...formData.segment, emailVerifiedOnly: e.target.checked },
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Email verified users only
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Create Campaign
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
