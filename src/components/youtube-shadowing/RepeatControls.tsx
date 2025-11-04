'use client';

import React from 'react';
import { ChevronUp, ChevronDown, SkipBack, SkipForward, Repeat } from 'lucide-react';
import { RepeatModeConfig } from '@/types/youtube-player';

interface RepeatControlsProps {
  repeatConfig: RepeatModeConfig;
  onRepeatCountChange: (count: number) => void;
  onPauseDurationChange: (duration: number) => void;
  onSkipPrevious?: () => void;
  onSkipNext?: () => void;
  isPlaying: boolean;
  className?: string;
}

/**
 * Repeat Controls Component for Shadowing Player
 * Theme-aware controls for repeat mode configuration
 */
export default function RepeatControls({
  repeatConfig,
  onRepeatCountChange,
  onPauseDurationChange,
  onSkipPrevious,
  onSkipNext,
  isPlaying,
  className = '',
}: RepeatControlsProps) {
  const handleRepeatIncrement = () => {
    const newCount = Math.min(20, repeatConfig.count + 1);
    onRepeatCountChange(newCount);
  };

  const handleRepeatDecrement = () => {
    const newCount = Math.max(1, repeatConfig.count - 1);
    onRepeatCountChange(newCount);
  };

  const handlePauseIncrement = () => {
    const newDuration = Math.min(3000, repeatConfig.pauseDuration + 500);
    onPauseDurationChange(newDuration);
  };

  const handlePauseDecrement = () => {
    const newDuration = Math.max(500, repeatConfig.pauseDuration - 500);
    onPauseDurationChange(newDuration);
  };

  return (
    <div className={`repeat-controls bg-dark-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-dark-50 text-sm font-semibold flex items-center gap-2">
          <Repeat className="w-4 h-4 text-primary-500" />
          Repeat Settings
        </h3>
        {repeatConfig.enabled && repeatConfig.count > 1 && (
          <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-300 rounded border border-primary-500/30">
            Active: {repeatConfig.currentRepeat + 1}/{repeatConfig.count}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Repeat Count Control */}
        <div className="space-y-2">
          <label className="text-dark-300 text-xs font-medium block">
            Repeat Count
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRepeatDecrement}
              disabled={repeatConfig.count <= 1}
              className="p-2 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed text-dark-50 rounded-lg transition-colors border border-white/10"
              title="Decrease repeat count"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center justify-center bg-dark-900 rounded-lg border border-white/10 px-4 py-2">
              <span className="text-dark-50 text-lg font-semibold font-mono">
                {repeatConfig.count}
              </span>
              <span className="text-dark-400 text-sm ml-1">×</span>
            </div>

            <button
              onClick={handleRepeatIncrement}
              disabled={repeatConfig.count >= 20}
              className="p-2 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed text-dark-50 rounded-lg transition-colors border border-white/10"
              title="Increase repeat count"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <p className="text-dark-400 text-xs">
            {repeatConfig.count === 1
              ? 'No repeats (play once)'
              : `Repeat each segment ${repeatConfig.count} times`}
          </p>
        </div>

        {/* Pause Duration Control */}
        {repeatConfig.count > 1 && (
          <div className="space-y-2">
            <label className="text-dark-300 text-xs font-medium block">
              Pause Between Repeats
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePauseDecrement}
                disabled={repeatConfig.pauseDuration <= 500}
                className="p-2 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed text-dark-50 rounded-lg transition-colors border border-white/10"
                title="Decrease pause duration"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <div className="flex-1 flex items-center justify-center bg-dark-900 rounded-lg border border-white/10 px-4 py-2">
                <span className="text-dark-50 text-lg font-semibold font-mono">
                  {(repeatConfig.pauseDuration / 1000).toFixed(1)}
                </span>
                <span className="text-dark-400 text-sm ml-1">s</span>
              </div>

              <button
                onClick={handlePauseIncrement}
                disabled={repeatConfig.pauseDuration >= 3000}
                className="p-2 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed text-dark-50 rounded-lg transition-colors border border-white/10"
                title="Increase pause duration"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            <p className="text-dark-400 text-xs">
              Pause for {(repeatConfig.pauseDuration / 1000).toFixed(1)}s before repeating
            </p>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="pt-3 border-t border-white/10">
          <label className="text-dark-300 text-xs font-medium block mb-2">
            Segment Navigation
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={onSkipPrevious}
              disabled={!onSkipPrevious}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed text-dark-50 rounded-lg transition-colors border border-white/10"
              title="Previous segment"
            >
              <SkipBack className="w-4 h-4" />
              <span className="text-sm">Previous</span>
            </button>

            <button
              onClick={onSkipNext}
              disabled={!onSkipNext}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed text-dark-50 rounded-lg transition-colors border border-white/10"
              title="Next segment"
            >
              <span className="text-sm">Next</span>
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        {repeatConfig.enabled && isPlaying && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-400">Status:</span>
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Repeat mode active
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
