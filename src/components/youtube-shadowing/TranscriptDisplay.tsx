'use client';

import { useEffect, useState, useRef } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { TranscriptCacheManager } from '@/utils/transcriptCache';
import { motion } from 'framer-motion';

interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

interface TranscriptDisplayProps {
  videoUrl: string;
  audioUrl: string;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
  onTranscriptLoaded: (transcript: TranscriptLine[], videoTitle?: string, videoMetadata?: any) => void;
  onGoBack?: () => void;
}

// Loading messages for YouTube extraction
const YOUTUBE_EXTRACTION_MESSAGES = [
  "🎬 Extracting video information...",
  "🎯 Searching for Japanese subtitles...",
  "🤖 Processing transcript data...",
  "📝 Analyzing speech patterns...",
  "🎌 Detecting Japanese content...",
  "✨ Almost ready for practice...",
  "🚀 Finalizing your session..."
];

// Cache hit messages
const CACHE_HIT_MESSAGES = [
  "⚡ Found cached transcript!",
  "💾 Loading saved transcript...",
  "🎯 Retrieved from cache!"
];

export default function TranscriptDisplay({
  videoUrl,
  audioUrl,
  fileInfo,
  onTranscriptLoaded,
  onGoBack
}: TranscriptDisplayProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const { t, strings } = useI18n();
  const { user } = useAuth();
  const { hasAccess } = useSubscription();

  const loadingMessageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageIndexRef = useRef(0);

  useEffect(() => {
    loadTranscript();

    // Cleanup on unmount
    return () => {
      if (loadingMessageIntervalRef.current) {
        clearInterval(loadingMessageIntervalRef.current);
      }
    };
  }, [videoUrl]);

  // Rotate loading messages when status is loading
  useEffect(() => {
    if (status === 'loading' && audioUrl === 'youtube-player') {
      // Start with first message
      setLoadingMessage(YOUTUBE_EXTRACTION_MESSAGES[0]);
      messageIndexRef.current = 0;

      // Rotate through messages
      loadingMessageIntervalRef.current = setInterval(() => {
        messageIndexRef.current = (messageIndexRef.current + 1) % YOUTUBE_EXTRACTION_MESSAGES.length;
        setLoadingMessage(YOUTUBE_EXTRACTION_MESSAGES[messageIndexRef.current]);
      }, 2500);
    } else {
      // Clear interval when not loading
      if (loadingMessageIntervalRef.current) {
        clearInterval(loadingMessageIntervalRef.current);
        loadingMessageIntervalRef.current = null;
      }
    }

    return () => {
      if (loadingMessageIntervalRef.current) {
        clearInterval(loadingMessageIntervalRef.current);
      }
    };
  }, [status, audioUrl]);

  const loadTranscript = async () => {
    setStatus('loading');
    setError(null);

    // Generate content ID for cache lookup
    let contentId: string = '';

    try {
      if (videoUrl && !fileInfo) {
        // YouTube video
        contentId = TranscriptCacheManager.generateContentId({
          type: 'youtube',
          videoUrl: videoUrl
        });
      } else if (fileInfo) {
        // Uploaded file
        contentId = TranscriptCacheManager.generateContentId({
          type: fileInfo.type.startsWith('video/') ? 'video' : 'audio',
          fileName: fileInfo.name,
          fileSize: fileInfo.size
        });
      }

      // Check cache first
      if (contentId && !contentId.startsWith('unknown_')) {
        const cachedTranscript = await TranscriptCacheManager.getCachedTranscript(contentId);

        if (cachedTranscript && cachedTranscript.transcript.length > 0) {
          setLoadingMessage(CACHE_HIT_MESSAGES[0]);

          // Include formatted transcript if available
          const enrichedMetadata = {
            ...cachedTranscript.metadata,
            formattedTranscript: cachedTranscript.formattedTranscript,
            hasFormattedVersion: !!cachedTranscript.formattedTranscript
          };

          // Use AI-formatted transcript if available, otherwise raw
          const transcriptToUse = cachedTranscript.formattedTranscript || cachedTranscript.transcript;

          setStatus('completed');
          onTranscriptLoaded(transcriptToUse, cachedTranscript.videoTitle, enrichedMetadata);
          return;
        }
      }

      // For YouTube videos, extract transcript
      if (audioUrl === 'youtube-player') {
        const response = await fetch('/api/youtube/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoUrl })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('completed');
          onTranscriptLoaded(
            data.formattedTranscript || data.transcript,
            data.videoTitle,
            data.videoMetadata
          );
        } else {
          throw new Error(data.message || strings.youtubeShadowing.errors.transcriptFailed);
        }
      } else {
        // For uploaded files, we'd need additional processing
        // For now, show a message
        setStatus('error');
        setError('File transcript generation is not yet implemented');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || strings.youtubeShadowing.errors.transcriptFailed);
      console.error('Transcript loading error:', err);
    }
  };

  const retry = () => {
    setRetryCount(prev => prev + 1);
    loadTranscript();
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-700">
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {strings.youtubeShadowing.player.generatingTranscript}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {loadingMessage}
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5">
            <motion.div
              className="bg-primary-500 h-1.5 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '75%' }}
              transition={{ duration: 10, ease: 'easeInOut' }}
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            This may take 20-30 seconds for the first time...
          </p>
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
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
              {retryCount > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Attempt {retryCount + 1} - Sometimes it works on retry
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={retry}
              className="flex-1 px-4 py-2 bg-primary-500 text-white font-medium rounded-lg
                       hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                       focus:ring-offset-2 transition-colors dark:focus:ring-offset-dark-800"
            >
              {t('common.retry')}
            </button>
            {onGoBack && (
              <button
                onClick={onGoBack}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-700
                         dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300
                         dark:hover:bg-dark-600 focus:outline-none focus:ring-2
                         focus:ring-gray-500 focus:ring-offset-2 transition-colors
                         dark:focus:ring-offset-dark-800"
              >
                {t('common.back')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}