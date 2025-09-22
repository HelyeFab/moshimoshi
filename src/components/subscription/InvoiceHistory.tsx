'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { LoadingSpinner } from '../ui/Loading'
import DoshiMascot from '../ui/DoshiMascot'

interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  created: Date
  invoicePdf?: string
  description?: string
}

interface InvoiceHistoryProps {
  customerId?: string
}

export function InvoiceHistory({ customerId }: InvoiceHistoryProps) {
  const { t } = useI18n()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!customerId) {
        setLoading(false)
        return
      }

      try {
        // No need for authorization header - using session auth
        const response = await fetch('/api/stripe/invoices')

        if (!response.ok) {
          throw new Error('Failed to fetch invoices')
        }

        const data = await response.json()
        setInvoices(data.invoices || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoices')
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [customerId])


  const formatCurrency = (amount: number, currency: string) => {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase()
    })
    return formatter.format(amount / 100) // Stripe amounts are in cents
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date))
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      void: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      uncollectible: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }

    const statusLabels = {
      paid: t('subscription.invoice.statuses.paid'),
      open: t('subscription.invoice.statuses.open'),
      void: t('subscription.invoice.statuses.void'),
      uncollectible: t('subscription.invoice.statuses.uncollectible')
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status as keyof typeof statusClasses] || statusClasses.open}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-soft-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="medium" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-soft-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6">
        <div className="text-center py-8">
          <DoshiMascot size="small" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!customerId || invoices.length === 0) {
    return (
      <div className="bg-soft-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('subscription.invoice.title')}
        </h2>
        <div className="text-center py-8">
          <DoshiMascot size="small" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {t('subscription.invoice.noInvoices')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {t('subscription.invoice.title')}
      </h2>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('subscription.invoice.date')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('subscription.invoice.description')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('subscription.invoice.amount')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('subscription.invoice.status')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('subscription.invoice.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(invoice.created)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {invoice.description || t('subscription.invoice.subscription')}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {getStatusBadge(invoice.status)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {invoice.invoicePdf && (
                    <a
                      href={invoice.invoicePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                    >
                      {t('subscription.invoice.download')}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="bg-gray-50 dark:bg-dark-700/50 rounded-lg p-4 space-y-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  {t('subscription.invoice.date')}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(invoice.created)}
                </p>
              </div>
              <div className="text-right">
                {getStatusBadge(invoice.status)}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {t('subscription.invoice.description')}
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {invoice.description || t('subscription.invoice.subscription')}
              </p>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  {t('subscription.invoice.amount')}
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </p>
              </div>

              {invoice.invoicePdf && (
                <a
                  href={invoice.invoicePdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-lg transition-colors"
                >
                  {t('subscription.invoice.download')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}