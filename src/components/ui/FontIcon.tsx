'use client'

import React from 'react'

interface FontIconProps {
  letter: string
  font?: 'playwrite' | 'elms' | 'zen'
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Custom font-based icon component for command palette and navigation
 * Uses custom fonts to display stylized letters as icons
 */
export default function FontIcon({
  letter,
  font = 'playwrite',
  className = '',
  size = 'md'
}: FontIconProps) {
  const fontFamily = {
    playwrite: 'Elms Sans Playwrite',
    elms: 'Elms Sans',
    zen: 'Zen Maru Gothic'
  }

  const sizeClasses = {
    sm: 'text-sm w-4 h-4',
    md: 'text-lg w-5 h-5',
    lg: 'text-xl w-6 h-6'
  }

  return (
    <div
      className={`flex items-center justify-center font-bold ${sizeClasses[size]} ${className}`}
      style={{
        fontFamily: fontFamily[font],
        lineHeight: 1
      }}
    >
      {letter}
    </div>
  )
}

/**
 * Pre-configured font icons for common use cases
 */
export const HiraganaIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="ひ" font="zen" className={className} />
)

export const KatakanaIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="カ" font="zen" className={className} />
)

export const KanjiIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="漢" font="zen" className={className} />
)

export const VocabIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="V" font="playwrite" className={className} />
)

export const DrillIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="D" font="elms" className={className} />
)

export const NewsIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="N" font="elms" className={className} />
)

export const StoryIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="S" font="playwrite" className={className} />
)

export const GamesIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="G" font="playwrite" className={className} />
)

export const ListsIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="L" font="elms" className={className} />
)

export const ConjugationIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="C" font="elms" className={className} />
)

export const ResourcesIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="R" font="elms" className={className} />
)

export const BlogIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="B" font="playwrite" className={className} />
)

export const TodosIcon = ({ className = '' }: { className?: string }) => (
  <FontIcon letter="T" font="elms" className={className} />
)
