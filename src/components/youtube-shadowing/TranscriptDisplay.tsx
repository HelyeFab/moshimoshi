'use client';

import { useEffect, useState, useRef } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { TranscriptCacheManager } from '@/utils/transcriptCache';
import { motion } from 'framer-motion';

interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
  translation?: string;
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
  const [formattingPending, setFormattingPending] = useState(false);
  const { t, strings } = useI18n();
  const { user, isGuest } = useAuth();
  const loadingMessageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageIndexRef = useRef(0);
  const formattedPollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptsRef = useRef(0);
  const contentIdRef = useRef<string>('');

  useEffect(() => {
    loadTranscript();

    // Cleanup on unmount
    return () => {
      if (loadingMessageIntervalRef.current) {
        clearInterval(loadingMessageIntervalRef.current);
      }
      if (formattedPollingTimeoutRef.current) {
        clearTimeout(formattedPollingTimeoutRef.current);
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
      if (formattedPollingTimeoutRef.current) {
        clearTimeout(formattedPollingTimeoutRef.current);
      }
    };
  }, [status, audioUrl]);

  const scheduleFormattedPolling = (contentId: string) => {
    if (!user?.uid || isGuest) return;
    if (!contentId) return;

    if (formattedPollingTimeoutRef.current) {
      clearTimeout(formattedPollingTimeoutRef.current);
    }

    formattedPollingTimeoutRef.current = setTimeout(async () => {
      try {
        pollAttemptsRef.current += 1;
        const cachedTranscript = await TranscriptCacheManager.getCachedTranscript(contentId);

        if (cachedTranscript?.formattedTranscript && cachedTranscript.formattedTranscript.length > 0) {
          setFormattingPending(false);
          pollAttemptsRef.current = 0;

          const enrichedMetadata = {
            ...cachedTranscript.metadata,
            formattedTranscript: cachedTranscript.formattedTranscript,
            hasFormattedVersion: true
          };

          onTranscriptLoaded(
            cachedTranscript.formattedTranscript,
            cachedTranscript.videoTitle,
            enrichedMetadata
          );
          return;
        }

        if (pollAttemptsRef.current < 6) {
          scheduleFormattedPolling(contentId);
        } else {
          setFormattingPending(false);
        }
      } catch (err) {
        console.error('Formatted transcript polling error:', err);
        if (pollAttemptsRef.current < 6) {
          scheduleFormattedPolling(contentId);
        } else {
          setFormattingPending(false);
        }
      }
    }, 5000);
  };

  const mapNativeSegments = (segments: any[]): TranscriptLine[] =>
    (segments || []).map((segment: any, index: number) => ({
      id: segment.id ?? String(index + 1),
      text: segment.text ?? '',
      startTime: typeof segment.start === 'number' ? segment.start : 0,
      endTime: typeof segment.end === 'number' ? segment.end : segment.start ?? 0,
      words: segment.text ? segment.text.split(/[\s、。！？]/g).filter((w: string) => w.length > 0) : []
    }));

  const fetchNativeTranscript = async (videoId: string, contentId: string, isAuthenticated: boolean) => {
    try {
      const nativeResponse = await fetch(`/api/youtube/native-transcript/${videoId}`);
      const nativeData = await nativeResponse.json();

      if (!nativeResponse.ok || !nativeData?.available || !nativeData?.segments?.length) {
        return false;
      }

      const nativeSegments = mapNativeSegments(nativeData.segments);
      const metadata = {
        title: nativeData.title,
        language: nativeData.language,
        availableLanguages: nativeData.availableLanguages,
        forcedJapanese: nativeData.forcedJapanese,
        languageNote: nativeData.languageNote,
        totalSegments: nativeData.totalSegments,
        totalDuration: nativeData.totalDuration,
        method: 'youtube-native-lite'
      };

      setStatus('completed');
      onTranscriptLoaded(nativeSegments, nativeData.title, metadata);

      if (isAuthenticated && contentId) {
        setFormattingPending(true);
        scheduleFormattedPolling(contentId);
      } else {
        setFormattingPending(false);
      }

      return true;
    } catch (nativeError) {
      console.warn('Native transcript fetch failed, falling back to full pipeline:', nativeError);
      return false;
    }
  };

  const loadTranscript = async () => {
    setStatus('loading');
    setError(null);
    setFormattingPending(false);
    pollAttemptsRef.current = 0;
    if (formattedPollingTimeoutRef.current) {
      clearTimeout(formattedPollingTimeoutRef.current);
      formattedPollingTimeoutRef.current = null;
    }

    let contentId = '';

    try {
      if (videoUrl && !fileInfo) {
        contentId = TranscriptCacheManager.generateContentId({
          type: 'youtube',
          videoUrl
        });
      } else if (fileInfo) {
        contentId = TranscriptCacheManager.generateContentId({
          type: fileInfo.type.startsWith('video/') ? 'video' : 'audio',
          fileName: fileInfo.name,
          fileSize: fileInfo.size
        });
      }

      contentIdRef.current = contentId;

      const isAuthenticated = Boolean(user?.uid && !isGuest);

      // Check cache for ALL users (even unauthenticated) to save transcription costs
      if (contentId && !contentId.startsWith('unknown_')) {
        const cachedTranscript = await TranscriptCacheManager.getCachedTranscript(contentId);

        if (cachedTranscript && cachedTranscript.transcript.length > 0) {
          setLoadingMessage(CACHE_HIT_MESSAGES[0]);

          const enrichedMetadata = {
            ...cachedTranscript.metadata,
            formattedTranscript: cachedTranscript.formattedTranscript,
            hasFormattedVersion: !!cachedTranscript.formattedTranscript
          };

          const transcriptToUse = cachedTranscript.formattedTranscript || cachedTranscript.transcript;

          setStatus('completed');
          onTranscriptLoaded(transcriptToUse, cachedTranscript.videoTitle, enrichedMetadata);

          // Only authenticated users get formatted transcript polling
          if (isAuthenticated && !cachedTranscript.formattedTranscript && cachedTranscript.metadata?.wasFormatted === false) {
            setFormattingPending(true);
            scheduleFormattedPolling(contentId);
          }
          return;
        }
      }

      let nativeServed = false;
      const videoId =
        !fileInfo && typeof videoUrl === 'string'
          ? TranscriptCacheManager.extractYouTubeVideoId(videoUrl)
          : null;

      if (audioUrl === 'youtube-player' && videoId) {
        nativeServed = await fetchNativeTranscript(videoId, contentId, isAuthenticated);
      }

      if (nativeServed) {
        // Continue with the heavier pipeline to populate caches / AI in the background.
        try {
          const response = await fetch('/api/youtube/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: videoUrl,
              provider: 'youtube-native',
              forceRegenerate: false
            })
          });

          const data = await response.json();

          if (response.ok && data.success) {
            const formattingFlag = Boolean(data.formattingPending);
            onTranscriptLoaded(
              data.formattedTranscript || data.transcript,
              data.videoTitle,
              data.videoMetadata
            );

            if (formattingFlag && isAuthenticated && contentId) {
              setFormattingPending(true);
              scheduleFormattedPolling(contentId);
            } else {
              setFormattingPending(false);
            }
          }
          return;
        } catch (backgroundError) {
          console.warn('Background transcript enhancement failed:', backgroundError);
          return;
        }
      }

      if (audioUrl === 'youtube-player') {
        const response = await fetch('/api/youtube/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: videoUrl,
            provider: 'youtube-native',
            forceRegenerate: false
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const formattingFlag = Boolean(data.formattingPending);
          setStatus('completed');
          onTranscriptLoaded(
            data.formattedTranscript || data.transcript,
            data.videoTitle,
            data.videoMetadata
          );
          if (formattingFlag && isAuthenticated && contentId) {
            setFormattingPending(true);
            scheduleFormattedPolling(contentId);
          } else {
            setFormattingPending(false);
          }
        } else {
          if (response.status === 429 && data.error === 'QUOTA_EXCEEDED') {
            const quotaInfo = data.quotaInfo || {};
            setStatus('error');
            setError(
              `Daily video limit reached (${quotaInfo.used}/${quotaInfo.limit}). ` +
              `Upgrade to Premium for more videos or try again tomorrow!`
            );

            setTimeout(() => {
              window.location.href = '/pricing?reason=quota_exceeded';
            }, 3000);
            return;
          }

          const errorMessage = data.message || strings.youtubeShadowing.errors.transcriptFailed;
          const suggestions = data.suggestions || [];

          let fullError = errorMessage;
          if (suggestions.length > 0) {
            fullError += '\n\n' + t('common.suggestions') + ':\n• ' + suggestions.join('\n• ');
          }

          throw new Error(fullError);
        }
      } else {
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

      {formattingPending && (
        <div className="mt-4 rounded-lg border border-dashed border-primary-300 bg-primary-50/60 dark:bg-primary-900/20 p-3 text-sm text-primary-700 dark:text-primary-200">
          {strings.youtubeShadowing?.messages?.aiEnhancing ??
            'AI is enhancing this transcript in the background. We’ll upgrade the text as soon as it is ready.'}
        </div>
      )}
    </div>
  );
}
