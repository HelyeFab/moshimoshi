'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  TrendingUp,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Hash,
  Timer
} from 'lucide-react';
import { useTheme } from '@/lib/theme/ThemeContext';
import { LoadingDots } from '@/components/ui/Loading';
import Alert from '@/components/ui/Alert';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface SessionProgress {
  currentItem: number;
  totalItems: number;
  accuracy: number;
  avgResponseTime: number;
  streak: number;
  points: number;
  isPaused: boolean;
  inactivityWarning: boolean;
  sessionId: string;
  startTime: Date;
  mode: 'recognition' | 'recall' | 'listening';
  recentAnswers: Array<{
    correct: boolean;
    responseTime: number;
    timestamp: Date;
  }>;
}

interface LiveSessionMonitorProps {
  sessionId?: string;
  onPause?: () => void;
  onResume?: () => void;
  compact?: boolean;
  onSwipeDown?: () => void; // For mobile swipe gesture
}

export default function LiveSessionMonitor({ 
  sessionId: propSessionId, 
  onPause, 
  onResume,
  compact = false,
  onSwipeDown
}: LiveSessionMonitorProps) {
  const [sessionProgress, setSessionProgress] = useState<SessionProgress | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const { resolvedTheme } = useTheme();
  const eventSourceRef = useRef<EventSource | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Swipe handlers for mobile - commented out as useSwipeable is not available
  // const swipeHandlers = useSwipeable({
  //   onSwipedDown: () => {
  //     if (onSwipeDown && !compact) {
  //       onSwipeDown();
  //     }
  //   },
  //   trackMouse: false,
  //   delta: 50,
  // });
  const swipeHandlers = {};

  // Subscribe to session events
  useEffect(() => {
    if (!propSessionId) return;

    // Set up EventSource for real-time updates
    const eventSource = new EventSource(`/api/review/sessions/${propSessionId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleSessionUpdate(data);
    };

    eventSource.onerror = () => {
      console.error('EventSource connection error');
      eventSource.close();
    };

    // Set up elapsed time counter
    elapsedTimerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      eventSource.close();
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [propSessionId]);

  const handleSessionUpdate = useCallback((data: any) => {
    switch (data.type) {
      case 'ITEM_ANSWERED':
        setSessionProgress(prev => {
          if (!prev) return null;
          const newAnswer = {
            correct: data.correct,
            responseTime: data.responseTime,
            timestamp: new Date()
          };
          const recentAnswers = [newAnswer, ...prev.recentAnswers.slice(0, 4)];
          const correctCount = recentAnswers.filter(a => a.correct).length;
          
          return {
            ...prev,
            currentItem: prev.currentItem + 1,
            accuracy: (correctCount / recentAnswers.length) * 100,
            avgResponseTime: recentAnswers.reduce((acc, a) => acc + a.responseTime, 0) / recentAnswers.length,
            streak: data.correct ? prev.streak + 1 : 0,
            points: prev.points + data.points,
            recentAnswers
          };
        });
        resetInactivityTimer();
        break;

      case 'SESSION_PAUSED':
        setSessionProgress(prev => prev ? { ...prev, isPaused: true } : null);
        break;

      case 'SESSION_RESUMED':
        setSessionProgress(prev => prev ? { ...prev, isPaused: false } : null);
        resetInactivityTimer();
        break;

      case 'SESSION_STARTED':
        setSessionProgress({
          currentItem: 0,
          totalItems: data.totalItems,
          accuracy: 0,
          avgResponseTime: 0,
          streak: 0,
          points: 0,
          isPaused: false,
          inactivityWarning: false,
          sessionId: data.sessionId,
          startTime: new Date(data.startTime),
          mode: data.mode,
          recentAnswers: []
        });
        resetInactivityTimer();
        break;

      case 'SESSION_COMPLETED':
        setSessionProgress(null);
        break;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    setShowInactivityWarning(false);
    
    // Set warning after 4 minutes
    inactivityTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
      
      // Auto-pause after 5 minutes
      setTimeout(() => {
        if (onPause) onPause();
        setSessionProgress(prev => prev ? { ...prev, isPaused: true } : null);
      }, 60000);
    }, 240000); // 4 minutes
  }, [onPause]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (!sessionProgress) {
    return null;
  }

  const progress = (sessionProgress.currentItem / sessionProgress.totalItems) * 100;
  const accuracyColor = sessionProgress.accuracy >= 80 ? 'text-green-500' : 
                        sessionProgress.accuracy >= 60 ? 'text-yellow-500' : 'text-red-500';

  if (compact) {
    // Compact version for embedding in header/navbar
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-4 px-4 py-2 bg-soft-white dark:bg-dark-800 rounded-full shadow-lg border border-gray-200 dark:border-dark-700"
      >
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8">
            <svg className="transform -rotate-90 w-8 h-8">
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-gray-300 dark:text-dark-600"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${progress * 0.88} 88`}
                className="text-primary-600"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-dark-50">
              {sessionProgress.currentItem}
            </span>
          </div>
          <span className="text-sm text-gray-600 dark:text-dark-400">
            / {sessionProgress.totalItems}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Target className="w-4 h-4" />
          <span className={`text-sm font-medium ${accuracyColor}`}>
            {sessionProgress.accuracy.toFixed(0)}%
          </span>
        </div>

        {sessionProgress.streak > 2 && (
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-dark-300">
              {sessionProgress.streak}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Timer className="w-4 h-4 text-gray-500 dark:text-dark-400" />
          <span className="text-sm text-gray-600 dark:text-dark-400">
            {formatTime(elapsedTime)}
          </span>
        </div>

        {sessionProgress.isPaused && (
          <Pause className="w-4 h-4 text-yellow-500 animate-pulse" />
        )}
      </motion.div>
    );
  }

  // Full version with mobile swipe support
  return (
    <motion.div
      {...swipeHandlers}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-soft-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-200 dark:border-dark-700 p-6 touch-pan-y"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-50">
            Live Session
          </h3>
          <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full">
            {sessionProgress.mode.toUpperCase()}
          </span>
          <DoshiMascot size="xsmall" variant="static" />
        </div>
        
        <div className="flex items-center gap-3">
          {sessionProgress.isPaused ? (
            <button
              onClick={onResume}
              className="min-w-[44px] min-h-[44px] p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              aria-label="Resume session"
            >
              <Play className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onPause}
              className="min-w-[44px] min-h-[44px] p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              aria-label="Pause session"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Inactivity Warning */}
      <AnimatePresence>
        {showInactivityWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert
              type="warning"
              message="Session will auto-pause in 1 minute due to inactivity"
              dismissible={false}
              showDoshi={true}
              doshiMood="sleeping"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 dark:text-dark-400">
            Progress: {sessionProgress.currentItem} of {sessionProgress.totalItems}
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-dark-50">
            {progress.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Target className="w-5 h-5 text-gray-400 dark:text-dark-500" />
          </div>
          <p className={`text-2xl font-bold ${accuracyColor}`}>
            {sessionProgress.accuracy.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400">Accuracy</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock className="w-5 h-5 text-gray-400 dark:text-dark-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-50">
            {formatResponseTime(sessionProgress.avgResponseTime)}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400">Avg Response</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Zap className="w-5 h-5 text-gray-400 dark:text-dark-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-50">
            {sessionProgress.streak}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400">Current Streak</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Hash className="w-5 h-5 text-gray-400 dark:text-dark-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-50">
            {sessionProgress.points}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400">Points Earned</p>
        </div>
      </div>

      {/* Recent Answers */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
          Recent Answers
        </h4>
        <div className="flex gap-2">
          {sessionProgress.recentAnswers.map((answer, index) => (
            <motion.button
              key={index}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center ${
                answer.correct 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}
              aria-label={answer.correct ? 'Correct answer' : 'Incorrect answer'}
            >
              {answer.correct ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
            </motion.button>
          ))}
          {sessionProgress.recentAnswers.length === 0 && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-dark-400">
              <LoadingDots size="small" />
              <span className="text-sm">Waiting for answers...</span>
            </div>
          )}
        </div>
      </div>

      {/* Session Timer */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-dark-400">
            Session Duration
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-dark-50">
            {formatTime(elapsedTime)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}