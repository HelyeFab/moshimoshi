'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { languages, languageNames } from '@/i18n/config'
import DoshiMascot from '@/components/ui/DoshiMascot'
import Navbar from '@/components/layout/Navbar'
import { LoadingOverlay } from '@/components/ui/Loading'
import Tooltip from '@/components/ui/Tooltip'
import SettingToggle from '@/components/ui/SettingToggle'
import CollapsibleSection from '@/components/common/CollapsibleSection'
import { preferencesManager } from '@/utils/preferencesManager'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'

export default function SettingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, strings } = useI18n()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
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
      if (preferences.accessibility) setAccessibility(preferences.accessibility)
      if (preferences.palette) setSelectedPalette(preferences.palette)
      // Always set theme if it exists in preferences, don't skip 'system'
      if (preferences.theme) setTheme(preferences.theme)
      if (preferences.language) setLanguage(preferences.language)

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
      <Navbar 
        user={user}
        showUserMenu={true}
        backLink={{
          href: '/dashboard',
          label: strings.settings?.backToDashboard || '← Back to Dashboard'
        }}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Title with Doshi */}
        <div className="mb-8 flex items-center gap-4">
          <DoshiMascot 
            size="medium" 
           
            variant="animated"
          />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
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
            defaultOpen={true}
            badge={
              <Tooltip content="Customize how Moshimoshi looks">
                <DoshiMascot size="xsmall" />
              </Tooltip>
            }
          >
            <div className="space-y-6">
              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {strings.settings?.sections?.appearance?.language?.label || 'Language / 言語 / Langue / Lingua / Sprache / Idioma'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {languages.map((lang) => {
                    const flagEmojis: Record<typeof lang, string> = {
                      en: '🇬🇧',
                      ja: '🇯🇵',
                      fr: '🇫🇷',
                      it: '🇮🇹',
                      de: '🇩🇪',
                      es: '🇪🇸',
                    }
                    
                    return (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          language === lang
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-2xl">
                            {flagEmojis[lang]}
                          </span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {languageNames[lang]}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {strings.settings?.sections?.appearance?.colorPalette?.label || 'Color Palette'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Sakura (Default Red/Pink) */}
                  <button
                    onClick={() => {
                      setSelectedPalette('sakura');
                      document.documentElement.setAttribute('data-palette', 'sakura');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPalette === 'sakura'
                        ? 'border-primary-500 shadow-lg scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-pink-500" />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-300 to-rose-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Sakura 🌸
                      </span>
                    </div>
                  </button>

                  {/* Ocean (Blue/Teal) */}
                  <button
                    onClick={() => {
                      setSelectedPalette('ocean');
                      document.documentElement.setAttribute('data-palette', 'ocean');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPalette === 'ocean'
                        ? 'border-blue-500 shadow-lg scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500" />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-300 to-blue-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Ocean 🌊
                      </span>
                    </div>
                  </button>

                  {/* Matcha (Green) */}
                  <button
                    onClick={() => {
                      setSelectedPalette('matcha');
                      document.documentElement.setAttribute('data-palette', 'matcha');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPalette === 'matcha'
                        ? 'border-green-500 shadow-lg scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500" />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-lime-300 to-green-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Matcha 🍵
                      </span>
                    </div>
                  </button>

                  {/* Sunset (Orange/Yellow) */}
                  <button
                    onClick={() => {
                      setSelectedPalette('sunset');
                      document.documentElement.setAttribute('data-palette', 'sunset');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPalette === 'sunset'
                        ? 'border-orange-500 shadow-lg scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-red-500" />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Sunset 🌅
                      </span>
                    </div>
                  </button>

                  {/* Lavender (Purple) */}
                  <button
                    onClick={() => {
                      setSelectedPalette('lavender');
                      document.documentElement.setAttribute('data-palette', 'lavender');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPalette === 'lavender'
                        ? 'border-purple-500 shadow-lg scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500" />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-300 to-purple-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Lavender 💜
                      </span>
                    </div>
                  </button>

                  {/* Monochrome (Gray) */}
                  <button
                    onClick={() => {
                      setSelectedPalette('monochrome');
                      document.documentElement.setAttribute('data-palette', 'monochrome');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPalette === 'monochrome'
                        ? 'border-gray-600 shadow-lg scale-105'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-600" />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Mono ⚫
                      </span>
                    </div>
                  </button>
                </div>
                
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
                      'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                    }`}>
                      Secondary
                    </button>
                    <DoshiMascot size="xsmall" />
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Learning Preferences */}
          <CollapsibleSection
            title={strings.settings?.sections?.learning?.title || 'Learning Preferences'}
            icon="📚"
            defaultOpen={false}
          >
            <div>
              <SettingToggle
                label={strings.settings?.sections?.learning?.autoplay?.label || "Auto-play Audio"}
                description={strings.settings?.sections?.learning?.autoplay?.description || "Automatically play pronunciation when viewing words"}
                enabled={learning.autoplay}
                onChange={(value) => setLearning({ ...learning, autoplay: value })}
                icon="🔊"
              />
              <SettingToggle
                label={strings.settings?.sections?.learning?.furigana?.label || "Show Furigana"}
                description={strings.settings?.sections?.learning?.furigana?.description || "Display reading hints above kanji characters"}
                enabled={learning.furigana}
                onChange={(value) => setLearning({ ...learning, furigana: value })}
                icon="🈷️"
              />
              <SettingToggle
                label={strings.settings?.sections?.learning?.romaji?.label || "Show Romaji"}
                description={strings.settings?.sections?.learning?.romaji?.description || "Display romanized Japanese text"}
                enabled={learning.romaji}
                onChange={(value) => setLearning({ ...learning, romaji: value })}
                icon="🔤"
              />
              <SettingToggle
                label={strings.settings?.sections?.learning?.soundEffects?.label || "Sound Effects"}
                description={strings.settings?.sections?.learning?.soundEffects?.description || "Play sounds for correct/incorrect answers"}
                enabled={learning.soundEffects}
                onChange={(value) => setLearning({ ...learning, soundEffects: value })}
                icon="🎵"
              />
              <SettingToggle
                label={strings.settings?.sections?.learning?.hapticFeedback?.label || "Haptic Feedback"}
                description={strings.settings?.sections?.learning?.hapticFeedback?.description || "Vibration feedback on mobile devices"}
                enabled={learning.hapticFeedback}
                onChange={(value) => setLearning({ ...learning, hapticFeedback: value })}
                icon="📳"
              />
            </div>
          </CollapsibleSection>

          {/* Notifications */}
          <CollapsibleSection
            title={strings.settings?.sections?.notifications?.title || 'Notifications'}
            icon="🔔"
            defaultOpen={false}
          >
            <div>
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
          </CollapsibleSection>

          {/* Privacy */}
          <CollapsibleSection
            title={strings.settings?.sections?.privacy?.title || 'Privacy'}
            icon="🔐"
            defaultOpen={false}
          >
            <div>
              <SettingToggle
                label={strings.settings?.sections?.privacy?.publicProfile?.label || "Public Profile"}
                description={strings.settings?.sections?.privacy?.publicProfile?.description || "Allow others to view your profile"}
                enabled={privacy.publicProfile}
                onChange={(value) => setPrivacy({ ...privacy, publicProfile: value })}
                icon="👤"
              />
              <SettingToggle
                label={strings.settings?.sections?.privacy?.showProgress?.label || "Show Progress"}
                description={strings.settings?.sections?.privacy?.showProgress?.description || "Display your learning progress on your profile"}
                enabled={privacy.showProgress}
                onChange={(value) => setPrivacy({ ...privacy, showProgress: value })}
                icon="📈"
              />
              <SettingToggle
                label={strings.settings?.sections?.privacy?.shareAchievements?.label || "Share Achievements"}
                description={strings.settings?.sections?.privacy?.shareAchievements?.description || "Automatically share achievements with friends"}
                enabled={privacy.shareAchievements}
                onChange={(value) => setPrivacy({ ...privacy, shareAchievements: value })}
                icon="🎖️"
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
              <SettingToggle
                label={strings.settings?.sections?.accessibility?.screenReader?.label || "Screen Reader Support"}
                description={strings.settings?.sections?.accessibility?.screenReader?.description || "Optimize for screen reader compatibility"}
                enabled={accessibility.screenReader}
                onChange={(value) => setAccessibility({ ...accessibility, screenReader: value })}
                icon="🔊"
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
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
              onClick={() => {
                if (confirm(strings.settings?.resetConfirm || 'Are you sure you want to reset all settings to default?')) {
                  localStorage.removeItem('user-preferences')
                  showToast(strings.settings?.resetSuccess || 'Settings reset to default', 'info')
                  router.refresh()
                }
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {strings.settings?.resetButton || 'Reset all settings to default'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}