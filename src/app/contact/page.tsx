'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import Navbar from '@/components/layout/Navbar'
import PageContainer from '@/components/ui/PageContainer'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { LoadingOverlay } from '@/components/ui/Loading'

export default function ContactPage() {
  const router = useRouter()
  const { strings } = useI18n()
  const { showToast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'general',
    message: ''
  })

  const [messageLength, setMessageLength] = useState(0)
  const maxMessageLength = 5000

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      if (data.authenticated) {
        setUser(data.user)
        // Pre-fill email if user is logged in
        setFormData(prev => ({
          ...prev,
          email: data.user.email || '',
          name: data.user.displayName || ''
        }))
      }
    } catch (error) {
      console.error('Session check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    if (name === 'message') {
      setMessageLength(value.length)
    }
  }

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validation
    if (!validateEmail(formData.email)) {
      showToast(strings.contact?.validation?.invalidEmail || 'Please enter a valid email address', 'error')
      setIsSubmitting(false)
      return
    }

    if (formData.message.length < 10) {
      showToast(strings.contact?.validation?.messageTooShort || 'Message must be at least 10 characters', 'error')
      setIsSubmitting(false)
      return
    }

    if (formData.message.length > maxMessageLength) {
      showToast(strings.contact?.validation?.messageTooLong || `Message exceeds ${maxMessageLength} character limit`, 'error')
      setIsSubmitting(false)
      return
    }

    try {
      // Send email via API
      const emailMap: Record<string, string> = {
        general: 'support@moshimoshi.app',
        bug: 'feedback@moshimoshi.app',
        feedback: 'feedback@moshimoshi.app',
        feature: 'feedback@moshimoshi.app',
        support: 'support@moshimoshi.app',
        privacy: 'privacy@moshimoshi.app'
      }

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          to: emailMap[formData.category] || 'support@moshimoshi.app'
        })
      })

      if (response.ok) {
        setShowSuccess(true)
        setFormData({
          name: user?.displayName || '',
          email: user?.email || '',
          subject: '',
          category: 'general',
          message: ''
        })
        setMessageLength(0)
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Contact form error:', error)
      showToast(strings.contact?.error || 'Sorry, there was an error sending your message. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Loading..."
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  const contact = strings.contact || {}

  if (showSuccess) {
    return (
      <PageContainer gradient="default" showPattern={true}>
        <Navbar
          user={user}
          showUserMenu={!!user}
          backLink={{
            href: user ? '/dashboard' : '/',
            label: user ? '← Back to Dashboard' : '← Back'
          }}
        />

        <main className="container mx-auto px-4 py-8 max-w-md">
          <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-8 text-center">
            <DoshiMascot size="large" mood="excited" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">
              {contact.success?.title || 'Message Sent!'}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              {contact.success?.message || "Thank you for contacting us. We'll get back to you as soon as possible!"}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                {contact.success?.sendAnother || 'Send Another Message'}
              </button>
              <button
                onClick={() => router.push(user ? '/dashboard' : '/')}
                className="w-full px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {contact.success?.goBack || 'Go Back'}
              </button>
            </div>
          </div>
        </main>
      </PageContainer>
    )
  }

  return (
    <PageContainer gradient="default" showPattern={true}>
      <Navbar
        user={user}
        showUserMenu={!!user}
        backLink={{
          href: user ? '/dashboard' : '/',
          label: user ? '← Back to Dashboard' : '← Back'
        }}
      />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <DoshiMascot size="medium" mood="happy" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-4">
            {contact.title || 'Contact Us'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {contact.subtitle || "We'd love to hear from you!"}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {contact.form?.name || 'Name'} *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white transition-colors"
                placeholder={contact.form?.namePlaceholder || 'Your name'}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {contact.form?.email || 'Email'} *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white transition-colors"
                placeholder={contact.form?.emailPlaceholder || 'your@email.com'}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {contact.form?.category || 'Category'} *
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white transition-colors"
              >
                <option value="general">{contact.form?.categories?.general || 'General Inquiry'}</option>
                <option value="support">{contact.form?.categories?.support || 'Technical Support'}</option>
                <option value="bug">{contact.form?.categories?.bug || 'Bug Report'}</option>
                <option value="feature">{contact.form?.categories?.feature || 'Feature Request'}</option>
                <option value="feedback">{contact.form?.categories?.feedback || 'Feedback'}</option>
                <option value="privacy">{contact.form?.categories?.privacy || 'Privacy Concern'}</option>
              </select>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {contact.form?.subject || 'Subject'} *
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white transition-colors"
                placeholder={contact.form?.subjectPlaceholder || 'Brief description of your inquiry'}
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {contact.form?.message || 'Message'} *
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white transition-colors resize-none"
                placeholder={contact.form?.messagePlaceholder || 'Tell us more about your inquiry...'}
              />
              <div className="mt-2 text-right">
                <span className={`text-sm ${messageLength > maxMessageLength ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                  {messageLength} / {maxMessageLength}
                </span>
              </div>
            </div>

            {/* Email Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>{contact.form?.info?.title || 'Your message will be sent to'}:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-300">
                <li>• <strong>{contact.form?.info?.support || 'Support'}:</strong> support@moshimoshi.app</li>
                <li>• <strong>{contact.form?.info?.feedback || 'Feedback'}:</strong> feedback@moshimoshi.app</li>
                <li>• <strong>{contact.form?.info?.privacy || 'Privacy'}:</strong> privacy@moshimoshi.app</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingOverlay isLoading={true} message="" />
                  {contact.form?.sending || 'Sending...'}
                </span>
              ) : (
                contact.form?.submit || 'Send Message'
              )}
            </button>
          </form>

          {/* Alternative Contact Methods */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {contact.alternative?.title || 'Other Ways to Reach Us'}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {contact.alternative?.email?.title || 'Email Us Directly'}
                  </p>
                  <a href="mailto:support@moshimoshi.app" className="text-sm text-primary-500 hover:underline">
                    support@moshimoshi.app
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {contact.alternative?.privacy?.title || 'Privacy Concerns'}
                  </p>
                  <a href="mailto:privacy@moshimoshi.app" className="text-sm text-primary-500 hover:underline">
                    privacy@moshimoshi.app
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </PageContainer>
  )
}