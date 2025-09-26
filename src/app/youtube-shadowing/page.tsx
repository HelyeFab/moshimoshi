'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import YouTubeInput from '@/components/youtube-shadowing/YouTubeInput';
import FileUploader from '@/components/youtube-shadowing/FileUploader';
import AudioExtractor from '@/components/youtube-shadowing/AudioExtractor';
import TranscriptDisplay from '@/components/youtube-shadowing/TranscriptDisplay';
import EnhancedShadowingPlayer from '@/components/youtube-shadowing/EnhancedShadowingPlayer';
import EditableTranscriptReader from '@/components/youtube-shadowing/EditableTranscriptReader';
import { videoHistoryService } from '@/services/videoHistory';

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
  const [inputMode, setInputMode] = useState<'youtube' | 'upload'>('youtube');
  const [viewMode, setViewMode] = useState<'input' | 'player'>('input');

  const previousUrlsRef = useRef<{ videoUrl?: string; audioUrl?: string }>({});

  // Initialize video history service
  useEffect(() => {
    videoHistoryService.initialize(user?.uid);
  }, [user]);

  // Handle URL parameters (e.g., from My Videos)
  useEffect(() => {
    const urlParam = searchParams.get('url');

    if (urlParam && !session) {
      const decodedUrl = decodeURIComponent(urlParam);
      handleUrlSubmit(decodedUrl);
    }
  }, [searchParams]);

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

  const updateSession = (newSession: ShadowingSession | null) => {
    // Cleanup previous blob URLs
    if (session?.videoUrl?.startsWith('blob:') && session.videoUrl !== newSession?.videoUrl) {
      URL.revokeObjectURL(session.videoUrl);
    }
    if (session?.audioUrl?.startsWith('blob:') && session.audioUrl !== newSession?.audioUrl) {
      URL.revokeObjectURL(session.audioUrl);
    }

    // Update refs
    if (newSession) {
      previousUrlsRef.current = {
        videoUrl: newSession.videoUrl,
        audioUrl: newSession.audioUrl
      };
    }

    setSession(newSession);
    if (newSession) {
      setViewMode('player');
    }
  };

  const handleUrlSubmit = async (url: string) => {
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
        return;
      }

      // Create session
      updateSession({
        videoUrl: url,
        transcript: [],
        currentLineIndex: 0
      });

    } catch (err) {
      setError(t('common.error'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check access for file upload feature (premium only)
      if (!isPremium && !isGuest) {
        setError(t('common.subscriptionRequired'));
        setIsLoading(false);
        return;
      }

      // Create blob URL for the file
      const blobUrl = URL.createObjectURL(file);

      // Create session with file info
      updateSession({
        videoUrl: blobUrl,
        videoTitle: file.name.replace(/\.[^/.]+$/, ''),
        transcript: [],
        currentLineIndex: 0,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type
        },
        audioUrl: blobUrl
      });

    } catch (err) {
      setError(t('common.error'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/,
      /youtube\.com\/shorts\/([^&\s]+)/,
      /music\.youtube\.com\/watch\?v=([^&\s]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleAudioExtracted = (audioUrl: string, title?: string) => {
    if (session) {
      updateSession({
        ...session,
        audioUrl,
        videoTitle: title
      });
    }
  };

  const handleTranscriptLoaded = (transcript: TranscriptLine[], videoTitle?: string, videoMetadata?: any) => {
    if (session) {
      updateSession({
        ...session,
        transcript,
        ...(videoTitle && { videoTitle }),
        ...(videoMetadata && { videoMetadata })
      });
    }
  };

  // Stats for the header
  const stats = {
    total: 0,
    learned: 0,
    accuracy: 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={t('youtubeShadowing.title')}
        description={t('youtubeShadowing.description')}
        mode={viewMode}
        onModeChange={setViewMode}
        stats={stats}
        customModes={[
          { value: 'input', label: t('youtubeShadowing.modes.input'), icon: '🎬' },
          { value: 'player', label: t('youtubeShadowing.modes.player'), icon: '▶️' }
        ]}
      />

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
                {/* Input Mode Tabs */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setInputMode('youtube')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                      inputMode === 'youtube'
                        ? 'bg-primary-500 text-white shadow-md'
                        : 'bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>📺</span>
                      {t('youtubeShadowing.input.youtube')}
                    </span>
                  </button>
                  <button
                    onClick={() => setInputMode('upload')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                      inputMode === 'upload'
                        ? 'bg-primary-500 text-white shadow-md'
                        : 'bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>📤</span>
                      {t('youtubeShadowing.input.upload')}
                    </span>
                  </button>
                </div>

                {/* YouTube Input */}
                {inputMode === 'youtube' && (
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
                )}

                {/* File Upload */}
                {inputMode === 'upload' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <span className="text-2xl">📤</span>
                      {t('youtubeShadowing.input.uploadTitle')}
                    </h3>

                    <FileUploader
                      onFileSelect={handleFileUpload}
                      isLoading={isLoading}
                      maxSizeMB={hasAccess('premium') ? 200 : 50}
                    />
                  </div>
                )}

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
              {/* Video Info Card */}
              {(session.videoTitle || session.videoMetadata) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 mb-6 text-white relative"
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

              {/* Audio Extraction - Only for YouTube videos */}
              {!session.audioUrl && !session.fileInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <AudioExtractor
                    videoUrl={session.videoUrl}
                    onAudioExtracted={handleAudioExtracted}
                  />
                </motion.div>
              )}

              {/* Transcript Loading */}
              {session.audioUrl && session.transcript.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <TranscriptDisplay
                    videoUrl={session.videoUrl}
                    audioUrl={session.audioUrl}
                    fileInfo={session.fileInfo}
                    onTranscriptLoaded={handleTranscriptLoaded}
                  />
                </motion.div>
              )}

              {/* Video and Transcript Display */}
              {session.audioUrl && session.transcript.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-6"
                >
                  {/* Player Controls */}
                  <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-700">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowVideo(!showVideo)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          showVideo
                            ? 'bg-primary-500 text-white hover:bg-primary-600'
                            : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
                        }`}
                      >
                        {showVideo ? '🎬 ' : '🚫 '} Video
                      </button>

                      <button
                        onClick={() => setShowFurigana(!showFurigana)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          showFurigana
                            ? 'bg-primary-500 text-white hover:bg-primary-600'
                            : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
                        }`}
                      >
                        {showFurigana ? 'あ ' : '🚫 '} Furigana
                      </button>

                      <button
                        onClick={() => setShowGrammar(!showGrammar)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          showGrammar
                            ? 'bg-primary-500 text-white hover:bg-primary-600'
                            : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
                        }`}
                      >
                        {showGrammar ? '📝 ' : '🚫 '} Grammar
                      </button>

                      {showGrammar && (
                        <select
                          value={grammarMode}
                          onChange={(e) => setGrammarMode(e.target.value as any)}
                          className="px-4 py-2 rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300"
                        >
                          <option value="none">No Highlighting</option>
                          <option value="content">Content Words</option>
                          <option value="grammar">Grammar Words</option>
                          <option value="all">All Words</option>
                        </select>
                      )}

                      <button
                        onClick={() => setSession(prev => prev ? { ...prev, currentLineIndex: 0 } : null)}
                        className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
                      >
                        ↺ Reset
                      </button>
                    </div>
                  </div>

                  {/* Enhanced Shadowing Player */}
                  <EnhancedShadowingPlayer
                    session={session}
                    onLineChange={(index) => {
                      setSession(prev => prev ? { ...prev, currentLineIndex: index } : null);
                    }}
                    showVideo={showVideo}
                    showFurigana={showFurigana}
                    onToggleFurigana={() => setShowFurigana(!showFurigana)}
                    showGrammar={showGrammar}
                    onToggleGrammar={() => setShowGrammar(!showGrammar)}
                    grammarMode={grammarMode}
                    onGrammarModeChange={setGrammarMode}
                  />

                  {/* Editable Transcript Reader */}
                  <EditableTranscriptReader
                    transcript={session.transcript}
                    currentLineIndex={session.currentLineIndex}
                    onLineClick={(index) => {
                      setSession(prev => prev ? { ...prev, currentLineIndex: index } : null);
                    }}
                    showFurigana={showFurigana}
                    showGrammar={showGrammar}
                    contentId={extractVideoId(session.videoUrl) || ''}
                    contentType="youtube"
                    videoUrl={session.videoUrl}
                    videoTitle={session.videoTitle}
                    onTranscriptRegenerated={(newTranscript) => {
                      setSession(prev => prev ? { ...prev, transcript: newTranscript } : null);
                    }}
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