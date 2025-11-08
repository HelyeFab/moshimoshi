'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { languages, languageNames } from '@/i18n/config'
import DoshiMascot from '@/components/ui/DoshiMascot'
// Navigation is now global via NavigationWrapper in root layout
import { LoadingOverlay } from '@/components/ui/Loading'
import Tooltip from '@/components/ui/Tooltip'
import SettingToggle from '@/components/ui/SettingToggle'
import CollapsibleSection from '@/components/common/CollapsibleSection'
import { preferencesManager } from '@/utils/preferencesManager'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { ReviewNotificationSettings } from '@/components/notifications/ReviewNotificationSettings'
import { Select } from '@/components/ui/Select'
import Dialog from '@/components/ui/Dialog'

export default function SettingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, strings } = useI18n()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingLeaderboard, setUpdatingLeaderboard] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  
  // Settings state
  const [notifications, setNotifications] = useState({
    dailyReminder: true,
    achievementAlerts: true,
    weeklyProgress: false,
    marketingEmails: false,
  })
  
  const [learning, setLearning] = useState({
    autoplay: true,
    furigana: true,
    romaji: false,
    soundEffects: true,
    hapticFeedback: true,
  })
  
  const [privacy, setPrivacy] = useState({
    publicProfile: false,
    showProgress: true,
    shareAchievements: false,
    hideFromLeaderboard: false, // Opt-out instead of opt-in
  })

  const [accessibility, setAccessibility] = useState({
    largeText: false,
    highContrast: false,
    reduceMotion: false,
    screenReader: false,
  })

  const [selectedPalette, setSelectedPalette] = useState('sakura')

  useEffect(() => {
    loadUserPreferences()
  }, [user, isPremium])

  const loadUserPreferences = async () => {
    try {
      setLoading(true)

      // Migrate old localStorage data if needed
      if (user) {
        await preferencesManager.migrateFromLocalStorage(user, isPremium)
      }

      // Load preferences based on user tier
      const preferences = await preferencesManager.getPreferences(user, isPremium)

      // Update state with loaded preferences
      if (preferences.notifications) setNotifications(preferences.notifications)
      if (preferences.learning) setLearning(preferences.learning)
      if (preferences.privacy) setPrivacy(preferences.privacy)
      if (preferences.accessibility) {
        setAccessibility(preferences.accessibility)

        // Apply accessibility settings immediately
        if (preferences.accessibility.largeText) {
          document.documentElement.classList.add('text-large')
        }
        if (preferences.accessibility.reduceMotion) {
          document.documentElement.classList.add('reduce-motion')
        }
        if (preferences.accessibility.highContrast) {
          document.documentElement.classList.add('high-contrast')
        }
      }
      if (preferences.palette) setSelectedPalette(preferences.palette)
      // Always set theme if it exists in preferences, don't skip 'system'
      if (preferences.theme) setTheme(preferences.theme)
      if (preferences.language) setLanguage(preferences.language)

      // Also check leaderboard opt-out status from dedicated API
      if (user) {
        try {
          const response = await fetch('/api/leaderboard/opt-out')
          if (response.ok) {
            const data = await response.json()
            setPrivacy(prev => ({ ...prev, hideFromLeaderboard: data.optedOut }))
          }
        } catch (error) {
          console.error('[Settings] Failed to check leaderboard opt-out:', error)
        }
      }

      console.log('[Settings] Loaded preferences:', {
        userType: !user ? 'guest' : isPremium ? 'premium' : 'free',
        source: !user ? 'defaults' : isPremium ? 'cloud+local' : 'local'
      })
    } catch (error) {
      console.error('[Settings] Failed to load preferences:', error)
      showToast('Failed to load preferences', 'error')
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    try {
      setIsSaving(true)

      const preferences = {
        theme,
        language,
        palette: selectedPalette,
        notifications,
        learning,
        privacy,
        accessibility,
      }

      // Save preferences based on user tier
      await preferencesManager.savePreferences(preferences, user, isPremium)

      // Apply color palette to document
      document.documentElement.setAttribute('data-palette', selectedPalette)

      // Apply accessibility settings to document
      if (accessibility.largeText) {
        document.documentElement.classList.add('text-large')
      } else {
        document.documentElement.classList.remove('text-large')
      }

      if (accessibility.reduceMotion) {
        document.documentElement.classList.add('reduce-motion')
      } else {
        document.documentElement.classList.remove('reduce-motion')
      }

      if (accessibility.highContrast) {
        document.documentElement.classList.add('high-contrast')
      } else {
        document.documentElement.classList.remove('high-contrast')
      }

      // Show appropriate message based on user tier
      let message = strings.settings?.saveSuccess || 'Settings saved successfully!'
      if (!user) {
        message = 'Settings applied for this session only (sign in to save)';
      } else if (isPremium) {
        message = 'Settings saved and synced to cloud ☁️';
      } else {
        message = 'Settings saved locally to this device';
      }

      showToast(message, 'success')

      console.log('[Settings] Saved preferences:', {
        userType: !user ? 'guest' : isPremium ? 'premium' : 'free',
        storage: !user ? 'none' : isPremium ? 'indexedDB+firebase' : 'indexedDB'
      })
    } catch (error) {
      console.error('[Settings] Failed to save preferences:', error)
      showToast('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Loading settings..."
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-matcha/10 to-japanese-matchaDark/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800 transition-colors duration-500">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2352b788' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Navbar */}
      {/* Navigation is now global - rendered in root layout */}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Title with Doshi */}
        <div className="mb-8 flex items-center gap-4">
          <DoshiMascot 
            size="medium" 
           
            variant="animated"
          />
          <div>
            <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {strings.settings?.title || 'Settings'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {strings.settings?.subtitle || 'Customize your learning experience'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Appearance */}
          <CollapsibleSection
            title={strings.settings?.sections?.appearance?.title || 'Appearance'}
            icon="🎨"
            defaultOpen={false}
            badge={
              <Tooltip content="Customize how Moshimoshi looks">
                <DoshiMascot size="xsmall" />
              </Tooltip>
            }
          >
            <div className="space-y-6">
              {/* Language Selection */}
              <Select
                label={strings.settings?.sections?.appearance?.language?.label || 'Language / 言語 / Langue / Lingua / Sprache / Idioma'}
                value={language}
                onChange={(val) => setLanguage(val as any)}
                options={[
                  { value: 'en', label: languageNames.en, icon: <span>🇬🇧</span> },
                  { value: 'ja', label: languageNames.ja, icon: <span>🇯🇵</span> },
                  { value: 'fr', label: languageNames.fr, icon: <span>🇫🇷</span> },
                  { value: 'it', label: languageNames.it, icon: <span>🇮🇹</span> },
                  { value: 'de', label: languageNames.de, icon: <span>🇩🇪</span> },
                  { value: 'es', label: languageNames.es, icon: <span>🇪🇸</span> },
                ]}
              />

              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {strings.settings?.sections?.appearance?.theme?.label || 'Theme'}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((themeOption) => (
                    <button
                      key={themeOption}
                      onClick={() => setTheme(themeOption)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        theme === themeOption
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">
                          {themeOption === 'light' ? '☀️' : themeOption === 'dark' ? '🌙' : '💻'}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {themeOption === 'light' ? (strings.settings?.sections?.appearance?.theme?.light || 'Light') :
                           themeOption === 'dark' ? (strings.settings?.sections?.appearance?.theme?.dark || 'Dark') :
                           (strings.settings?.sections?.appearance?.theme?.system || 'System')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Palette Selection */}
              <Select
                label={strings.settings?.sections?.appearance?.colorPalette?.label || 'Color Palette'}
                value={selectedPalette}
                onChange={(val) => {
                  setSelectedPalette(val);
                  document.documentElement.setAttribute('data-palette', val);
                }}
                options={[
                  { value: 'sakura', label: 'Sakura', icon: <span>🌸</span> },
                  { value: 'ocean', label: 'Ocean', icon: <span>🌊</span> },
                  { value: 'matcha', label: 'Matcha', icon: <span>🍵</span> },
                  { value: 'sunset', label: 'Sunset', icon: <span>🌅</span> },
                  { value: 'lavender', label: 'Lavender', icon: <span>💜</span> },
                  { value: 'monochrome', label: 'Monochrome', icon: <span>⚫</span> },
                  { value: 'midnight', label: 'Midnight', icon: <span>🌙</span> },
                  { value: 'cherry', label: 'Cherry', icon: <span>🍒</span> },
                  { value: 'jade', label: 'Jade', icon: <span>💎</span> },
                  { value: 'amber', label: 'Amber', icon: <span>✨</span> },
                ]}
              />

              {/* Palette Preview */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-900/50 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{strings.settings?.sections?.appearance?.colorPalette?.preview || 'Preview:'}</p>
                <div className="flex items-center gap-2">
                  <button className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedPalette === 'sakura' ? 'bg-red-500 text-white' :
                    selectedPalette === 'ocean' ? 'bg-blue-500 text-white' :
                    selectedPalette === 'matcha' ? 'bg-green-500 text-white' :
                    selectedPalette === 'sunset' ? 'bg-orange-500 text-white' :
                    selectedPalette === 'lavender' ? 'bg-purple-500 text-white' :
                    selectedPalette === 'monochrome' ? 'bg-gray-500 text-white' :
                    selectedPalette === 'midnight' ? 'bg-indigo-600 text-white' :
                    selectedPalette === 'cherry' ? 'bg-pink-400 text-white' :
                    selectedPalette === 'jade' ? 'bg-emerald-500 text-white' :
                    selectedPalette === 'amber' ? 'bg-amber-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    Primary
                  </button>
                  <button className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedPalette === 'sakura' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400' :
                    selectedPalette === 'ocean' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                    selectedPalette === 'matcha' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                    selectedPalette === 'sunset' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' :
                    selectedPalette === 'lavender' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                    selectedPalette === 'monochrome' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400' :
                    selectedPalette === 'midnight' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' :
                    selectedPalette === 'cherry' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' :
                    selectedPalette === 'jade' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                    selectedPalette === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                  }`}>
                    Secondary
                  </button>
                  <DoshiMascot size="xsmall" />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Notifications */}
          <CollapsibleSection
            title={strings.settings?.sections?.notifications?.title || 'Notifications'}
            icon="🔔"
            defaultOpen={false}
          >
            <div className="space-y-6">
              {/* Review Notifications (NEW) */}
              <div className="mb-6">
                <ReviewNotificationSettings />
              </div>

              {/* Email Notifications */}
              <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-xl">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <span>📧</span>
                  Email Notifications
                </h4>
              <SettingToggle
                label={strings.settings?.sections?.notifications?.dailyReminder?.label || "Daily Study Reminder"}
                description={strings.settings?.sections?.notifications?.dailyReminder?.description || "Get reminded to practice every day"}
                enabled={notifications.dailyReminder}
                onChange={(value) => setNotifications({ ...notifications, dailyReminder: value })}
                icon="📅"
              />
              <SettingToggle
                label={strings.settings?.sections?.notifications?.achievementAlerts?.label || "Achievement Alerts"}
                description={strings.settings?.sections?.notifications?.achievementAlerts?.description || "Celebrate when you unlock achievements"}
                enabled={notifications.achievementAlerts}
                onChange={(value) => setNotifications({ ...notifications, achievementAlerts: value })}
                icon="🏆"
              />
              <SettingToggle
                label={strings.settings?.sections?.notifications?.weeklyProgress?.label || "Weekly Progress Report"}
                description={strings.settings?.sections?.notifications?.weeklyProgress?.description || "Receive a summary of your weekly progress"}
                enabled={notifications.weeklyProgress}
                onChange={(value) => setNotifications({ ...notifications, weeklyProgress: value })}
                icon="📊"
              />
              <SettingToggle
                label={strings.settings?.sections?.notifications?.marketingEmails?.label || "Marketing Emails"}
                description={strings.settings?.sections?.notifications?.marketingEmails?.description || "Updates about new features and content"}
                enabled={notifications.marketingEmails}
                onChange={(value) => setNotifications({ ...notifications, marketingEmails: value })}
                icon="📧"
              />
              </div>
            </div>
          </CollapsibleSection>

          {/* Privacy */}
          <CollapsibleSection
            title={strings.settings?.sections?.privacy?.title || 'Privacy'}
            icon="🔐"
            defaultOpen={false}
          >
            <div>
              <SettingToggle
                label={strings.settings?.sections?.privacy?.hideFromLeaderboard?.label || "Hide from Leaderboard"}
                description={strings.settings?.sections?.privacy?.hideFromLeaderboard?.description || "Opt out of appearing in public leaderboard rankings"}
                enabled={privacy.hideFromLeaderboard}
                onChange={async (value) => {
                  // Update local state optimistically
                  setPrivacy({ ...privacy, hideFromLeaderboard: value })

                  // Call the dedicated leaderboard opt-out API (works for ALL users)
                  if (user) {
                    setUpdatingLeaderboard(true)
                    try {
                      const response = await fetch('/api/leaderboard/opt-out', {
                        method: value ? 'POST' : 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                      })

                      if (!response.ok) {
                        // Revert on failure
                        setPrivacy({ ...privacy, hideFromLeaderboard: !value })
                        showToast('Failed to update leaderboard preference', 'error')
                      } else {
                        showToast(
                          value ? 'You have been removed from the leaderboard' : 'You have been added back to the leaderboard',
                          'success'
                        )
                      }
                    } catch (error) {
                      console.error('[Settings] Failed to update leaderboard opt-out:', error)
                      setPrivacy({ ...privacy, hideFromLeaderboard: !value })
                      showToast('Failed to update leaderboard preference', 'error')
                    } finally {
                      setUpdatingLeaderboard(false)
                    }
                  }
                }}
                icon="🏆"
                disabled={updatingLeaderboard}
              />
            </div>
          </CollapsibleSection>

          {/* Accessibility */}
          <CollapsibleSection
            title={strings.settings?.sections?.accessibility?.title || 'Accessibility'}
            icon="♿"
            defaultOpen={false}
          >
            <div>
              <SettingToggle
                label={strings.settings?.sections?.accessibility?.largeText?.label || "Large Text"}
                description={strings.settings?.sections?.accessibility?.largeText?.description || "Increase text size for better readability"}
                enabled={accessibility.largeText}
                onChange={(value) => setAccessibility({ ...accessibility, largeText: value })}
                icon="🔍"
              />
              <SettingToggle
                label={strings.settings?.sections?.accessibility?.highContrast?.label || "High Contrast"}
                description={strings.settings?.sections?.accessibility?.highContrast?.description || "Increase color contrast for visibility"}
                enabled={accessibility.highContrast}
                onChange={(value) => setAccessibility({ ...accessibility, highContrast: value })}
                icon="🎨"
              />
              <SettingToggle
                label={strings.settings?.sections?.accessibility?.reduceMotion?.label || "Reduce Motion"}
                description={strings.settings?.sections?.accessibility?.reduceMotion?.description || "Minimize animations and transitions"}
                enabled={accessibility.reduceMotion}
                onChange={(value) => setAccessibility({ ...accessibility, reduceMotion: value })}
                icon="🎬"
              />
            </div>
          </CollapsibleSection>

          {/* Legal & Support */}
          <CollapsibleSection
            title={strings.settings?.sections?.legal?.title || 'Legal & Support'}
            icon="📄"
            defaultOpen={false}
          >
            <div className="space-y-3">
              <Link
                href="/privacy"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{strings.settings?.sections?.legal?.privacyPolicy?.label || 'Privacy Policy'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{strings.settings?.sections?.legal?.privacyPolicy?.description || 'How we handle your data'}</p>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">→</span>
              </Link>

              <Link
                href="/terms"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{strings.settings?.sections?.legal?.termsOfService?.label || 'Terms of Service'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{strings.settings?.sections?.legal?.termsOfService?.description || 'Our terms and conditions'}</p>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">→</span>
              </Link>

              <Link
                href="/credits"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🙏</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{strings.settings?.sections?.legal?.credits?.label || 'Credits & Acknowledgments'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{strings.settings?.sections?.legal?.credits?.description || 'Open source libraries and data sources'}</p>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">→</span>
              </Link>

              <Link
                href="/contact"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💬</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{strings.settings?.sections?.legal?.contactUs?.label || 'Contact Us'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{strings.settings?.sections?.legal?.contactUs?.description || 'Get help or send feedback'}</p>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">→</span>
              </Link>

              <a
                href="mailto:support@moshimoshi.app"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{strings.settings?.sections?.legal?.emailSupport?.label || 'Email Support'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{strings.settings?.sections?.legal?.emailSupport?.description || 'support@moshimoshi.app'}</p>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">↗</span>
              </a>
            </div>
          </CollapsibleSection>

          {/* Save Button */}
          <div className="flex justify-center">
            <button
              onClick={savePreferences}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <span>
                {isSaving
                  ? 'Saving...'
                  : (strings.settings?.saveButton || 'Save All Settings')}
              </span>
              {!isSaving && <DoshiMascot size="xsmall" />}
            </button>
          </div>

          {/* Storage Tier Indicator */}
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {!user ? (
                <>🔓 Guest Mode - Settings won't be saved</>
              ) : isPremium ? (
                <>⭐ Premium - Settings sync across all devices</>
              ) : (
                <>💾 Free Account - Settings saved locally</>
              )}
            </p>
          </div>

          {/* Reset Section */}
          <div className="text-center py-4">
            <button
              onClick={() => setShowResetDialog(true)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {strings.settings?.resetButton || 'Reset all settings to default'}
            </button>
          </div>
        </div>
      </main>

      {/* Reset Confirmation Dialog */}
      <Dialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={() => {
          localStorage.removeItem('user-preferences')
          showToast(strings.settings?.resetSuccess || 'Settings reset to default', 'info')
          router.refresh()
        }}
        title={strings.settings?.resetConfirm || 'Reset Settings?'}
        message={strings.settings?.resetConfirm || 'Are you sure you want to reset all settings to default?'}
        confirmText="OK"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  )
}