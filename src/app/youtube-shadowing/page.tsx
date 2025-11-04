'use client';

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import Navbar from '@/components/layout/Navbar';
import PageHeader from '@/components/layout/PageHeader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import YouTubeInput from '@/components/youtube-shadowing/YouTubeInput';
import EnhancedShadowingPlayer from '@/components/youtube-shadowing/EnhancedShadowingPlayer';
import TranscriptViewerNew from '@/components/youtube-shadowing/TranscriptViewerNew';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { extractVideoId } from '@/utils/youtubeHelpers';
import { TranscriptCacheManager } from '@/utils/transcriptCache';

const SESSION_STORAGE_KEY = 'youtubeShadowingSession';
export interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

export interface ShadowingSession {
  videoUrl: string;
  videoTitle?: string;
  audioUrl?: string;
  transcript: TranscriptLine[];
  currentLineIndex: number;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
  videoMetadata?: {
    title: string;
    channelTitle: string;
    description: string;
    thumbnails: any;
    duration: string;
    publishedAt: string;
    formattedTranscript?: TranscriptLine[];
    hasFormattedVersion?: boolean;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

function YouTubeShadowingContent() {
  const { t, strings } = useI18n();
  const { user, isGuest } = useAuth();
  const { isPremium, isFreeTier } = useSubscription();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<ShadowingSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFurigana, setShowFurigana] = useState(true);
  const [showGrammar, setShowGrammar] = useState(false);
  const [grammarMode, setGrammarMode] = useState<'none' | 'all' | 'content' | 'grammar'>('content');
  const [showShadowingMode, setShowShadowingMode] = useState(true);
  const [showVideo, setShowVideo] = useState(true);
  const [isVideoFree, setIsVideoFree] = useState(false);
  const [viewMode, setViewMode] = useState<'input' | 'player'>('input');
  const [useAiTranscript, setUseAiTranscript] = useState(false);
  const [aiEnhancementStatus, setAiEnhancementStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [aiEnhancementError, setAiEnhancementError] = useState<string | null>(null);
  const [aiEnhancementTriggered, setAiEnhancementTriggered] = useState(false);

  const previousUrlsRef = useRef<{ videoUrl?: string; audioUrl?: string }>({});
  const playerSeekRef = useRef<((time: number) => void) | null>(null);
  const playerPlayPauseRef = useRef<(() => void) | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const loadTimerRef = useRef<number | null>(null);
  const loadSourceRef = useRef<'youtube' | 'upload' | null>(null);
  const userAiOverrideRef = useRef(false);
  const hasHydratedFromCacheRef = useRef(false);
  const aiContentIdRef = useRef<string | null>(null);
  const aiStorageKeyRef = useRef<string | null>(null);
  const { showToast } = useToast();

  // Stabilize onLineChange callback to prevent infinite re-subscriptions
  const handleLineChange = useCallback((index: number) => {
    setSession(prev => prev ? { ...prev, currentLineIndex: index } : null);
  }, []);

  // Handle time updates from player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle play state changes from player
  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (playerPlayPauseRef.current) {
      playerPlayPauseRef.current();
    }
  }, []);

  // Direct seek handler for transcript clicks
  const handleSeekToTime = useCallback((time: number) => {
    console.log('[PAGE] Seeking to time:', time);
    if (playerSeekRef.current) {
      playerSeekRef.current(time);
    }
  }, []);

  const sharedUrlParam = searchParams.get('url');

  const updateSession = useCallback((newSession: ShadowingSession | null) => {
    setSession(prevSession => {
      if (prevSession?.videoUrl?.startsWith('blob:') && prevSession.videoUrl !== newSession?.videoUrl) {
        URL.revokeObjectURL(prevSession.videoUrl);
      }
      if (prevSession?.audioUrl?.startsWith('blob:') && prevSession.audioUrl !== newSession?.audioUrl) {
        URL.revokeObjectURL(prevSession.audioUrl);
      }

      if (newSession) {
        previousUrlsRef.current = {
          videoUrl: newSession.videoUrl,
          audioUrl: newSession.audioUrl
        };
      }

      if (!newSession) {
        setUseAiTranscript(prev => (prev === false ? prev : false));
        userAiOverrideRef.current = false;
      } else if (prevSession?.videoUrl !== newSession.videoUrl) {
        const formatted = Boolean((newSession.videoMetadata as any)?.formattedTranscript?.length);
        setUseAiTranscript(prev => (prev === formatted ? prev : formatted));
        userAiOverrideRef.current = false;
      }

      if (newSession) {
        setViewMode('player');
      }

      return newSession;
    });
  }, []);

  const handleUrlSubmit = useCallback(async (url: string) => {
    loadTimerRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    loadSourceRef.current = 'youtube';
    setUseAiTranscript(false);
    userAiOverrideRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      // YouTube feature is available to all users
      // No access check needed for YouTube videos

      // Extract video ID from URL
      const videoId = extractVideoId(url);

      if (!videoId) {
        setError(t('youtubeShadowing.errors.invalidUrl'));
        setIsLoading(false);
        loadTimerRef.current = null;
        loadSourceRef.current = null;
        return;
      }

      // Create session with "youtube-player" as audioUrl to indicate YouTube mode
      updateSession({
        videoUrl: url,
        audioUrl: 'youtube-player',
        transcript: [],
        currentLineIndex: 0
      });

    } catch (err) {
      setError(t('common.error'));
      console.error(err);
      loadTimerRef.current = null;
      loadSourceRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [t, updateSession]);

  // Handle URL parameters (e.g., from My Videos)
  useEffect(() => {
    if (!sharedUrlParam || session) {
      return;
    }

    const decodedUrl = decodeURIComponent(sharedUrlParam);
    void handleUrlSubmit(decodedUrl);
  }, [sharedUrlParam, session, handleUrlSubmit]);

  // Restore cached session on first render
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (hasHydratedFromCacheRef.current) {
      return;
    }

    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        hasHydratedFromCacheRef.current = true;
        return;
      }

      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object' || !parsed.session) {
        hasHydratedFromCacheRef.current = true;
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }

      const restoredSession = parsed.session as ShadowingSession;

      if (!restoredSession?.videoUrl || restoredSession.videoUrl.startsWith('blob:')) {
        hasHydratedFromCacheRef.current = true;
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }

      hasHydratedFromCacheRef.current = true;
      updateSession(restoredSession);

      if (typeof parsed.useAi === 'boolean') {
        userAiOverrideRef.current = true;
        setUseAiTranscript(parsed.useAi);
      }
    } catch (err) {
      console.warn('[YouTubeShadowing] Failed to restore cached session:', err);
      hasHydratedFromCacheRef.current = true;
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [updateSession]);

  // Cleanup blob URLs when component unmounts or session changes
  useEffect(() => {
    return () => {
      if (previousUrlsRef.current.videoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrlsRef.current.videoUrl);
      }
      if (previousUrlsRef.current.audioUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrlsRef.current.audioUrl);
      }
    };
  }, []);

  useEffect(() => {
    setAiEnhancementStatus('idle');
    setAiEnhancementError(null);

    if (!session?.videoUrl || session.audioUrl !== 'youtube-player') {
      aiContentIdRef.current = null;
      aiStorageKeyRef.current = null;
      setAiEnhancementTriggered(false);
      return;
    }

    const contentId = TranscriptCacheManager.generateContentId({
      type: 'youtube',
      videoUrl: session.videoUrl
    });

    aiContentIdRef.current = contentId;
    const storageKey = `youtube-shadowing-ai-trigger:${contentId}`;
    aiStorageKeyRef.current = storageKey;

    if (typeof window === 'undefined') {
      setAiEnhancementTriggered(false);
      return;
    }

    const stored = window.localStorage.getItem(storageKey);
    setAiEnhancementTriggered(stored === '1');
  }, [session?.videoUrl, session?.audioUrl]);

  const handleAudioExtracted = useCallback((audioUrl: string, title?: string) => {
    setSession(prevSession => {
      if (!prevSession) return prevSession;

      // Update the session with new audio URL and title
      const newSession = {
        ...prevSession,
        audioUrl,
        ...(title && { videoTitle: title })
      };

      // Update refs
      previousUrlsRef.current = {
        videoUrl: newSession.videoUrl,
        audioUrl: newSession.audioUrl
      };

      return newSession;
    });
  }, []);

  const handleTranscriptLoaded = useCallback((transcript: TranscriptLine[], videoTitle?: string, videoMetadata?: any) => {
    setSession(prevSession => {
      if (!prevSession) return prevSession;

      const hadFormatted = Boolean((prevSession.videoMetadata as any)?.formattedTranscript?.length);
      const hasFormattedNow = Boolean(videoMetadata?.formattedTranscript?.length);

      // Update AI transcript setting if needed
      if (hasFormattedNow && !hadFormatted && !userAiOverrideRef.current) {
        setUseAiTranscript(true);
      }

      // Log timing info
      if (loadSourceRef.current === 'youtube' && loadTimerRef.current !== null) {
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsedMs = Math.round(end - loadTimerRef.current);
        console.log(`[YouTube Shadowing] Transcript ready in ${elapsedMs}ms (YouTube native pipeline)`);
        loadTimerRef.current = null;
        loadSourceRef.current = null;
      }

      // Return updated session
      return {
        ...prevSession,
        transcript,
        ...(videoTitle && { videoTitle }),
        ...(videoMetadata && { videoMetadata })
      };
    });
  }, []);

  // Stats for the header
  const stats = {
    total: 0,
    learned: 0,
    accuracy: 0
  };

  const handleToggleAiTranscript = useCallback((value: boolean) => {
    userAiOverrideRef.current = true;
    setUseAiTranscript(prev => (prev === value ? prev : value));
  }, []);

  const formattedSegments = useMemo(
    () => (session?.videoMetadata as any)?.formattedTranscript,
    [session?.videoMetadata]
  );
  const formattedAvailable = Array.isArray(formattedSegments) && formattedSegments.length > 0;
  const canRequestAiEnhancement = useMemo(() => {
    if (!session) return false;
    if (session.audioUrl !== 'youtube-player') return false;
    if (!session.transcript || session.transcript.length === 0) return false;
    if (formattedAvailable) return false;
    if (aiEnhancementTriggered) return false;
    return true;
  }, [session, formattedAvailable, aiEnhancementTriggered]);

  const handleManualAiEnhancement = useCallback(async () => {
    if (!session || session.audioUrl !== 'youtube-player') {
      return;
    }
    if (!session.transcript || session.transcript.length === 0) {
      return;
    }
    if (!canRequestAiEnhancement && aiEnhancementStatus !== 'running') {
      return;
    }
    if (aiEnhancementStatus === 'running') {
      return;
    }

    setAiEnhancementStatus('running');
    setAiEnhancementError(null);
    setAiEnhancementTriggered(true);
    const storageKey = aiStorageKeyRef.current;
    const contentId = aiContentIdRef.current;

    try {
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enhanceOnly: true,
          rawTranscript: session.transcript
        })
      });

      if (!response.ok) {
        let message = 'Failed to enhance transcript with AI.';
        try {
          const data = await response.json();
          message = data?.message || data?.error || message;
        } catch {
          // ignore parsing errors
        }
        throw new Error(message);
      }

      const data = await response.json();
      if (!data?.formattedTranscript || !Array.isArray(data.formattedTranscript) || data.formattedTranscript.length === 0) {
        throw new Error('AI service returned no formatted transcript.');
      }

      if (contentId) {
        try {
          await TranscriptCacheManager.updateFormattedTranscript(contentId, data.formattedTranscript);
        } catch (cacheError) {
          console.warn('[YouTubeShadowing] Cache update failed after AI enhancement:', cacheError);
        }
      }

      updateSession(prev => {
        if (!prev) {
          return prev;
        }

        const previousMetadata = prev.videoMetadata as any;

        return {
          ...prev,
          videoMetadata: {
            ...previousMetadata,
            formattedTranscript: data.formattedTranscript,
            hasFormattedVersion: true,
            metadata: {
              ...previousMetadata?.metadata,
              wasFormatted: true
            }
          }
        };
      });

      setUseAiTranscript(true);
      setAiEnhancementStatus('completed');
      setAiEnhancementError(null);
      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, '1');
      }
      showToast('AI transcript ready. Switched to enhanced view.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enhance transcript with AI.';
      setAiEnhancementStatus('error');
      setAiEnhancementError(message);
      setAiEnhancementTriggered(false);
      showToast(message, 'error');
      console.error('[YouTubeShadowing] Manual AI enhancement failed:', err);
    }
  }, [session, canRequestAiEnhancement, aiEnhancementStatus, updateSession, showToast]);

  // Handle clearing the session
  const handleClearSession = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem(SESSION_STORAGE_KEY);

    // Clear the session state
    updateSession(null);

    // Reset view mode to input
    setViewMode('input');

    // Reset other states
    setError(null);
    setIsLoading(false);
    hasHydratedFromCacheRef.current = false;
  }, []);

  // Persist session state for reloads
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!session || session.videoUrl.startsWith('blob:')) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    const payload = {
      version: 1,
      savedAt: Date.now(),
      session,
      useAi: useAiTranscript
    };

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[YouTubeShadowing] Failed to cache session:', err);
    }
  }, [session, useAiTranscript]);

  const viewerSegments: TranscriptLine[] = session
    ? (formattedAvailable && useAiTranscript ? formattedSegments : session.transcript)
    : [];
  const viewerSource: 'raw' | 'ai-enhanced' = formattedAvailable && useAiTranscript ? 'ai-enhanced' : 'raw';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* Desktop-only PageHeader */}
      <div className="hidden sm:block">
        <PageHeader
          title={
            session?.videoTitle
              ? session.videoTitle.split(' ').slice(0, 3).join(' ') + (session.videoTitle.split(' ').length > 3 ? '...' : '')
              : session?.videoMetadata?.title
                ? session.videoMetadata.title.split(' ').slice(0, 3).join(' ') + (session.videoMetadata.title.split(' ').length > 3 ? '...' : '')
                : t('youtubeShadowing.title')
          }
          description={t('youtubeShadowing.description')}
        />
      </div>

      {/* Mobile-only: Super compact title bar when video is loaded */}
      {session && (session.videoTitle || session.videoMetadata?.title) && (
        <div className="sm:hidden sticky top-0 z-10">
          <div className="px-3 py-2 bg-white/95 dark:bg-dark-800/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-dark-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎬</span>
              <h1 className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
                {session.videoTitle || session.videoMetadata?.title}
              </h1>
              {isVideoFree && (
                <span className="text-xs px-2 py-0.5 bg-green-500 text-white rounded-full">
                  FREE
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading && <LoadingOverlay message={t('common.loading')} />}

      <div className="container mx-auto px-4 pb-20">
        <AnimatePresence mode="wait">
          {viewMode === 'input' && !session && (
            <motion.div
              key="input-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              {/* Hero Section */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="relative bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-3xl p-10 mb-8 text-white overflow-hidden"
              >
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                  <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-white rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 text-center">
                  <div className="text-6xl mb-4">🎬</div>
                  <h2 className="text-3xl font-bold mb-3">
                    {t('youtubeShadowing.hero.title')}
                  </h2>
                  <p className="text-lg opacity-90 max-w-2xl mx-auto">
                    {t('youtubeShadowing.hero.subtitle')}
                  </p>
                </div>
              </motion.div>

              {/* Input Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-50 dark:bg-dark-800 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-700 p-8 mb-6"
              >
                {/* YouTube Input Only - No Tabs */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-2xl">📺</span>
                    {t('youtubeShadowing.input.youtubeTitle')}
                  </h3>

                  <YouTubeInput
                    onSubmit={handleUrlSubmit}
                    isLoading={isLoading}
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                          {error}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Features Grid */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-700">
                  <div className="text-3xl mb-3">🎯</div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('youtubeShadowing.features.transcripts.title')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('youtubeShadowing.features.transcripts.description')}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-700">
                  <div className="text-3xl mb-3">🗣️</div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('youtubeShadowing.features.shadowing.title')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('youtubeShadowing.features.shadowing.description')}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-700">
                  <div className="text-3xl mb-3">📚</div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('youtubeShadowing.features.furigana.title')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('youtubeShadowing.features.furigana.description')}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {session && viewMode === 'player' && (
            <motion.div
              key="player-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto"
            >
              {/* Back Button - Always visible */}
              <div className="mb-4">
                <button
                  onClick={handleClearSession}
                  className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-dark-50 rounded-lg transition-colors border border-white/10"
                >
                  <span>←</span>
                  <span>Back to Input</span>
                </button>
              </div>

              {/* Video Info Card - Hidden on mobile (shown in PageHeader collapsible) */}
              {(session.videoTitle || session.videoMetadata) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="hidden sm:block bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 mb-6 text-white relative"
                >
                  {isVideoFree && (
                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <span>✨</span> {t('youtubeShadowing.freeAccess')}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    {session.videoMetadata?.thumbnails?.medium ? (
                      <img
                        src={session.videoMetadata.thumbnails.medium.url}
                        alt={session.videoTitle || 'Video thumbnail'}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="text-4xl flex-shrink-0">🎬</div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold mb-1 truncate">
                        {session.videoTitle || session.videoMetadata?.title || t('youtubeShadowing.loadingTitle')}
                      </h2>
                      {session.videoMetadata?.channelTitle && (
                        <p className="text-sm opacity-90 mb-1">
                          {t('youtubeShadowing.by')} {session.videoMetadata.channelTitle}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Video and Transcript Display */}
              {session && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-6"
                >
                  {/* Enhanced Shadowing Player */}
                  <EnhancedShadowingPlayer
                    session={session}
                    onLineChange={handleLineChange}
                    onPlayerReady={(seekFn, playPauseFn) => {
                      playerSeekRef.current = seekFn;
                      if (playPauseFn) {
                        playerPlayPauseRef.current = playPauseFn;
                      }
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onPlayStateChange={handlePlayStateChange}
                    showVideo={showVideo}
                    showFurigana={showFurigana}
                    onToggleFurigana={() => setShowFurigana(!showFurigana)}
                    showGrammar={showGrammar}
                    onToggleGrammar={() => setShowGrammar(!showGrammar)}
                    grammarMode={grammarMode}
                    onGrammarModeChange={setGrammarMode}
                    formattedAvailable={formattedAvailable}
                    useEnhancedTranscript={useAiTranscript}
                    onToggleTranscriptSource={handleToggleAiTranscript}
                    canRequestAiEnhancement={canRequestAiEnhancement}
                    onRequestAiEnhancement={handleManualAiEnhancement}
                    aiEnhancementStatus={aiEnhancementStatus}
                    aiEnhancementError={aiEnhancementError}
                  />

                  {/* Transcript Viewer */}
                  <TranscriptViewerNew
                    segments={viewerSegments}
                    currentTime={currentTime}
                    onSeekToTime={handleSeekToTime}
                    showFullTranscript={true}
                    source={viewerSource}
                    showFurigana={showFurigana}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    onClearSession={handleClearSession}
                  />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function YouTubeShadowingPage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <YouTubeShadowingContent />
    </Suspense>
  );
}
