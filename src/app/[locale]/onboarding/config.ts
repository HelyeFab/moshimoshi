'use client'

import React from 'react'
import {
  PlayIcon,
  SparklesIcon,
  LanguageIcon,
  NewspaperIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  AcademicCapIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  HeartIcon,
  BoltIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline'

// Learning goal types
export type LearningGoal = 'jlpt' | 'travel' | 'anime' | 'conversation'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

// Feature identifiers
export type FeatureId =
  | 'shadowing'
  | 'kanjiConnection'
  | 'kanjiBrowser'
  | 'kanjiMoods'
  | 'conjugation'
  | 'news'
  | 'stories'
  | 'library'
  | 'anki'
  | 'textbooks'
  | 'flashcards'
  | 'drill'

// Feature configuration
export interface FeatureConfig {
  id: FeatureId
  icon: React.ReactNode
  color: string
  route: string
  i18nKey: string
}

// All available features
export const allFeatures: Record<FeatureId, Omit<FeatureConfig, 'id'>> = {
  shadowing: {
    icon: React.createElement(PlayIcon, { className: 'w-12 h-12' }),
    color: 'from-blue-500 to-cyan-500',
    route: '/youtube-shadowing',
    i18nKey: 'shadowing',
  },
  kanjiConnection: {
    icon: React.createElement(SparklesIcon, { className: 'w-12 h-12' }),
    color: 'from-purple-500 to-pink-500',
    route: '/kanji-connection',
    i18nKey: 'kanjiConnection',
  },
  kanjiBrowser: {
    icon: React.createElement(MagnifyingGlassIcon, { className: 'w-12 h-12' }),
    color: 'from-indigo-500 to-purple-500',
    route: '/kanji-browser',
    i18nKey: 'kanjiBrowser',
  },
  kanjiMoods: {
    icon: React.createElement(HeartIcon, { className: 'w-12 h-12' }),
    color: 'from-rose-500 to-pink-500',
    route: '/kanji-moods',
    i18nKey: 'kanjiMoods',
  },
  conjugation: {
    icon: React.createElement(LanguageIcon, { className: 'w-12 h-12' }),
    color: 'from-indigo-500 to-blue-500',
    route: '/learn/conjugation',
    i18nKey: 'conjugation',
  },
  news: {
    icon: React.createElement(NewspaperIcon, { className: 'w-12 h-12' }),
    color: 'from-teal-500 to-cyan-500',
    route: '/news',
    i18nKey: 'news',
  },
  stories: {
    icon: React.createElement(DocumentTextIcon, { className: 'w-12 h-12' }),
    color: 'from-violet-500 to-fuchsia-500',
    route: '/library/stories',
    i18nKey: 'stories',
  },
  library: {
    icon: React.createElement(BuildingLibraryIcon, { className: 'w-12 h-12' }),
    color: 'from-amber-500 to-orange-500',
    route: '/library',
    i18nKey: 'library',
  },
  anki: {
    icon: React.createElement(CloudArrowUpIcon, { className: 'w-12 h-12' }),
    color: 'from-green-500 to-emerald-500',
    route: '/flashcards',
    i18nKey: 'anki',
  },
  textbooks: {
    icon: React.createElement(AcademicCapIcon, { className: 'w-12 h-12' }),
    color: 'from-orange-500 to-red-500',
    route: '/textbook-vocabulary',
    i18nKey: 'textbooks',
  },
  flashcards: {
    icon: React.createElement(BookOpenIcon, { className: 'w-12 h-12' }),
    color: 'from-yellow-500 to-amber-500',
    route: '/flashcards',
    i18nKey: 'flashcards',
  },
  drill: {
    icon: React.createElement(BoltIcon, { className: 'w-12 h-12' }),
    color: 'from-cyan-500 to-blue-500',
    route: '/drill',
    i18nKey: 'drill',
  },
}

// Mapping: Learning Goal → Recommended Features (in priority order)
export const goalToFeatures: Record<LearningGoal, FeatureId[]> = {
  jlpt: ['kanjiConnection', 'kanjiBrowser', 'textbooks', 'drill', 'flashcards'],
  travel: ['news', 'library', 'conjugation', 'stories', 'shadowing'],
  anime: ['shadowing', 'kanjiMoods', 'kanjiConnection', 'stories', 'library'],
  conversation: ['shadowing', 'conjugation', 'drill', 'news', 'library'],
}

// Get recommended features for a goal
export function getRecommendedFeatures(
  goal: LearningGoal | null,
  count: number = 4
): FeatureConfig[] {
  if (!goal || !goalToFeatures[goal]) {
    // Default: show most popular features
    return ['shadowing', 'kanjiConnection', 'library', 'news'].slice(0, count).map(id => ({
      id: id as FeatureId,
      ...allFeatures[id as FeatureId],
    }))
  }

  return goalToFeatures[goal].slice(0, count).map(id => ({
    id,
    ...allFeatures[id],
  }))
}

// Headline for each goal
export const goalHeadlines: Record<LearningGoal, { titleKey: string; subtitleKey: string }> = {
  jlpt: {
    titleKey: 'onboarding.personalizedShowcase.jlpt.title',
    subtitleKey: 'onboarding.personalizedShowcase.jlpt.subtitle',
  },
  travel: {
    titleKey: 'onboarding.personalizedShowcase.travel.title',
    subtitleKey: 'onboarding.personalizedShowcase.travel.subtitle',
  },
  anime: {
    titleKey: 'onboarding.personalizedShowcase.anime.title',
    subtitleKey: 'onboarding.personalizedShowcase.anime.subtitle',
  },
  conversation: {
    titleKey: 'onboarding.personalizedShowcase.conversation.title',
    subtitleKey: 'onboarding.personalizedShowcase.conversation.subtitle',
  },
}
