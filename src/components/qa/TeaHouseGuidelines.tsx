'use client'

import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

interface TeaHouseGuidelinesProps {
  compact?: boolean // If true, shows condensed version for welcome modal
}

/**
 * Tea House Guidelines Content
 * Can be shown in full or condensed format
 */
export default function TeaHouseGuidelines({ compact = false }: TeaHouseGuidelinesProps) {
  const { t } = useI18n()

  if (compact) {
    // Condensed version for welcome modal
    return (
      <div className="space-y-6">
        {/* Welcome */}
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            🍵 {t('teaHouse.guidelines.welcome.title')}
          </h2>
          <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            {t('teaHouse.guidelines.welcome.subtitle')}
          </p>
        </div>

        {/* Key Points */}
        <div className="grid grid-cols-1 gap-4">
          {/* What it's for */}
          <div className="p-5 sm:p-6 rounded-xl bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700">
            <h3 className="text-lg sm:text-xl font-bold text-green-900 dark:text-green-200 mb-3 flex items-center gap-2">
              ✅ {t('teaHouse.guidelines.whatFor.title')}
            </h3>
            <ul className="space-y-2.5 text-base text-green-900 dark:text-green-100">
              <li>• {t('teaHouse.guidelines.whatFor.point1')}</li>
              <li>• {t('teaHouse.guidelines.whatFor.point2')}</li>
              <li>• {t('teaHouse.guidelines.whatFor.point3')}</li>
            </ul>
          </div>

          {/* What it's not for */}
          <div className="p-5 sm:p-6 rounded-xl bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700">
            <h3 className="text-lg sm:text-xl font-bold text-red-900 dark:text-red-200 mb-3 flex items-center gap-2">
              🚫 {t('teaHouse.guidelines.whatNotFor.title')}
            </h3>
            <ul className="space-y-2.5 text-base text-red-900 dark:text-red-100">
              <li>• {t('teaHouse.guidelines.whatNotFor.point1')}</li>
              <li>• {t('teaHouse.guidelines.whatNotFor.point2')}</li>
              <li>• {t('teaHouse.guidelines.whatNotFor.point3')}</li>
            </ul>
          </div>
        </div>

        {/* Core Principle */}
        <div className="text-center p-5 sm:p-6 rounded-xl bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700">
          <p className="text-base sm:text-lg text-purple-900 dark:text-purple-100 font-semibold leading-relaxed">
            🌱 {t('teaHouse.guidelines.corePrinciple')}
          </p>
        </div>
      </div>
    )
  }

  // Full version for acknowledgment modal
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          🍵 {t('teaHouse.guidelines.welcome.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('teaHouse.guidelines.welcome.description')}
        </p>
      </div>

      {/* What it's for */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          ✅ {t('teaHouse.guidelines.whatFor.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {t('teaHouse.guidelines.whatFor.intro')}
        </p>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatFor.point1')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatFor.point2')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatFor.point3')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatFor.point4')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatFor.point5')}</span>
          </li>
        </ul>
      </div>

      {/* What it's not for */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          🚫 {t('teaHouse.guidelines.whatNotFor.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {t('teaHouse.guidelines.whatNotFor.intro')}
        </p>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatNotFor.point1')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatNotFor.point2')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatNotFor.point3')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatNotFor.point4')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatNotFor.point5')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatNotFor.point6')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.whatNotFor.point7')}</span>
          </li>
        </ul>
      </div>

      {/* How we treat each other */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          🌱 {t('teaHouse.guidelines.conduct.title')}
        </h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.conduct.point1')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.conduct.point2')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.conduct.point3')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.conduct.point4')}</span>
          </li>
        </ul>
        <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-3">
          {t('teaHouse.guidelines.conduct.noStupidQuestions')}
        </p>
      </div>

      {/* Moderation */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          🛡️ {t('teaHouse.guidelines.moderation.title')}
        </h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.moderation.point1')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.moderation.point2')}</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>{t('teaHouse.guidelines.moderation.point3')}</span>
          </li>
        </ul>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 italic">
          {t('teaHouse.guidelines.moderation.purpose')}
        </p>
      </div>

      {/* Closing */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary-50 to-sakura-50 dark:from-primary-900/20 dark:to-sakura-900/20 border border-primary-200 dark:border-primary-800">
        <p className="text-center text-sm text-gray-700 dark:text-gray-300 font-medium">
          💛 {t('teaHouse.guidelines.closing')}
        </p>
      </div>
    </div>
  )
}
