'use client';

import React, { useState, useEffect } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { TTSOptions } from '@/lib/tts/types';
import { useI18n } from '@/i18n/I18nContext';
import Dropdown from '@/components/ui/Dropdown';

interface AudioPlayerProps {
  text: string;
  showControls?: boolean;
  showProgress?: boolean;
  showTime?: boolean;
  showSpeed?: boolean;
  showVolume?: boolean;
  className?: string;
  options?: TTSOptions;
  autoPlay?: boolean;
}

export default function AudioPlayer({
  text,
  showControls = true,
  showProgress = true,
  showTime = false,
  showSpeed = false,
  showVolume = false,
  className = '',
  options,
  autoPlay = false,
}: AudioPlayerProps) {
  const { strings } = useI18n();
  const { play, pause, resume, stop, playing, loading, audioRef } = useTTS({
    autoPlay,
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [audioRef.current]);

  useEffect(() => {
    if (autoPlay && text) {
      play(text, options);
    }
  }, [text, autoPlay]);

  const handlePlayPause = async () => {
    if (playing) {
      pause();
    } else if (currentTime > 0 && currentTime < duration) {
      resume();
    } else {
      await play(text, options);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value);
    setSpeed(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm ${className}`}>
      {showControls && (
        <div className="flex items-center gap-3 mb-3">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={loading}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
            aria-label={playing ? (strings.common?.pause || 'Pause') : (strings.common?.play || 'Play')}
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Stop Button */}
          <button
            onClick={stop}
            disabled={!playing && currentTime === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label={strings.common?.stop || 'Stop'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>

          {/* Time Display */}
          {showTime && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-3">
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, rgb(var(--palette-primary-500)) ${progressPercentage}%, rgb(229, 231, 235) ${progressPercentage}%)`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Speed Control */}
        {showSpeed && (
          <div className="flex items-center gap-2">
            <Dropdown
              label={strings.common?.speed || 'Speed'}
              value={String(speed)}
              onChange={(value) => {
                const rate = parseFloat(value);
                setSpeed(rate);
                if (audioRef.current) {
                  audioRef.current.playbackRate = rate;
                }
              }}
              size="small"
              options={[
                { value: '0.5', label: '0.5x' },
                { value: '0.75', label: '0.75x' },
                { value: '1', label: '1x' },
                { value: '1.25', label: '1.25x' },
                { value: '1.5', label: '1.5x' },
                { value: '2', label: '2x' },
              ]}
            />
          </div>
        )}

        {/* Volume Control */}
        {showVolume && (
          <div className="flex items-center gap-2 flex-1">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5L6 9H2v6h4l5 4V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}