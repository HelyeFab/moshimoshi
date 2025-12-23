'use client'

/**
 * RubyText Component
 *
 * Renders Japanese text with ruby tags (furigana) and allows toggling furigana visibility.
 * Expects text in format: <ruby>漢字<rt>かんじ</rt></ruby>
 */

import React from 'react'

interface RubyTextProps {
  /** Text containing ruby tags */
  text: string
  /** Whether to show furigana readings */
  showFurigana: boolean
  /** Additional CSS classes */
  className?: string
}

export function RubyText({ text, showFurigana, className = '' }: RubyTextProps) {
  console.log('[RubyText] Rendering:', { text: text.substring(0, 50), showFurigana })

  return (
    <>
      {/* Dynamic style tag for furigana visibility */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .ruby-text-container-${showFurigana ? 'show' : 'hide'} rt {
            display: ${showFurigana ? 'inline' : 'none'} !important;
          }
          .ruby-text-container-${showFurigana ? 'show' : 'hide'} ruby {
            ruby-position: over;
          }
        `
      }} />
      <div
        className={`ruby-text-container-${showFurigana ? 'show' : 'hide'} text-lg font-medium text-white ${className}`}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </>
  )
}
