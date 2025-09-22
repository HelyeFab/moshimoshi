'use client'

import { useI18n } from '@/i18n/I18nContext'
import Navbar from '@/components/layout/Navbar'
import PageContainer from '@/components/ui/PageContainer'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TermsOfServicePage() {
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

  const terms = strings.terms || {}

  return (
    <PageContainer gradient="default" showPattern={true}>
      <Navbar
        user={user}
        showUserMenu={!!user}
      />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <DoshiMascot size="medium" mood="thinking" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-4">
            {terms.title || 'Terms of Service'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {terms.effectiveDate || 'Effective Date: January 2025'} | Version 1.0
          </p>
        </div>

        <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6 space-y-6">
          {/* Agreement to Terms */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.agreement?.title || '1. Agreement to Terms'}
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              {terms.sections?.agreement?.content ||
                `These Terms of Service ("Terms") constitute a legally binding agreement between you and Moshimoshi ("we," "us," or "our") regarding your use of our Japanese language learning application and related services (collectively, the "Service").`}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {terms.sections?.agreement?.acceptance ||
                'By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these terms, you do not have permission to access the Service.'}
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-900 dark:text-red-200">
                <strong>{terms.sections?.agreement?.important || 'Important'}:</strong> {terms.sections?.agreement?.importantContent || 'These Terms contain a binding arbitration clause and class action waiver, which affect your legal rights. Please read carefully.'}
              </p>
            </div>
          </section>

          {/* Eligibility and Account */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.eligibility?.title || '2. Eligibility and Account'}
            </h2>
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {terms.sections?.eligibility?.requirements || 'To use our Service, you must:'}
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.eligibility?.age || 'Be at least 13 years old (or the minimum age in your jurisdiction)'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.eligibility?.accurate || 'Provide accurate and complete registration information'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.eligibility?.security || 'Maintain the security of your account credentials'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.eligibility?.notify || 'Notify us immediately of any unauthorized access'}
                  </span>
                </li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {terms.sections?.eligibility?.responsibility || 'You are responsible for all activities that occur under your account.'}
              </p>
            </div>
          </section>

          {/* Subscription and Payment */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.subscription?.title || '3. Subscription and Payment'}
            </h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.subscription?.plans?.title || '3.1 Subscription Plans'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {terms.sections?.subscription?.plans?.content || 'We offer various subscription plans with different features and pricing. By subscribing, you agree to pay the applicable fees for your chosen plan.'}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.subscription?.billing?.title || '3.2 Billing'}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.subscription?.billing?.autoRenew || 'Subscriptions automatically renew unless cancelled'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.subscription?.billing?.stripe || 'Payment is processed through Stripe, our payment provider'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.subscription?.billing?.changes || 'Prices may change with advance notice'}
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.subscription?.refunds?.title || '3.3 Refunds'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {terms.sections?.subscription?.refunds?.content || 'We offer a money-back guarantee for new subscribers. After this period, refunds are provided at our discretion for technical issues or service failures.'}
                </p>
              </div>
            </div>
          </section>

          {/* Acceptable Use Policy */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.acceptable?.title || '4. Acceptable Use Policy'}
            </h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.acceptable?.permitted?.title || '4.1 Permitted Uses'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {terms.sections?.acceptable?.permitted?.intro || 'You may use our Service for:'}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.permitted?.personal || 'Personal educational purposes'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.permitted?.classroom || 'Classroom use by educators (with appropriate license)'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.permitted?.sharing || 'Creating and sharing study materials within the platform'}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.acceptable?.prohibited?.title || '4.2 Prohibited Uses'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {terms.sections?.acceptable?.prohibited?.intro || 'You agree NOT to:'}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.laws || 'Violate any laws or regulations'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.ip || 'Infringe on intellectual property rights'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.malware || 'Transmit malware, viruses, or harmful code'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.unauthorized || 'Attempt to gain unauthorized access to our systems'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.scrape || 'Scrape, data mine, or use automated systems to access the Service'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.circumvent || 'Circumvent usage limits or access restrictions'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.resell || 'Resell or commercially redistribute our content'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.impersonate || 'Impersonate others or provide false information'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {terms.sections?.acceptable?.prohibited?.harass || 'Harass, abuse, or harm other users'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Intellectual Property */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.ip?.title || '5. Intellectual Property Rights'}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.ip?.ourContent?.title || '5.1 Our Content'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {terms.sections?.ip?.ourContent?.content || 'The Service and its original content (excluding user-generated content), features, and functionality are owned by Moshimoshi and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.'}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.ip?.yourContent?.title || '5.2 Your Content'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {terms.sections?.ip?.yourContent?.content || 'You retain ownership of content you create using our Service. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and display such content solely for providing and improving the Service.'}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {terms.sections?.ip?.feedback?.title || '5.3 Feedback'}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {terms.sections?.ip?.feedback?.content || 'Any feedback, suggestions, or ideas you provide about the Service become our property and may be used without compensation or attribution.'}
                </p>
              </div>
            </div>
          </section>

          {/* Disclaimers and Warranties */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.disclaimers?.title || '6. Disclaimers and Warranties'}
            </h2>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-2">
                {terms.sections?.disclaimers?.important || 'IMPORTANT LEGAL DISCLAIMER:'}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {terms.sections?.disclaimers?.asIs || 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY.'}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                {terms.sections?.disclaimers?.noWarranty || 'WE DO NOT WARRANT THAT:'}
              </p>
              <ul className="space-y-1 mt-2">
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.disclaimers?.uninterrupted || 'The Service will be uninterrupted or error-free'}</li>
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.disclaimers?.defects || 'Defects will be corrected'}</li>
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.disclaimers?.viruses || 'The Service is free of viruses or harmful components'}</li>
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.disclaimers?.results || 'The results from using the Service will meet your requirements'}</li>
              </ul>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.liability?.title || '7. Limitation of Liability'}
            </h2>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-2">
                {terms.sections?.liability?.limitation || 'LIMITATION OF LIABILITY:'}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {terms.sections?.liability?.maxExtent || 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL MOSHIMOSHI, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR:'}
              </p>
              <ul className="space-y-1 mt-2">
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.liability?.indirect || 'Any indirect, incidental, special, consequential, or punitive damages'}</li>
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.liability?.loss || 'Loss of profits, data, use, goodwill, or other intangible losses'}</li>
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.liability?.unauthorized || 'Damages resulting from unauthorized access to or use of our servers'}</li>
                <li className="text-sm text-gray-700 dark:text-gray-300">• {terms.sections?.liability?.interruption || 'Any interruption or cessation of transmission to or from the Service'}</li>
              </ul>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                {terms.sections?.liability?.total || 'Our total liability shall not exceed the amount paid by you, if any, for accessing the Service in the six months preceding the claim.'}
              </p>
            </div>
          </section>

          {/* Termination */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.termination?.title || '8. Termination'}
            </h2>
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {terms.sections?.termination?.intro || 'We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including:'}
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.termination?.breach || 'Breach of these Terms'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.termination?.request || 'Request by law enforcement or government agencies'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.termination?.inactivity || 'Extended periods of inactivity'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">•</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {terms.sections?.termination?.nonPayment || 'Non-payment of fees'}
                  </span>
                </li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {terms.sections?.termination?.consequence || 'Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which should reasonably survive termination shall survive.'}
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.governing?.title || '9. Governing Law'}
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              {terms.sections?.governing?.content || 'These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.'}
            </p>
          </section>

          {/* Changes to Terms */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.changes?.title || '10. Changes to These Terms'}
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              {terms.sections?.changes?.content || 'We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.'}
            </p>
          </section>

          {/* Contact Information */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {terms.sections?.contact?.title || '11. Contact Information'}
            </h2>
            <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                {terms.sections?.contact?.intro || 'If you have any questions about these Terms, please contact us:'}
              </p>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong className="text-gray-900 dark:text-gray-100">{terms.sections?.contact?.email || 'Email'}:</strong>{' '}
                  <a href="mailto:support@moshimoshi.app" className="text-primary-500 hover:underline">
                    support@moshimoshi.app
                  </a>
                </p>
                <p className="text-sm">
                  <strong className="text-gray-900 dark:text-gray-100">{terms.sections?.contact?.privacy || 'Privacy'}:</strong>{' '}
                  <a href="mailto:privacy@moshimoshi.app" className="text-primary-500 hover:underline">
                    privacy@moshimoshi.app
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
                {terms.footer || 'Thank you for choosing Moshimoshi for your Japanese learning journey.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </PageContainer>
  )
}