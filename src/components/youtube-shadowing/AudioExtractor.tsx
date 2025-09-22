'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';

interface AudioExtractorProps {
  videoUrl: string;
  onAudioExtracted: (audioUrl: string, title?: string) => void;
}

export default function AudioExtractor({ videoUrl, onAudioExtracted }: AudioExtractorProps) {
  const [status, setStatus] = useState<'idle' | 'extracting' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { t, strings } = useI18n();

  useEffect(() => {
    extractAudio();
  }, [videoUrl]);

  const extractAudio = async () => {
    setStatus('extracting');
    setError(null);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // For YouTube videos, we skip extraction and use embedded player
      // This is because YouTube blocks most cloud servers
      await new Promise(resolve => setTimeout(resolve, 1000));
      clearInterval(progressInterval);

      const videoIdMatch = videoUrl.match(/[?&]v=([^&]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : '';

      setProgress(100);
      setStatus('completed');

      // Pass empty audio URL to signal we'll use YouTube player
      setTimeout(() => {
        onAudioExtracted('youtube-player', `YouTube Video ${videoId}`);
      }, 500);

    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : strings.youtubeShadowing.errors.extractFailed);
      console.error('Audio extraction error:', err);
    }
  };

  const retry = () => {
    setProgress(0);
    extractAudio();
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6">
      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
        {strings.youtubeShadowing.player.extractingAudio}
      </h3>

      {status === 'extracting' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('common.processing')}
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'completed' && (
        <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">
            {strings.youtubeShadowing.player.ready}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          </div>
          <button
            onClick={retry}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700
                     dark:hover:text-primary-300 underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}
    </div>
  );
}