'use client'

import { buildWaitlistThankYouContent } from '@/lib/email/waitlistThankYou'
import { useState } from 'react'

const PREVIEW_EMAIL = 'preview@example.com'
const SUPPORTED_LOCALES = ['en', 'ja', 'it', 'de', 'fr', 'es'] as const
type Locale = typeof SUPPORTED_LOCALES[number]

export default function WaitlistEmailPreviewPage() {
  const [testEmail, setTestEmail] = useState(PREVIEW_EMAIL)
  const [locale, setLocale] = useState<Locale>('en')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [sendMessage, setSendMessage] = useState('')

  const { html, text } = buildWaitlistThankYouContent(testEmail, locale)

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
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '24px', maxWidth: 1400, margin: '0 auto', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ marginBottom: 8, fontSize: '24px', fontWeight: 700, color: '#111' }}>
          📧 Waitlist Thank-You Email Preview
        </h1>
        <p style={{ color: '#6b7280', marginBottom: 20, fontSize: '14px' }}>
          Preview and test the automated thank-you email sent to waitlist signups.
          Launch date: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: '13px' }}>
            {process.env.NEXT_PUBLIC_LAUNCH_DATE || 'Not set'}
          </code>
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontWeight: 500, fontSize: '14px', color: '#374151' }}>Email:</label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minWidth: '250px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontWeight: 500, fontSize: '14px', color: '#374151' }}>Language:</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
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
            style={{
              padding: '8px 20px',
              background: sendStatus === 'sending' ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: sendStatus === 'sending' ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {sendStatus === 'sending' ? 'Sending...' : '✉️ Send Test Email'}
          </button>

          <button
            onClick={() => setTestEmail(PREVIEW_EMAIL)}
            style={{
              padding: '8px 16px',
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Reset
          </button>
        </div>

        {/* Send status message */}
        {sendMessage && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            background: sendStatus === 'success' ? '#d1fae5' : '#fee2e2',
            color: sendStatus === 'success' ? '#065f46' : '#991b1b',
          }}>
            {sendMessage}
          </div>
        )}
      </div>

      {/* Preview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h2 style={{ marginBottom: 12, fontSize: '18px', fontWeight: 600, color: '#111' }}>
            HTML Preview
          </h2>
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              background: '#fff',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <div>
          <h2 style={{ marginBottom: 12, fontSize: '18px', fontWeight: 600, color: '#111' }}>
            Plain Text Version
          </h2>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              background: '#fff',
              padding: 20,
              fontSize: 14,
              color: '#111827',
              lineHeight: 1.7,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              margin: 0,
            }}
          >
            {text}
          </pre>
        </div>
      </div>
    </div>
  )
}
