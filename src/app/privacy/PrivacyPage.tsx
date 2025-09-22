'use client'

import { useI18n } from '@/i18n/I18nContext'
import Navbar from '@/components/layout/Navbar'
import PageContainer from '@/components/ui/PageContainer'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PrivacyPolicyPage() {
  const router = useRouter()
  const { strings } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      if (data.authenticated) {
        setUser(data.user)
      }
    } catch (error) {
      console.error('Session check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  const privacy = strings.privacy || {}

  return (
    <PageContainer gradient="default" showPattern={true}>
      <Navbar
        user={user}
        showUserMenu={!!user}
        backLink={{
          href: user ? '/settings' : '/',
          label: user ? '← Back to Settings' : '← Back'
        }}
      />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <DoshiMascot size="medium" mood="happy" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-4">
            {privacy.title || 'Privacy Policy'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {privacy.lastUpdated || 'Last updated: January 2025'} | Version 1.0
          </p>
        </div>

        <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6 space-y-6">
          {/* Introduction */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {privacy.sections?.introduction?.title || '1. Introduction'}
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              {privacy.sections?.introduction?.content ||
                `Welcome to Moshimoshi ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Japanese language learning application.`}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {privacy.sections?.introduction?.agreement ||
                'By using Moshimoshi, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.'}
            </p>
          </section>

          {/* Information We Collect */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {privacy.sections?.collection?.title || '2. Information We Collect'}
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {privacy.sections?.collection?.provided?.title || '2.1 Information You Provide'}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.collection?.provided?.account || 'Account Information'}:</strong> {privacy.sections?.collection?.provided?.accountDesc || 'Email address, display name, and profile picture when you create an account'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.collection?.provided?.learning || 'Learning Data'}:</strong> {privacy.sections?.collection?.provided?.learningDesc || 'Your progress, saved vocabulary, practice results, and study preferences'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.collection?.provided?.content || 'User Content'}:</strong> {privacy.sections?.collection?.provided?.contentDesc || 'Notes, custom word lists, and any content you create within the app'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.collection?.provided?.communications || 'Communications'}:</strong> {privacy.sections?.collection?.provided?.communicationsDesc || 'Feedback, support requests, and correspondence with us'}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {privacy.sections?.collection?.automatic?.title || '2.2 Information Collected Automatically'}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.collection?.automatic?.device || 'Device Information'}:</strong> {privacy.sections?.collection?.automatic?.deviceDesc || 'Browser type, operating system, device type, and unique device identifiers'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.collection?.automatic?.usage || 'Usage Data'}:</strong> {privacy.sections?.collection?.automatic?.usageDesc || 'Features used, time spent, pages visited, and interaction patterns'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.collection?.automatic?.performance || 'Performance Data'}:</strong> {privacy.sections?.collection?.automatic?.performanceDesc || 'Crash reports, error logs, and performance metrics'}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {privacy.sections?.collection?.thirdParty?.title || '2.3 Third-Party Services'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {privacy.sections?.collection?.thirdParty?.intro || 'We use the following third-party services that may collect information:'}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Firebase (Google):</strong> {privacy.sections?.collection?.thirdParty?.firebase || 'Authentication, database, and analytics'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Stripe:</strong> {privacy.sections?.collection?.thirdParty?.stripe || 'Payment processing (no credit card details stored by us)'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>OpenAI:</strong> {privacy.sections?.collection?.thirdParty?.openai || 'AI-powered features (content anonymized)'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {privacy.sections?.usage?.title || '3. How We Use Your Information'}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {privacy.sections?.usage?.intro || 'We use the information we collect to:'}
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {privacy.sections?.usage?.provide || 'Provide and maintain our language learning services'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {privacy.sections?.usage?.personalize || 'Personalize your learning experience and track progress'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {privacy.sections?.usage?.process || 'Process transactions and manage subscriptions'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {privacy.sections?.usage?.notify || 'Send service-related notifications and updates'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {privacy.sections?.usage?.support || 'Respond to support requests and feedback'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {privacy.sections?.usage?.improve || 'Improve our services through analytics and research'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {privacy.sections?.usage?.comply || 'Comply with legal obligations and protect our rights'}
                </span>
              </li>
            </ul>
          </section>

          {/* Data Storage and Security */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {privacy.sections?.security?.title || '4. Data Storage and Security'}
            </h2>
            <div className="space-y-3">
              <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg border border-primary-200 dark:border-primary-800">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {privacy.sections?.security?.measures?.title || 'Our Security Measures'}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">🔒</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {privacy.sections?.security?.measures?.encryption || 'End-to-end encryption for sensitive data'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">🔒</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {privacy.sections?.security?.measures?.https || 'Secure HTTPS connections for all data transfers'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">🔒</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {privacy.sections?.security?.measures?.audits || 'Regular security audits and vulnerability assessments'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">🔒</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {privacy.sections?.security?.measures?.access || 'Access controls and authentication mechanisms'}
                    </span>
                  </li>
                </ul>
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>{privacy.sections?.security?.location?.title || 'Data Location'}:</strong> {privacy.sections?.security?.location?.content || 'Your data is stored on secure servers provided by Google Firebase, located in the United States. For users in the European Union, data may be transferred internationally in compliance with applicable data protection laws.'}
              </p>

              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>{privacy.sections?.security?.local?.title || 'Local Storage'}:</strong> {privacy.sections?.security?.local?.content || 'Some data is stored locally on your device for offline access and performance optimization. This includes cached content, preferences, and recent activity.'}
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {privacy.sections?.rights?.title || '5. Your Rights and Choices'}
            </h2>
            <div className="space-y-3">
              <div className="bg-secondary-50 dark:bg-secondary-900/20 p-4 rounded-lg border border-secondary-200 dark:border-secondary-800">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {privacy.sections?.rights?.yourRights?.title || 'You have the right to:'}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-secondary-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.rights?.yourRights?.access || 'Access'}:</strong> {privacy.sections?.rights?.yourRights?.accessDesc || 'Request a copy of your personal data'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.rights?.yourRights?.correct || 'Correct'}:</strong> {privacy.sections?.rights?.yourRights?.correctDesc || 'Update or correct inaccurate information'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.rights?.yourRights?.delete || 'Delete'}:</strong> {privacy.sections?.rights?.yourRights?.deleteDesc || 'Request deletion of your account and data'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.rights?.yourRights?.export || 'Export'}:</strong> {privacy.sections?.rights?.yourRights?.exportDesc || 'Download your data in a portable format'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.rights?.yourRights?.optOut || 'Opt-out'}:</strong> {privacy.sections?.rights?.yourRights?.optOutDesc || 'Unsubscribe from marketing communications'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-secondary-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{privacy.sections?.rights?.yourRights?.restrict || 'Restrict'}:</strong> {privacy.sections?.rights?.yourRights?.restrictDesc || 'Limit processing of your data in certain circumstances'}
                    </span>
                  </li>
                </ul>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {privacy.sections?.rights?.exercise || 'To exercise any of these rights, please contact us at'} <a href="mailto:privacy@moshimoshi.app" className="text-primary-500 hover:underline">privacy@moshimoshi.app</a> {privacy.sections?.rights?.exerciseSuffix || 'or through your account settings.'}
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {privacy.sections?.contact?.title || '6. Contact Information'}
            </h2>
            <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                {privacy.sections?.contact?.intro || 'If you have questions or concerns about this privacy policy or our data practices, please contact us:'}
              </p>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong className="text-gray-900 dark:text-gray-100">{privacy.sections?.contact?.email || 'Email'}:</strong>{' '}
                  <a href="mailto:privacy@moshimoshi.app" className="text-primary-500 hover:underline">
                    privacy@moshimoshi.app
                  </a>
                </p>
                <p className="text-sm">
                  <strong className="text-gray-900 dark:text-gray-100">{privacy.sections?.contact?.support || 'Support'}:</strong>{' '}
                  <a href="mailto:support@moshimoshi.app" className="text-primary-500 hover:underline">
                    support@moshimoshi.app
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <DoshiMascot size="small" mood="happy" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {privacy.footer || 'Thank you for trusting Moshimoshi with your Japanese learning journey.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </PageContainer>
  )
}