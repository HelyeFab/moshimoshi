import { NextRequest, NextResponse } from 'next/server';
import {
  NHKNowOnAirResponse,
  NHKProgramListResponse,
  EnhancedProgram,
  NHKApiResponse,
  DemoStats,
  TOKYO_AREA,
  NHK_SERVICES,
  NHK_GENRES
} from '@/types/nhk';

// Cache duration: 30 minutes
const CACHE_DURATION = 30 * 60 * 1000;
let cachedData: any = null;
let cacheTimestamp = 0;

/**
 * NHK Live Schedule API Route
 * Fetches current and upcoming programs from NHK API
 * GET /api/nhk/live-schedule?service=g1&includeStats=true
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service') || NHK_SERVICES.GENERAL;
  const includeStats = searchParams.get('includeStats') === 'true';

  // Check environment variables
  const nhkApiKey = process.env.NHK_API_KEY;
  if (!nhkApiKey) {
    return NextResponse.json({
      status: 'error',
      error: 'NHK API key not configured',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }

  try {
    // Check cache first
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        status: 'ok',
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Get today's date in Japan timezone
    const japanDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    const dateStr = japanDate.toISOString().split('T')[0];

    // Parallel API calls for better performance
    const [nowOnAirResponse, todayScheduleResponse, educationalNowResponse] = await Promise.all([
      // Current programs
      fetch(`http://api.nhk.or.jp/v2/pg/now/${TOKYO_AREA}/${service}.json?key=${nhkApiKey}`, {
        headers: { 'User-Agent': 'Moshimoshi-Demo/1.0' }
      }),
      // Today's full schedule
      fetch(`http://api.nhk.or.jp/v2/pg/list/${TOKYO_AREA}/${service}/${dateStr}.json?key=${nhkApiKey}`, {
        headers: { 'User-Agent': 'Moshimoshi-Demo/1.0' }
      }),
      // Educational channel for variety
      service === NHK_SERVICES.GENERAL ?
        fetch(`http://api.nhk.or.jp/v2/pg/now/${TOKYO_AREA}/${NHK_SERVICES.EDUCATIONAL}.json?key=${nhkApiKey}`, {
          headers: { 'User-Agent': 'Moshimoshi-Demo/1.0' }
        }) : Promise.resolve(null)
    ]);

    // Check for API errors
    if (!nowOnAirResponse.ok) {
      throw new Error(`NHK API error: ${nowOnAirResponse.status} ${nowOnAirResponse.statusText}`);
    }

    const nowOnAir: NHKNowOnAirResponse = await nowOnAirResponse.json();
    const todaySchedule: NHKProgramListResponse = await todayScheduleResponse.json();
    const educationalNow = educationalNowResponse ? await educationalNowResponse.json() : null;

    // Transform and enhance the data
    const currentPrograms = enhancePrograms(extractCurrentPrograms(nowOnAir, service));
    const upcomingPrograms = enhancePrograms(getUpcomingPrograms(todaySchedule, service));
    const newsPrograms = enhancePrograms(filterNewsProgramsFromSchedule(todaySchedule, service));
    const educationalPrograms = enhancePrograms(filterEducationalPrograms(todaySchedule, service));

    // If educational channel data is available, add current educational program
    if (educationalNow) {
      const currentEducational = enhancePrograms(extractCurrentPrograms(educationalNow, NHK_SERVICES.EDUCATIONAL));
      educationalPrograms.unshift(...currentEducational);
    }

    // Compile response data
    const responseData = {
      current: currentPrograms,
      upcoming: upcomingPrograms.slice(0, 10), // Limit to next 10 programs
      news: newsPrograms.slice(0, 8), // Today's news programs
      educational: educationalPrograms.slice(0, 8), // Educational content
      schedule: createTimelineData(todaySchedule, service),
      lastUpdated: new Date().toISOString(),
      japanTime: japanDate.toISOString(),
      ...(includeStats && { stats: generateDemoStats(nowOnAir, todaySchedule, educationalNow) })
    };

    // Update cache
    cachedData = responseData;
    cacheTimestamp = now;

    return NextResponse.json({
      status: 'ok',
      data: responseData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('NHK API Error:', error);

    // Return fallback data if available
    if (cachedData) {
      return NextResponse.json({
        status: 'ok',
        data: cachedData,
        error: 'Using cached data due to API error',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to fetch NHK data',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Extract current programs from now-on-air response
 */
function extractCurrentPrograms(nowOnAir: NHKNowOnAirResponse, serviceId: string): any[] {
  const serviceData = nowOnAir.nowonair_list[serviceId];
  if (!serviceData) return [];

  const programs = [];
  if (serviceData.present) programs.push(serviceData.present);
  if (serviceData.following) programs.push(serviceData.following);

  return programs;
}

/**
 * Get upcoming programs from schedule
 */
function getUpcomingPrograms(schedule: NHKProgramListResponse, serviceId: string): any[] {
  const programs = schedule.list[serviceId] || [];
  const now = new Date();

  return programs.filter(program => {
    const startTime = new Date(program.start_time);
    return startTime > now;
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

/**
 * Filter news programs from schedule
 */
function filterNewsProgramsFromSchedule(schedule: NHKProgramListResponse, serviceId: string): any[] {
  const programs = schedule.list[serviceId] || [];

  return programs.filter(program => {
    const isNewsGenre = program.genres.includes(NHK_GENRES.NEWS);
    const hasNewsInTitle = /ニュース|報道|NEWS/i.test(program.title);
    return isNewsGenre || hasNewsInTitle;
  });
}

/**
 * Filter educational programs
 */
function filterEducationalPrograms(schedule: NHKProgramListResponse, serviceId: string): any[] {
  const programs = schedule.list[serviceId] || [];

  return programs.filter(program => {
    const isEducational = program.genres.some(genre =>
      [NHK_GENRES.EDUCATION, NHK_GENRES.LANGUAGE, NHK_GENRES.CHILDREN].includes(genre)
    );
    const hasEducationalKeywords = /講座|学習|教育|語学|こども|高校|大学/i.test(program.title);
    return isEducational || hasEducationalKeywords;
  });
}

/**
 * Enhance programs with learning features
 */
function enhancePrograms(programs: any[]): EnhancedProgram[] {
  return programs.map(program => {
    const enhanced: EnhancedProgram = {
      ...program,
      estimatedJLPTLevel: estimateJLPTLevel(program),
      vocabulary: extractVocabularyPreview(program),
      learningValue: calculateLearningValue(program),
      isEducational: isEducationalProgram(program),
      hasAudio: true, // NHK programs typically have audio
      duration: calculateDuration(program.start_time, program.end_time),
      difficultyScore: calculateDifficultyScore(program),
      isLive: isCurrentlyLive(program)
    };

    return enhanced;
  });
}

/**
 * Estimate JLPT level based on program content
 */
function estimateJLPTLevel(program: any): 'N5' | 'N4' | 'N3' | 'N2' | 'N1' {
  // News and formal content -> N2-N1
  if (program.genres.includes(NHK_GENRES.NEWS) || /ニュース|報道/i.test(program.title)) {
    return 'N2';
  }

  // Educational/Children's content -> N5-N4
  if (program.genres.includes(NHK_GENRES.CHILDREN) || /こども|幼児/i.test(program.title)) {
    return 'N5';
  }

  // Language learning programs -> N4
  if (program.genres.includes(NHK_GENRES.LANGUAGE) || /語学|講座/i.test(program.title)) {
    return 'N4';
  }

  // Documentary/Cultural -> N3
  if (program.genres.includes(NHK_GENRES.DOCUMENTARY)) {
    return 'N3';
  }

  // Default to N3
  return 'N3';
}

/**
 * Extract vocabulary preview for demo purposes
 */
function extractVocabularyPreview(program: any) {
  // This is a simplified mock - in real implementation,
  // you'd use proper Japanese NLP
  const commonWords = [
    { kanji: '番組', reading: 'ばんぐみ', meaning: 'program', jlptLevel: 'N3' as const },
    { kanji: '放送', reading: 'ほうそう', meaning: 'broadcast', jlptLevel: 'N3' as const },
    { kanji: '今日', reading: 'きょう', meaning: 'today', jlptLevel: 'N5' as const },
  ];

  return commonWords.slice(0, Math.floor(Math.random() * 3) + 1);
}

/**
 * Calculate learning value (1-10 scale)
 */
function calculateLearningValue(program: any): number {
  let score = 5; // Base score

  // News programs are great for learning
  if (program.genres.includes(NHK_GENRES.NEWS)) score += 2;

  // Educational content gets bonus
  if (program.genres.includes(NHK_GENRES.EDUCATION)) score += 3;

  // Documentary content is valuable
  if (program.genres.includes(NHK_GENRES.DOCUMENTARY)) score += 2;

  // Children's programs are good for beginners
  if (program.genres.includes(NHK_GENRES.CHILDREN)) score += 1;

  return Math.min(score, 10);
}

/**
 * Check if program is educational
 */
function isEducationalProgram(program: any): boolean {
  const educationalGenres = [NHK_GENRES.EDUCATION, NHK_GENRES.LANGUAGE, NHK_GENRES.CHILDREN];
  return program.genres.some((genre: string) => educationalGenres.includes(genre));
}

/**
 * Calculate program duration in minutes
 */
function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Calculate difficulty score (1-10)
 */
function calculateDifficultyScore(program: any): number {
  // This is a simplified algorithm
  let score = 5;

  if (program.genres.includes(NHK_GENRES.NEWS)) score += 2;
  if (program.genres.includes(NHK_GENRES.CHILDREN)) score -= 2;
  if (program.genres.includes(NHK_GENRES.EDUCATION)) score -= 1;

  return Math.max(1, Math.min(score, 10));
}

/**
 * Check if program is currently live
 */
function isCurrentlyLive(program: any): boolean {
  const now = new Date();
  const start = new Date(program.start_time);
  const end = new Date(program.end_time);

  return now >= start && now <= end;
}

/**
 * Create timeline data for schedule visualization
 */
function createTimelineData(schedule: NHKProgramListResponse, serviceId: string) {
  const programs = schedule.list[serviceId] || [];
  const timeSlots: { [hour: string]: any[] } = {};

  programs.forEach(program => {
    const hour = new Date(program.start_time).getHours();
    const hourKey = `${hour.toString().padStart(2, '0')}:00`;

    if (!timeSlots[hourKey]) timeSlots[hourKey] = [];
    timeSlots[hourKey].push(program);
  });

  return Object.keys(timeSlots).sort().map(time => ({
    time,
    programs: timeSlots[time],
    isCurrentTime: isCurrentHour(time),
    isPastTime: isPastHour(time)
  }));
}

function isCurrentHour(timeSlot: string): boolean {
  const currentHour = new Date().getHours();
  const slotHour = parseInt(timeSlot.split(':')[0]);
  return currentHour === slotHour;
}

function isPastHour(timeSlot: string): boolean {
  const currentHour = new Date().getHours();
  const slotHour = parseInt(timeSlot.split(':')[0]);
  return currentHour > slotHour;
}

/**
 * Generate demo statistics
 */
function generateDemoStats(
  nowOnAir: NHKNowOnAirResponse,
  schedule: NHKProgramListResponse,
  educationalNow: any
): DemoStats {
  const generalPrograms = schedule.list[NHK_SERVICES.GENERAL] || [];
  const newsPrograms = generalPrograms.filter(p =>
    p.genres.includes(NHK_GENRES.NEWS) || /ニュース/i.test(p.title)
  );
  const educationalPrograms = generalPrograms.filter(p =>
    p.genres.includes(NHK_GENRES.EDUCATION) || /講座|学習/i.test(p.title)
  );

  return {
    totalPrograms: generalPrograms.length,
    livePrograms: Object.keys(nowOnAir.nowonair_list).length,
    newsPrograms: newsPrograms.length,
    educationalPrograms: educationalPrograms.length,
    availableChannels: ['NHK総合', 'NHKEテレ'],
    lastUpdated: new Date().toISOString(),
    apiStatus: 'connected',
    nextUpdate: new Date(Date.now() + CACHE_DURATION).toISOString()
  };
}