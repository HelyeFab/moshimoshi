/**
 * NHK API Type Definitions
 * Based on official NHK Program Guide API v2 specification
 */

// Base NHK API Response Structure
export interface NHKApiResponse<T> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
  timestamp?: string;
}

// Area Information
export interface NHKArea {
  id: string;
  name: string;
}

// Service Information (Channel)
export interface NHKService {
  id: string;
  name: string;
  logo_s?: {
    url: string;
    width: string;
    height: string;
  };
  logo_m?: {
    url: string;
    width: string;
    height: string;
  };
  logo_l?: {
    url: string;
    width: string;
    height: string;
  };
}

// Program Information
export interface NHKProgram {
  id: string;
  event_id: string;
  start_time: string; // ISO 8601 format
  end_time: string; // ISO 8601 format
  area: NHKArea;
  service: NHKService;
  title: string;
  subtitle?: string;
  content?: string;
  act?: string; // Cast/Actor information
  genres: string[];
  program_logo?: {
    url: string;
    width: string;
    height: string;
  };
  hashtags?: string[];
}

// Now On Air Response
export interface NHKNowOnAirResponse {
  nowonair_list: {
    [serviceId: string]: {
      previous?: NHKProgram;
      present?: NHKProgram;
      following?: NHKProgram;
    };
  };
}

// Program List Response
export interface NHKProgramListResponse {
  list: {
    [serviceId: string]: NHKProgram[];
  };
}

// Genre Information
export interface NHKGenre {
  id: string;
  name: string;
  programs: NHKProgram[];
}

// Enhanced Program with Learning Features
export interface EnhancedProgram extends NHKProgram {
  // Learning-specific enhancements
  estimatedJLPTLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  vocabulary?: VocabularyItem[];
  learningValue?: number; // 1-10 scale
  isEducational?: boolean;
  hasAudio?: boolean;
  duration?: number; // minutes
  difficultyScore?: number;
  isLive?: boolean;
}

// Vocabulary Item
export interface VocabularyItem {
  kanji: string;
  reading: string;
  meaning: string;
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  frequency?: number;
  position?: {
    start: number;
    end: number;
  };
}

// Schedule Timeline Item
export interface ScheduleTimelineItem {
  time: string;
  programs: EnhancedProgram[];
  isCurrentTime?: boolean;
  isPastTime?: boolean;
}

// Learning Integration Data
export interface LearningIntegration {
  totalPrograms: number;
  watchedPrograms: number;
  vocabWordsExtracted: number;
  estimatedWatchTime: number; // minutes
  xpEarned: number;
  currentStreak: number;
  completionRate: number; // 0-1
}

// Demo Statistics
export interface DemoStats {
  totalPrograms: number;
  livePrograms: number;
  newsPrograms: number;
  educationalPrograms: number;
  availableChannels: string[];
  lastUpdated: string;
  apiStatus: 'connected' | 'error' | 'rate_limited';
  nextUpdate: string;
}

// API Request Parameters
export interface NHKApiParams {
  area?: string; // Default: "130" (Tokyo)
  service?: string; // "g1" | "e1" | "s1" | "s3"
  date?: string; // YYYY-MM-DD format
  genre?: string; // Genre code
}

// Common channel services
export const NHK_SERVICES = {
  GENERAL: 'g1', // NHK総合
  EDUCATIONAL: 'e1', // NHKEテレ
  BS1: 's1', // NHKBS1
  BS_PREMIUM: 's3', // NHKBSプレミアム
} as const;

// Common genre codes
export const NHK_GENRES = {
  NEWS: '0000',
  DRAMA: '0300',
  MUSIC: '0400',
  VARIETY: '0500',
  MOVIE: '0600',
  ANIME: '0700',
  DOCUMENTARY: '0800',
  THEATER: '0900',
  HOBBY: '1000',
  WELFARE: '1001',
  EDUCATION: '1002',
  CHILDREN: '1003',
  LANGUAGE: '1007',
  SPORTS: '0100',
} as const;

// Tokyo area code
export const TOKYO_AREA = '130';

export type NHKServiceId = typeof NHK_SERVICES[keyof typeof NHK_SERVICES];
export type NHKGenreId = typeof NHK_GENRES[keyof typeof NHK_GENRES];