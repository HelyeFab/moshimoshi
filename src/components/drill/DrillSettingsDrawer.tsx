'use client'

import React from 'react'
import Drawer from '@/components/ui/Drawer'
import SettingToggle from '@/components/ui/SettingToggle'
import { SlidersHorizontal, Hash, Languages, GraduationCap, Layers, Zap } from 'lucide-react'
import type { DrillSettings } from '@/types/drill'

// ─── Conjugation form presets ────────────────────────────────────────
const FORM_PRESETS: Record<string, string[]> = {
  basic: ['present', 'past', 'negative', 'pastNegative'],
  polite: ['polite', 'politePast', 'politeNegative', 'politePastNegative'],
  teForm: ['teForm', 'negativeTeForm', 'naiDeForm'],
  potential: ['potential', 'potentialNegative', 'potentialPast', 'potentialPastNegative'],
  passive: ['passive', 'passiveNegative', 'passivePast', 'passivePastNegative'],
  causative: ['causative', 'causativeNegative', 'causativePast', 'causativePastNegative'],
}

const PRESET_ICONS: Record<string, string> = {
  basic: '📝',
  polite: '🎩',
  teForm: '🔗',
  potential: '💪',
  passive: '🪞',
  causative: '🫵',
}

const JLPT_COLORS: Record<string, { bg: string; border: string; text: string; selectedBg: string }> = {
  N5: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', selectedBg: 'bg-emerald-500 dark:bg-emerald-600' },
  N4: { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-300 dark:border-sky-700', text: 'text-sky-700 dark:text-sky-300', selectedBg: 'bg-sky-500 dark:bg-sky-600' },
  N3: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', selectedBg: 'bg-amber-500 dark:bg-amber-600' },
  N2: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', selectedBg: 'bg-orange-500 dark:bg-orange-600' },
  N1: { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300', selectedBg: 'bg-rose-500 dark:bg-rose-600' },
}

// ─── Props ────────────────────────────────────────────────────────────
interface DrillSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  settings: DrillSettings
  onSettingsChange: (updater: (prev: DrillSettings) => DrillSettings) => void
  questionLimits: { min: number; max: number; default: number }
  isHydrated: boolean
  isPremium: boolean
  t: (key: string, params?: Record<string, string | number>) => string
  strings: any
}

// ─── Section wrapper ──────────────────────────────────────────────────
function Section({
  icon,
  title,
  subtitle,
  children,
  noBorder,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  noBorder?: boolean
}) {
  return (
    <div className={`py-5 ${noBorder ? '' : 'border-b border-gray-100 dark:border-dark-700/50'}`}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────
export default function DrillSettingsDrawer({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  questionLimits,
  isHydrated,
  t,
  strings,
}: DrillSettingsDrawerProps) {

  // ── i18n-aware options ──
  const wordTypeOptions: { value: 'all' | 'verbs' | 'adjectives'; label: string; icon: string; desc: string }[] = [
    { value: 'all', label: t('drill.allTypes'), icon: '🔤', desc: t('drill.verbsAndAdjectives') },
    { value: 'verbs', label: t('drill.verbs'), icon: '🏃', desc: t('drill.actionWords') },
    { value: 'adjectives', label: t('drill.adjectives'), icon: '🎨', desc: t('drill.descriptiveWords') },
  ]

  const presetKeys = ['basic', 'polite', 'teForm', 'potential', 'passive', 'causative'] as const

  // ── Conjugation form helpers ──
  const isPresetSelected = (presetKey: string) => {
    const preset = FORM_PRESETS[presetKey]
    if (!preset || !settings.conjugationForms?.length) return false
    return preset.every(form => settings.conjugationForms?.includes(form))
  }

  const togglePreset = (presetKey: string) => {
    const preset = FORM_PRESETS[presetKey]
    if (!preset) return

    onSettingsChange(prev => {
      const current = new Set(prev.conjugationForms || [])
      const hasAll = preset.every(form => current.has(form))

      if (hasAll) {
        preset.forEach(form => current.delete(form))
      } else {
        preset.forEach(form => current.add(form))
      }

      const next = Array.from(current)
      return { ...prev, conjugationForms: next.length > 0 ? next : [] }
    })
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title=""
      position="right"
      size="large"
      className="!bg-white dark:!bg-dark-850 !rounded-l-2xl overflow-hidden flex flex-col"
    >
      {/* ── Custom header ── */}
      <div className="-mx-4 -mt-4 px-5 pt-5 pb-4 bg-gradient-to-br from-primary-500/10 via-primary-400/5 to-transparent dark:from-primary-600/15 dark:via-primary-500/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500/15 dark:bg-primary-400/15">
            <SlidersHorizontal className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t('drill.settings')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('drill.settingsDescription')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Question Count ── */}
      <Section
        icon={<Hash className="w-4 h-4" />}
        title={t('drill.questionsPerSession')}
        subtitle={t('drill.questionsRange', { min: questionLimits.min, max: questionLimits.max })}
      >
        {isHydrated && (
          <div className="space-y-3">
            {/* Quick presets */}
            <div className="flex gap-2 flex-wrap">
              {(() => {
                const presets = [5, 10, 15, 20, questionLimits.max]
                const unique = [...new Set(presets.filter(p => p >= questionLimits.min && p <= questionLimits.max))].sort((a, b) => a - b)
                return unique.map(preset => (
                  <button
                    key={preset}
                    onClick={() => onSettingsChange(prev => ({ ...prev, questionsPerSession: preset }))}
                    className={`
                      min-w-[3rem] px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                      ${settings.questionsPerSession === preset
                        ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25 scale-105'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 active:scale-95'
                      }
                    `}
                  >
                    {preset}
                  </button>
                ))
              })()}
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-3 p-2.5 bg-gray-50 dark:bg-dark-800 rounded-xl">
              <button
                onClick={() => onSettingsChange(prev => ({
                  ...prev,
                  questionsPerSession: Math.max(questionLimits.min, prev.questionsPerSession - 1),
                }))}
                disabled={settings.questionsPerSession <= questionLimits.min}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <span className="text-lg font-semibold text-gray-600 dark:text-gray-300 leading-none">−</span>
              </button>

              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums min-w-[2.5rem] text-center">
                  {settings.questionsPerSession}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
                  {t('drill.questionsLabel')}
                </span>
              </div>

              <button
                onClick={() => onSettingsChange(prev => ({
                  ...prev,
                  questionsPerSession: Math.min(questionLimits.max, prev.questionsPerSession + 1),
                }))}
                disabled={settings.questionsPerSession >= questionLimits.max}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <span className="text-lg font-semibold text-gray-600 dark:text-gray-300 leading-none">+</span>
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* ── Word Type ── */}
      <Section
        icon={<Languages className="w-4 h-4" />}
        title={t('drill.wordTypeFilter')}
      >
        <div className="grid grid-cols-3 gap-2">
          {wordTypeOptions.map(opt => {
            const isSelected = settings.wordTypeFilter === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onSettingsChange(prev => ({ ...prev, wordTypeFilter: opt.value }))}
                className={`
                  flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-200
                  ${isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md shadow-primary-500/10'
                    : 'border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 hover:border-gray-300 dark:hover:border-dark-500'
                  }
                `}
              >
                <span className="text-xl">{opt.icon}</span>
                <span className={`text-xs font-semibold leading-tight ${
                  isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {opt.label}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                  {opt.desc}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── JLPT Level ── */}
      <Section
        icon={<GraduationCap className="w-4 h-4" />}
        title={t('drill.jlptLevel')}
        subtitle={t('drill.selectOneOrMore')}
      >
        <div className="flex gap-2">
          {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => {
            const isSelected = settings.jlptLevels?.includes(level)
            const colors = JLPT_COLORS[level]
            return (
              <button
                key={level}
                onClick={() => {
                  onSettingsChange(prev => {
                    const current = prev.jlptLevels || []
                    const selected = current.includes(level)
                    if (selected) {
                      const next = current.filter(l => l !== level)
                      return { ...prev, jlptLevels: next.length > 0 ? next : [level] }
                    }
                    return { ...prev, jlptLevels: [...current, level] }
                  })
                }}
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border-2
                  ${isSelected
                    ? `${colors.selectedBg} text-white border-transparent shadow-md`
                    : `${colors.bg} ${colors.border} ${colors.text} hover:shadow-sm active:scale-95`
                  }
                `}
              >
                {level}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Conjugation Forms ── */}
      <Section
        icon={<Layers className="w-4 h-4" />}
        title={t('drill.conjugationForms')}
        subtitle={
          settings.conjugationForms && settings.conjugationForms.length > 0
            ? t('drill.formsSelected', { count: settings.conjugationForms.length })
            : t('drill.allFormsEnabled')
        }
      >
        <div className="space-y-2">
          {/* All forms toggle */}
          <button
            onClick={() => onSettingsChange(prev => ({ ...prev, conjugationForms: [] }))}
            className={`
              w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2
              ${!settings.conjugationForms?.length
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-dark-500'
              }
            `}
          >
            ✨ {t('drill.allForms')}
          </button>

          {/* Preset grid */}
          <div className="grid grid-cols-2 gap-2">
            {presetKeys.map(key => {
              const selected = isPresetSelected(key)
              return (
                <button
                  key={key}
                  onClick={() => togglePreset(key)}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border-2
                    ${selected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-dark-500'
                    }
                  `}
                >
                  <span className="text-base">{PRESET_ICONS[key]}</span>
                  <span>{t(`drill.formPresets.${key}`)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── Auto-advance ── */}
      <div className="py-3">
        <SettingToggle
          label={t('drill.autoAdvance')}
          description={t('drill.autoAdvanceDescription')}
          icon={<Zap className="w-5 h-5 text-amber-500" />}
          enabled={settings.autoAdvance}
          onChange={(value) => onSettingsChange(prev => ({ ...prev, autoAdvance: value }))}
          className="!border-0 !py-2"
        />
      </div>

      {/* ── Apply button ── */}
      <div className="pt-4 pb-2">
        <button
          onClick={onClose}
          className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 active:scale-[0.98]"
        >
          {t('drill.done')}
        </button>
      </div>
    </Drawer>
  )
}

// ─── Settings Summary Chips ─────────────────────────────────────────
// Displayed on the main setup page to show current config at a glance.
export function DrillSettingsSummary({
  settings,
  onOpenDrawer,
  t,
}: {
  settings: DrillSettings
  onOpenDrawer: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const chips: { label: string; color: string }[] = []

  // Question count
  chips.push({
    label: t('drill.questionsShort', { count: settings.questionsPerSession }),
    color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  })

  // Word type
  const wordTypeLabel =
    settings.wordTypeFilter === 'all'
      ? t('drill.allTypes')
      : settings.wordTypeFilter === 'verbs'
        ? t('drill.verbs')
        : t('drill.adjectives')
  chips.push({
    label: wordTypeLabel,
    color: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  })

  // JLPT
  const jlptLabel = settings.jlptLevels?.length
    ? settings.jlptLevels.sort().join(', ')
    : 'N5, N4'
  chips.push({
    label: jlptLabel,
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  })

  // Conjugation forms
  const formLabel =
    !settings.conjugationForms?.length
      ? t('drill.allForms')
      : t('drill.formsCount', { count: settings.conjugationForms.length })
  chips.push({
    label: formLabel,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  })

  // Auto-advance
  chips.push({
    label: settings.autoAdvance ? t('drill.autoAdvance') : t('drill.manualAdvance'),
    color: settings.autoAdvance
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  })

  return (
    <button
      onClick={onOpenDrawer}
      className="w-full group"
    >
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-800/80 border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-sm">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 group-hover:bg-primary-200 dark:group-hover:bg-primary-800/40 transition-colors flex-shrink-0">
          <SlidersHorizontal className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip, i) => (
              <span
                key={i}
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${chip.color}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
        <svg
          className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-500 transition-colors flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
