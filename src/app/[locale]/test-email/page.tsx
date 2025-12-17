'use client'

import { useState, useEffect } from 'react'

const PREVIEW_EMAIL = 'preview@example.com'

export default function EmailTestPage() {
  const [testEmail, setTestEmail] = useState(PREVIEW_EMAIL)
  const [locale, setLocale] = useState('en')
  const [html, setHtml] = useState('')
  const [text, setText] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [sendMessage, setSendMessage] = useState('')

  useEffect(() => {
    // Fetch the email content
    fetch('/api/email/preview/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, locale }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.html && data.text) {
          setHtml(data.html)
          setText(data.text)
        }
      })
      .catch(err => console.error('Failed to load preview:', err))
  }, [testEmail, locale])

  const sendTestEmail = async () => {
    setSendStatus('sending')
    setSendMessage('')

    try {
      const response = await fetch('/api/email/test/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, locale }),
      })

      const data = await response.json()

      if (data.success) {
        setSendStatus('success')
        setSendMessage(`✓ Test email sent to ${testEmail}`)
      } else {
        setSendStatus('error')
        setSendMessage(`✗ Failed: ${data.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      setSendStatus('error')
      setSendMessage(`✗ Network error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            📧 Waitlist Thank-You Email
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Preview and test the automated thank-you email sent to waitlist signups
          </p>

          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                style={{ minWidth: '280px' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
              >
                <option value="en">🇬🇧 English</option>
                <option value="ja">🇯🇵 日本語</option>
                <option value="it">🇮🇹 Italiano</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="es">🇪🇸 Español</option>
              </select>
            </div>

            <button
              onClick={sendTestEmail}
              disabled={sendStatus === 'sending'}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {sendStatus === 'sending' ? 'Sending...' : '✉️ Send Test Email'}
            </button>

            <button
              onClick={() => setTestEmail(PREVIEW_EMAIL)}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Status Message */}
          {sendMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              sendStatus === 'success'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              {sendMessage}
            </div>
          )}
        </div>

        {/* Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* HTML Preview */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              HTML Preview
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
              <iframe
                srcDoc={html}
                title="HTML Email Preview"
                className="w-full h-[700px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          {/* Text Preview */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Plain Text Version
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 font-mono leading-relaxed">
                {text}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
