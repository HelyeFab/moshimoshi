'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { ShadowingRepeatConfig } from '../types';

interface RepeatControlsProps {
  repeatConfig: ShadowingRepeatConfig;
  onRepeatCountChange: (count: number) => void;
  onPauseDurationChange: (duration: number) => void;
  isPlaying?: boolean;
  variant?: 'buttons' | 'sliders'; // News uses buttons, Stories uses sliders
  className?: string;

  // Style customization for different contexts
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
    disabled?: string;
  };
}

export default function RepeatControls({
  repeatConfig,
  onRepeatCountChange,
  onPauseDurationChange,
  isPlaying = false,
  variant = 'buttons',
  className = '',
  colors = {}
}: RepeatControlsProps) {
  const { t } = useI18n();

  // Default colors that work in both contexts
  const defaultColors = {
    primary: colors.primary || 'rgb(var(--palette-primary-500))',
    secondary: colors.secondary || 'rgb(var(--palette-primary-600))',
    background: colors.background || 'var(--article-accent-bg)',
    text: colors.text || 'var(--article-text)',
    disabled: colors.disabled || 'var(--article-text-secondary)'
  };

  const ButtonVariant = () => (
    <div className="space-y-6">
      {/* Repeat Count - YouTube Style */}
      <div className="flex flex-col items-center gap-4">
        <span className="text-lg font-semibold" style={{ color: defaultColors.text }}>
          {t('news.reader.repeatCount')}
        </span>

        {/* Counter Display with +/- Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onRepeatCountChange(repeatConfig.count - 1)}
            disabled={repeatConfig.count <= 1}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              backgroundColor: repeatConfig.count <= 1
                ? defaultColors.background
                : `${defaultColors.primary}15`,
              color: repeatConfig.count <= 1
                ? defaultColors.disabled
                : defaultColors.secondary
            }}
            title="Decrease repeat count"
            aria-label="Decrease repeat count"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center">
            <div className="text-4xl font-bold tabular-nums" style={{ color: defaultColors.secondary }}>
              {repeatConfig.count}
            </div>
            <div className="text-xs font-medium" style={{ color: defaultColors.disabled }}>
              {repeatConfig.count === 1 ? 'time' : 'times'}
            </div>
            {/* Progress indicator during playback */}
            {isPlaying && repeatConfig.count > 1 && (
              <div
                className="text-xs mt-1"
                style={{ color: defaultColors.secondary }}
                aria-live="polite"
              >
                {repeatConfig.currentRepeat + 1}/{repeatConfig.count}
              </div>
            )}
          </div>

          <button
            onClick={() => onRepeatCountChange(repeatConfig.count + 1)}
            disabled={repeatConfig.count >= 20}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              backgroundColor: repeatConfig.count >= 20
                ? defaultColors.background
                : `${defaultColors.primary}15`,
              color: repeatConfig.count >= 20
                ? defaultColors.disabled
                : defaultColors.secondary
            }}
            title="Increase repeat count"
            aria-label="Increase repeat count"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Select Buttons */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-center" style={{ color: defaultColors.disabled }}>
            Quick Select
          </div>
          <div className="flex gap-2" role="group" aria-label="Quick repeat count selection">
            {[1, 2, 3, 5, 10].map(count => (
              <button
                key={count}
                onClick={() => onRepeatCountChange(count)}
                className="w-12 h-9 rounded-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-sm"
                style={{
                  backgroundColor: repeatConfig.count === count
                    ? defaultColors.primary
                    : defaultColors.background,
                  color: repeatConfig.count === count ? 'white' : defaultColors.text,
                  ...(repeatConfig.count === count && {
                    boxShadow: `0 4px 12px ${defaultColors.primary}30`,
                    border: `2px solid ${defaultColors.primary}50`
                  })
                }}
                aria-label={`Set repeat count to ${count}`}
                aria-pressed={repeatConfig.count === count}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pause Duration Controls */}
      {repeatConfig.count > 1 && (
        <div className="flex flex-col items-center gap-4">
          <span className="text-lg font-semibold" style={{ color: defaultColors.text }}>
            Pause Between Repeats
          </span>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => onPauseDurationChange(repeatConfig.pauseDuration - 500)}
              disabled={repeatConfig.pauseDuration <= 500}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                backgroundColor: repeatConfig.pauseDuration <= 500
                  ? defaultColors.background
                  : `${defaultColors.primary}15`,
                color: repeatConfig.pauseDuration <= 500
                  ? defaultColors.disabled
                  : defaultColors.secondary
              }}
              title="Decrease pause duration"
              aria-label="Decrease pause duration"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center">
              <div className="text-4xl font-bold tabular-nums" style={{ color: defaultColors.secondary }}>
                {(repeatConfig.pauseDuration / 1000).toFixed(1)}
              </div>
              <div className="text-xs font-medium" style={{ color: defaultColors.disabled }}>
                seconds
              </div>
            </div>

            <button
              onClick={() => onPauseDurationChange(repeatConfig.pauseDuration + 500)}
              disabled={repeatConfig.pauseDuration >= 5000}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                backgroundColor: repeatConfig.pauseDuration >= 5000
                  ? defaultColors.background
                  : `${defaultColors.primary}15`,
                color: repeatConfig.pauseDuration >= 5000
                  ? defaultColors.disabled
                  : defaultColors.secondary
              }}
              title="Increase pause duration"
              aria-label="Increase pause duration"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Select for Pause Duration */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-center" style={{ color: defaultColors.disabled }}>
              Quick Select
            </div>
            <div className="flex gap-2" role="group" aria-label="Quick pause duration selection">
              {[0.5, 1.0, 1.5, 2.0, 3.0].map(seconds => (
                <button
                  key={seconds}
                  onClick={() => onPauseDurationChange(seconds * 1000)}
                  className="w-12 h-9 rounded-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-xs"
                  style={{
                    backgroundColor: repeatConfig.pauseDuration === seconds * 1000
                      ? defaultColors.primary
                      : defaultColors.background,
                    color: repeatConfig.pauseDuration === seconds * 1000 ? 'white' : defaultColors.text,
                    ...(repeatConfig.pauseDuration === seconds * 1000 && {
                      boxShadow: `0 4px 12px ${defaultColors.primary}30`,
                      border: `2px solid ${defaultColors.primary}50`
                    })
                  }}
                  aria-label={`Set pause duration to ${seconds} seconds`}
                  aria-pressed={repeatConfig.pauseDuration === seconds * 1000}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const SliderVariant = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Repeat Count Slider */}
      <div>
        <label className="text-sm font-medium mb-2 block text-muted-foreground">
          {t('shadowing.repeatCount')}: {repeatConfig.count}
          {isPlaying && repeatConfig.count > 1 && (
            <span
              className="ml-2 text-primary-500"
              aria-live="polite"
            >
              ({repeatConfig.currentRepeat + 1}/{repeatConfig.count})
            </span>
          )}
        </label>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={repeatConfig.count}
          onChange={(e) => onRepeatCountChange(parseInt(e.target.value))}
          className="w-full"
          aria-label={`Repeat count: ${repeatConfig.count}`}
          aria-valuetext={`${repeatConfig.count} ${repeatConfig.count === 1 ? 'time' : 'times'}`}
        />
      </div>

      {/* Pause Duration Slider */}
      <div>
        <label className="text-sm font-medium mb-2 block text-muted-foreground">
          {t('shadowing.pauseDuration')}: {repeatConfig.pauseDuration / 1000}s
        </label>
        <input
          type="range"
          min="500"
          max="5000"
          step="500"
          value={repeatConfig.pauseDuration}
          onChange={(e) => onPauseDurationChange(parseInt(e.target.value))}
          className="w-full"
          aria-label={`Pause duration: ${repeatConfig.pauseDuration / 1000} seconds`}
          aria-valuetext={`${repeatConfig.pauseDuration / 1000} seconds`}
        />
      </div>
    </div>
  );

  return (
    <div className={className} role="group" aria-label="Repeat controls">
      {variant === 'buttons' ? <ButtonVariant /> : <SliderVariant />}

      {/* Live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {isPlaying && repeatConfig.count > 1 &&
          `Repeat ${repeatConfig.currentRepeat + 1} of ${repeatConfig.count}`
        }
      </div>
    </div>
  );
}