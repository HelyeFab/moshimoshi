'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlayIcon,
  ClockIcon,
  TvIcon,
  BookOpenIcon,
  ChartBarIcon,
  GlobeAltIcon,
  CheckBadgeIcon,
  XCircleIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'
import { PlayIcon as PlayIconSolid } from '@heroicons/react/24/solid'

interface DemoStats {
  totalPrograms: number
  livePrograms: number
  newsPrograms: number
  educationalPrograms: number
  availableChannels: string[]
  lastUpdated: string
  apiStatus: 'connected' | 'error' | 'rate_limited'
  nextUpdate: string
}

interface EnhancedProgram {
  id: string
  title: string
  subtitle?: string
  content?: string
  act?: string
  start_time: string
  end_time: string
  service: {
    name: string
  }
  estimatedJLPTLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  vocabulary?: Array<{
    kanji: string
    reading: string
    meaning: string
    jlptLevel: string
  }>
  learningValue?: number
  isEducational?: boolean
  hasAudio?: boolean
  duration?: number
  isLive?: boolean
  genres: string[]
}

interface NHKData {
  current: EnhancedProgram[]
  upcoming: EnhancedProgram[]
  news: EnhancedProgram[]
  educational: EnhancedProgram[]
  schedule: Array<{
    time: string
    programs: EnhancedProgram[]
    isCurrentTime: boolean
    isPastTime: boolean
  }>
  stats?: DemoStats
  japanTime: string
  lastUpdated: string
}

const JLPT_COLORS = {
  N5: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  N4: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  N3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  N2: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  N1: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
}

export default function NHKDemoPage() {
  const [data, setData] = useState<NHKData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'current' | 'news' | 'educational' | 'schedule'>(
    'current'
  )
  const [selectedProgram, setSelectedProgram] = useState<EnhancedProgram | null>(null)

  useEffect(() => {
    fetchNHKData()
    // Refresh every 5 minutes
    const interval = setInterval(fetchNHKData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchNHKData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/nhk/live-schedule?includeStats=true')
      const result = await response.json()

      if (result.status === 'ok') {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    })
  }

  const formatJapanTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-700 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading NHK data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-700 flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Unable to load NHK data
          </h2>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
          <button
            onClick={fetchNHKData}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-700">
      {/* Hero Section */}
      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              NHK API
              <span className="bg-gradient-to-r from-primary-400 to-blue-600 bg-clip-text text-transparent">
                {' '}
                Integration
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
              Experience authentic Japanese content from NHK with enhanced learning features.
              Real-time program data, vocabulary extraction, and interactive learning tools.
            </p>

            {/* Status Badge */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-full border border-gray-200/50 dark:border-dark-700/50">
                <SignalIcon className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">API Connected</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-full border border-gray-200/50 dark:border-dark-700/50">
                <ClockIcon className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Japan: {data && formatJapanTime(data.japanTime)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Stats Grid */}
          {data?.stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
            >
              <StatCard
                label="Programs Today"
                value={data.stats.totalPrograms}
                icon={TvIcon}
                color="blue"
              />
              <StatCard
                label="Live Now"
                value={data.stats.livePrograms}
                icon={PlayIconSolid}
                color="green"
              />
              <StatCard
                label="News Programs"
                value={data.stats.newsPrograms}
                icon={GlobeAltIcon}
                color="purple"
              />
              <StatCard
                label="Educational"
                value={data.stats.educationalPrograms}
                icon={BookOpenIcon}
                color="orange"
              />
            </motion.div>
          )}

          {/* Navigation Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2 justify-center mb-8"
          >
            {[
              { id: 'current', label: 'Live Now', count: data?.current.length },
              { id: 'news', label: 'News Programs', count: data?.news.length },
              { id: 'educational', label: 'Educational', count: data?.educational.length },
              { id: 'schedule', label: 'Schedule', count: data?.schedule.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`
                  px-6 py-3 rounded-xl font-medium transition-all duration-300
                  ${
                    selectedTab === tab.id
                      ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-lg border-2 border-primary-200 dark:border-primary-800'
                      : 'bg-white/60 dark:bg-dark-800/60 text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-dark-700/80 border-2 border-transparent'
                  }
                `}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-2 text-xs bg-gray-100 dark:bg-dark-600 px-2 py-1 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Content Sections */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {selectedTab === 'current' && data?.current && (
                <ProgramGrid
                  programs={data.current}
                  title="Currently Broadcasting"
                  onSelectProgram={setSelectedProgram}
                />
              )}
              {selectedTab === 'news' && data?.news && (
                <ProgramGrid
                  programs={data.news}
                  title="News Programs"
                  onSelectProgram={setSelectedProgram}
                />
              )}
              {selectedTab === 'educational' && data?.educational && (
                <ProgramGrid
                  programs={data.educational}
                  title="Educational Content"
                  onSelectProgram={setSelectedProgram}
                />
              )}
              {selectedTab === 'schedule' && data?.schedule && (
                <ScheduleTimeline schedule={data.schedule} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Content Analysis Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16"
          >
            <ContentAnalysisDemo
              programs={data?.current
                .concat(data?.upcoming || [])
                .concat(data?.news || [])
                .concat(data?.educational || [])}
            />
          </motion.div>

          {/* Learning Integration Demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16"
          >
            <LearningIntegrationDemo />
          </motion.div>
        </div>
      </section>

      {/* Program Detail Modal */}
      <AnimatePresence>
        {selectedProgram && (
          <ProgramDetailModal program={selectedProgram} onClose={() => setSelectedProgram(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: any
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'from-blue-400 to-blue-600',
    green: 'from-green-400 to-green-600',
    purple: 'from-purple-400 to-purple-600',
    orange: 'from-orange-400 to-orange-600',
  }

  return (
    <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-dark-700/50 hover:scale-105 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color]}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  )
}

function ProgramGrid({
  programs,
  title,
  onSelectProgram,
}: {
  programs: EnhancedProgram[]
  title: string
  onSelectProgram: (program: EnhancedProgram) => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {programs.slice(0, 9).map((program, index) => (
          <motion.div
            key={program.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelectProgram(program)}
            className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-dark-700/50 hover:scale-105 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {program.service.name}
              </span>
              {program.isLive && (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  LIVE
                </span>
              )}
            </div>

            <h3 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {program.title}
            </h3>

            {program.subtitle && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Subtitle ({program.subtitle.length} chars)
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                  {program.subtitle}
                </p>
              </div>
            )}

            {program.content && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Content ({program.content.length} chars)
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4">
                  {program.content}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(program.start_time).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -
                {new Date(program.end_time).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {program.duration && (
                <span className="text-xs text-gray-500">({program.duration}min)</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              {program.estimatedJLPTLevel && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${JLPT_COLORS[program.estimatedJLPTLevel]}`}
                >
                  {program.estimatedJLPTLevel}
                </span>
              )}
              {program.learningValue && (
                <div className="flex items-center gap-1">
                  <ChartBarIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {program.learningValue}/10
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ScheduleTimeline({
  schedule,
}: {
  schedule: Array<{
    time: string
    programs: EnhancedProgram[]
    isCurrentTime: boolean
    isPastTime: boolean
  }>
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
        Today's Schedule
      </h2>
      <div className="space-y-4">
        {schedule.slice(0, 12).map((timeSlot, index) => (
          <motion.div
            key={timeSlot.time}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              flex gap-4 p-4 rounded-xl border
              ${
                timeSlot.isCurrentTime
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                  : timeSlot.isPastTime
                    ? 'bg-gray-50 dark:bg-dark-800/50 border-gray-200 dark:border-dark-700 opacity-60'
                    : 'bg-white/80 dark:bg-dark-800/80 border-gray-200/50 dark:border-dark-700/50'
              }
            `}
          >
            <div className="flex-shrink-0">
              <div
                className={`
                px-3 py-2 rounded-lg font-medium text-sm
                ${
                  timeSlot.isCurrentTime
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300'
                }
              `}
              >
                {timeSlot.time}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="space-y-2">
                {timeSlot.programs.slice(0, 3).map(program => (
                  <div key={program.id} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {program.title}
                    </span>
                    {program.estimatedJLPTLevel && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${JLPT_COLORS[program.estimatedJLPTLevel]}`}
                      >
                        {program.estimatedJLPTLevel}
                      </span>
                    )}
                    {program.isEducational && <BookOpenIcon className="h-4 w-4 text-green-600" />}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function LearningIntegrationDemo() {
  return (
    <div className="bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm rounded-3xl p-8 border border-gray-200/50 dark:border-dark-700/50">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
        Learning Integration Preview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vocabulary Extraction */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5 text-blue-600" />
            Vocabulary Extraction
          </h3>
          <div className="space-y-2">
            {[
              { kanji: '政治', reading: 'せいじ', meaning: 'politics', level: 'N3' },
              { kanji: '経済', reading: 'けいざい', meaning: 'economy', level: 'N3' },
              { kanji: '文化', reading: 'ぶんか', meaning: 'culture', level: 'N3' },
            ].map(vocab => (
              <div
                key={vocab.kanji}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{vocab.kanji}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    ({vocab.reading})
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-300">{vocab.meaning}</div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${JLPT_COLORS[vocab.level as keyof typeof JLPT_COLORS]}`}
                  >
                    {vocab.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Tracking */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-green-600" />
            Progress Tracking
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Programs Watched</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">12/20</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-dark-600 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                style={{ width: '60%' }}
              ></div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">XP Earned</span>
              <span className="text-sm font-medium text-green-600">+1,250 XP</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Current Streak</span>
              <span className="text-sm font-medium text-orange-600">🔥 7 days</span>
            </div>
          </div>
        </div>

        {/* SRS Integration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckBadgeIcon className="h-5 w-5 text-purple-600" />
            SRS Integration
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Vocabulary from NHK programs automatically feeds into your spaced repetition system.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-300">15 words learned</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-300">8 words reviewing</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-300">12 words new</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgramDetailModal({
  program,
  onClose,
}: {
  program: EnhancedProgram
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-dark-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {program.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{program.service.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <XCircleIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {program.subtitle && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Subtitle ({program.subtitle.length} characters)
            </h3>
            <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-dark-700 p-3 rounded-lg">
              {program.subtitle}
            </p>
          </div>
        )}

        {program.content && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Program Content ({program.content.length} characters)
            </h3>
            <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-dark-700 p-3 rounded-lg">
              {program.content}
            </p>
          </div>
        )}

        {program.act && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Cast & Staff ({program.act.length} characters)
            </h3>
            <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-dark-700 p-3 rounded-lg">
              {program.act}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(program.start_time).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -
                {new Date(program.end_time).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {program.duration && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Duration: {program.duration} minutes
              </p>
            )}
          </div>
          <div className="space-y-2">
            {program.estimatedJLPTLevel && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Level:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${JLPT_COLORS[program.estimatedJLPTLevel]}`}
                >
                  {program.estimatedJLPTLevel}
                </span>
              </div>
            )}
            {program.learningValue && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Learning Value:</span>
                <span className="text-sm font-medium">{program.learningValue}/10</span>
              </div>
            )}
          </div>
        </div>

        {program.vocabulary && program.vocabulary.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Key Vocabulary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {program.vocabulary.map((vocab, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-700 rounded"
                >
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{vocab.kanji}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                      ({vocab.reading})
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-300">{vocab.meaning}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function ContentAnalysisDemo({ programs }: { programs?: EnhancedProgram[] }) {
  if (!programs) return null

  const totalChars = programs.reduce((total, prog) => {
    return (
      total +
      (prog.title?.length || 0) +
      (prog.subtitle?.length || 0) +
      (prog.content?.length || 0) +
      (prog.act?.length || 0)
    )
  }, 0)

  const programsWithContent = programs.filter(p => p.content && p.content.length > 100)
  const averageContentLength =
    programsWithContent.length > 0
      ? Math.round(
          programsWithContent.reduce((sum, p) => sum + (p.content?.length || 0), 0) /
            programsWithContent.length
        )
      : 0

  return (
    <div className="bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm rounded-3xl p-8 border border-gray-200/50 dark:border-dark-700/50">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
        Real Japanese Content Analysis
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary-600 mb-2">
            {totalChars.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">Total Characters</div>
          <div className="text-xs text-gray-500">of authentic Japanese text</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{programsWithContent.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">Rich Programs</div>
          <div className="text-xs text-gray-500">with substantial content</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">{averageContentLength}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">Avg Length</div>
          <div className="text-xs text-gray-500">characters per program</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-orange-600 mb-2">N2-N3</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">JLPT Level</div>
          <div className="text-xs text-gray-500">professional broadcast quality</div>
        </div>
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          What This Means for Learning:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-start gap-2">
            <CheckBadgeIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Real Content:</strong> Actual Japanese descriptions from live TV programs, not
              mock data
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckBadgeIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Daily Updates:</strong> Fresh vocabulary and expressions from current events
              and culture
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckBadgeIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Vocabulary Rich:</strong> Contains hundreds of unique kanji compounds and
              expressions
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckBadgeIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Context Driven:</strong> Learn vocabulary in natural, authentic contexts from
              real broadcasts
            </div>
          </div>
        </div>
      </div>

      {programsWithContent.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Sample Content from Real Programs:
          </h3>
          <div className="space-y-3">
            {programsWithContent.slice(0, 2).map((program, index) => (
              <div key={program.id} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {program.title} ({program.content?.length} chars)
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                  {program.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
