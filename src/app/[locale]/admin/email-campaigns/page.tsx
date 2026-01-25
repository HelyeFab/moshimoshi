'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
  const [emailPreviewModalOpen, setEmailPreviewModalOpen] = useState(false)
  const [emailPreviewData, setEmailPreviewData] = useState<any>(null)
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false)
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

  const handleEmailPreview = async (campaignId: string) => {
    try {
      setEmailPreviewLoading(true)
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/admin/campaigns/${campaignId}/email-preview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to load email preview')
      }

      setEmailPreviewData(data)
      setEmailPreviewModalOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load email preview')
      setErrorModalOpen(true)
      console.error('[EmailCampaigns] Email preview error:', err)
    } finally {
      setEmailPreviewLoading(false)
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
    <div className="pb-24 md:pb-0">
      {/* Header - Apple style with stacked layout on mobile */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 md:mb-2">
              Email Campaigns
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Create and send bulk email campaigns to segmented users.{' '}
              <Link
                href="/admin/email-templates"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Manage Templates
              </Link>
            </p>
          </div>
          {/* Desktop buttons */}
          <div className="hidden md:flex gap-3">
            <Link
              href="/admin/email-templates"
              className="px-4 py-3 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium flex items-center gap-2"
            >
              <span>✉️</span>
              Templates
            </Link>
            <button
              onClick={() => setShowNewCampaignModal(true)}
              className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              New Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Button - bottom left, above bottom nav */}
      <button
        onClick={() => setShowNewCampaignModal(true)}
        className="md:hidden fixed bottom-20 left-4 w-12 h-12 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 active:scale-95 transition-all flex items-center justify-center z-40"
        aria-label="New Campaign"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          <p className="font-medium">Error loading campaigns</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length === 0 && !error ? (
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-8 md:p-12 text-center">
          <div className="text-5xl md:text-6xl mb-4">📧</div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No campaigns yet
          </h2>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-6">
            Create your first email campaign to get started
          </p>
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="hidden md:inline-flex px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Create Campaign
          </button>
          <p className="md:hidden text-sm text-gray-500 dark:text-gray-400">
            Tap the + button below to create one
          </p>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onSend={() => handleSendClick(campaign.id, campaign.name)}
              onPreview={() => handlePreviewCampaign(campaign.id)}
              onEmailPreview={() => handleEmailPreview(campaign.id)}
              onDelete={() => handleDeleteClick(campaign.id, campaign.name)}
              onRefresh={fetchCampaigns}
              emailPreviewLoading={emailPreviewLoading}
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

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={emailPreviewModalOpen}
        onClose={() => setEmailPreviewModalOpen(false)}
        data={emailPreviewData}
      />
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
  onEmailPreview,
  onDelete,
  onRefresh,
  emailPreviewLoading,
}: {
  campaign: EmailCampaign
  onSend: () => void
  onPreview: () => void
  onEmailPreview: () => void
  onDelete: () => void
  onRefresh: () => void
  emailPreviewLoading: boolean
}) {
  const statusColors = {
    draft: 'bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200',
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
      className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4 md:p-6"
    >
      {/* Header with status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {campaign.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{campaign.subject}</p>
        </div>
        <span
          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}
        >
          {campaign.status.toUpperCase()}
        </span>
      </div>

      {/* Metadata - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Template</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {campaign.template}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Segment</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {campaign.segment.type}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
          <p className="font-medium text-gray-900 dark:text-gray-100 text-xs md:text-sm">
            {formatDate(campaign.createdAt as any)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sent</p>
          <p className="font-medium text-gray-900 dark:text-gray-100 text-xs md:text-sm">
            {formatDate(campaign.sentAt as any)}
          </p>
        </div>
      </div>

      {/* Stats */}
      {campaign.stats && campaign.stats.totalRecipients > 0 && (
        <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3 md:p-4 mb-4">
          <div className="grid grid-cols-4 gap-2 md:gap-4 text-center">
            <div>
              <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {campaign.stats.totalRecipients}
              </p>
              <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">Total</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">
                {campaign.stats.sentCount}
              </p>
              <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">Sent</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-400">
                {campaign.stats.failedCount}
              </p>
              <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">Failed</p>
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-gray-600 dark:text-gray-400">
                {campaign.stats.skippedCount}
              </p>
              <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">Skipped</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions - Apple-style segmented control */}
      <div className="space-y-3">
        {/* Primary action row - Apple segmented control style (matches kanji-mastery) */}
        <div className="flex p-1 bg-gray-100 dark:bg-dark-700 rounded-lg">
          <button
            onClick={onPreview}
            className="flex-1 px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-dark-600"
          >
            Recipients
          </button>
          <button
            onClick={onEmailPreview}
            disabled={emailPreviewLoading}
            className="flex-1 px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-dark-600 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="hidden sm:inline">Email </span>Preview
          </button>
          {campaign.status === 'sending' && (
            <button
              onClick={onRefresh}
              className="flex-1 px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all text-primary-600 dark:text-primary-400 hover:bg-white dark:hover:bg-dark-600 flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>

        {/* Secondary actions - only for draft campaigns */}
        {campaign.status === 'draft' && (
          <div className="flex gap-2">
            <button
              onClick={onSend}
              className="flex-1 py-3 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:text-gray-500 flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send Now
            </button>
            <button
              onClick={onDelete}
              className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
              aria-label="Delete campaign"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-dark-800 rounded-t-2xl md:rounded-xl w-full md:max-w-2xl md:m-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Apple-style header with drag indicator on mobile */}
        <div className="flex-shrink-0">
          <div className="md:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-gray-300 dark:bg-dark-600 rounded-full" />
          </div>
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-dark-700">
            <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              New Campaign
            </h2>
            <button
              onClick={onClose}
              className="p-2 -m-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
              Campaign Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Welcome Email 2025"
              className="w-full px-4 py-3 md:py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 text-base focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
              Email Template
            </label>
            <select
              value={formData.template}
              onChange={(e) =>
                setFormData({ ...formData, template: e.target.value as any })
              }
              className="w-full px-4 py-3 md:py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 text-base focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="waitlist">Waitlist Thank You</option>
              <option value="welcome">Welcome Email</option>
              <option value="password_reset">Password Reset</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
              Email Subject
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Welcome to Moshimoshi!"
              className="w-full px-4 py-3 md:py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 text-base focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Segment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
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
              className="w-full px-4 py-3 md:py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 text-base focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Users</option>
              <option value="free">Free Users Only</option>
              <option value="premium_monthly">Premium Monthly Subscribers</option>
              <option value="premium_yearly">Premium Yearly Subscribers</option>
            </select>
          </div>

          {/* Filters - Apple-style toggle cards */}
          <div className="space-y-3">
            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-lg cursor-pointer">
              <span className="text-sm text-gray-700 dark:text-gray-300 pr-4">
                Respect marketing email preferences
              </span>
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
                className="w-5 h-5 rounded accent-primary-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-lg cursor-pointer">
              <span className="text-sm text-gray-700 dark:text-gray-300 pr-4">
                Email verified users only
              </span>
              <input
                type="checkbox"
                checked={formData.segment.emailVerifiedOnly}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    segment: { ...formData.segment, emailVerifiedOnly: e.target.checked },
                  })
                }
                className="w-5 h-5 rounded accent-primary-500"
              />
            </label>
          </div>
        </form>

        {/* Fixed bottom actions - Apple style */}
        <div className="flex-shrink-0 p-4 md:p-6 border-t border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/50 safe-area-inset-bottom">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 md:py-2.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 md:py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Create
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Email Preview Modal Component
 */
function EmailPreviewModal({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean
  onClose: () => void
  data: any
}) {
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html')

  if (!isOpen || !data) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Email Preview
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Campaign Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Campaign:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">{data.campaign?.name}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Template:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">{data.campaign?.template}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Subject:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">{data.campaign?.subject}</span>
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('html')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'html'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              HTML Preview
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'text'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Plain Text
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'html' ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <iframe
                srcDoc={data.preview?.html}
                title="Email Preview"
                className="w-full h-[600px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-auto max-h-[600px]">
              {data.preview?.text}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Preview email: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{data.preview?.previewEmail}</code>
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
