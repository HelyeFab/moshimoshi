import { NextRequest, NextResponse } from 'next/server';
import { NHKApiResponse, EnhancedProgram, TOKYO_AREA } from '@/types/nhk';

/**
 * NHK Programs API Route
 * Fetches specific program details from NHK API
 * GET /api/nhk/programs?programId=123&service=g1&area=130
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('programId');
  const service = searchParams.get('service') || 'g1';
  const area = searchParams.get('area') || TOKYO_AREA;

  // Check environment variables
  const nhkApiKey = process.env.NHK_API_KEY;
  if (!nhkApiKey) {
    return NextResponse.json({
      status: 'error',
      error: 'NHK API key not configured',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }

  if (!programId) {
    return NextResponse.json({
      status: 'error',
      error: 'Program ID is required',
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }

  try {
    // Fetch program details from NHK API
    const response = await fetch(
      `http://api.nhk.or.jp/v2/pg/info/${area}/${service}/${programId}.json?key=${nhkApiKey}`,
      {
        headers: { 'User-Agent': 'Moshimoshi-Demo/1.0' }
      }
    );

    if (!response.ok) {
      throw new Error(`NHK API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const programs = data.list[service] || [];

    if (programs.length === 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Program not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Enhance the program with learning features
    const program = programs[0];
    const enhanced: EnhancedProgram = {
      ...program,
      estimatedJLPTLevel: estimateJLPTLevel(program),
      vocabulary: extractDetailedVocabulary(program),
      learningValue: calculateLearningValue(program),
      isEducational: isEducationalProgram(program),
      hasAudio: true,
      duration: calculateDuration(program.start_time, program.end_time),
      difficultyScore: calculateDifficultyScore(program),
      isLive: isCurrentlyLive(program)
    };

    return NextResponse.json({
      status: 'ok',
      data: enhanced,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('NHK Program API Error:', error);

    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to fetch program details',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Extract detailed vocabulary for learning features
 */
function extractDetailedVocabulary(program: any) {
  // Extract ALL Japanese text content from real fields
  const allText = [
    program.title || '',
    program.subtitle || '',
    program.content || '',
    program.act || ''
  ].join(' ');

  console.log(`[VOCAB] Extracting from ${allText.length} chars of Japanese text`);

  // Extended vocabulary database for real content extraction
  const vocabDatabase = [
    // Media and broadcasting
    { kanji: '番組', reading: 'ばんぐみ', meaning: 'program', jlptLevel: 'N3' as const },
    { kanji: '放送', reading: 'ほうそう', meaning: 'broadcast', jlptLevel: 'N3' as const },
    { kanji: 'ニュース', reading: 'ニュース', meaning: 'news', jlptLevel: 'N4' as const },
    { kanji: '報道', reading: 'ほうどう', meaning: 'news report', jlptLevel: 'N2' as const },
    { kanji: '特集', reading: 'とくしゅう', meaning: 'special feature', jlptLevel: 'N2' as const },

    // Politics and society
    { kanji: '政治', reading: 'せいじ', meaning: 'politics', jlptLevel: 'N3' as const },
    { kanji: '経済', reading: 'けいざい', meaning: 'economy', jlptLevel: 'N3' as const },
    { kanji: '社会', reading: 'しゃかい', meaning: 'society', jlptLevel: 'N3' as const },
    { kanji: '首相', reading: 'しゅしょう', meaning: 'prime minister', jlptLevel: 'N2' as const },
    { kanji: '国内', reading: 'こくない', meaning: 'domestic', jlptLevel: 'N3' as const },
    { kanji: '国際', reading: 'こくさい', meaning: 'international', jlptLevel: 'N3' as const },
    { kanji: '支援', reading: 'しえん', meaning: 'support', jlptLevel: 'N3' as const },
    { kanji: '問題', reading: 'もんだい', meaning: 'problem', jlptLevel: 'N4' as const },

    // Nature and environment
    { kanji: '自然', reading: 'しぜん', meaning: 'nature', jlptLevel: 'N3' as const },
    { kanji: '環境', reading: 'かんきょう', meaning: 'environment', jlptLevel: 'N3' as const },
    { kanji: '動物', reading: 'どうぶつ', meaning: 'animal', jlptLevel: 'N5' as const },
    { kanji: '森', reading: 'もり', meaning: 'forest', jlptLevel: 'N4' as const },
    { kanji: '山', reading: 'やま', meaning: 'mountain', jlptLevel: 'N5' as const },
    { kanji: '川', reading: 'かわ', meaning: 'river', jlptLevel: 'N5' as const },
    { kanji: '季節', reading: 'きせつ', meaning: 'season', jlptLevel: 'N4' as const },

    // Culture and education
    { kanji: '文化', reading: 'ぶんか', meaning: 'culture', jlptLevel: 'N3' as const },
    { kanji: '教育', reading: 'きょういく', meaning: 'education', jlptLevel: 'N3' as const },
    { kanji: '歴史', reading: 'れきし', meaning: 'history', jlptLevel: 'N3' as const },
    { kanji: '伝統', reading: 'でんとう', meaning: 'tradition', jlptLevel: 'N3' as const },

    // Geography
    { kanji: '日本', reading: 'にほん', meaning: 'Japan', jlptLevel: 'N5' as const },
    { kanji: '東京', reading: 'とうきょう', meaning: 'Tokyo', jlptLevel: 'N5' as const },
    { kanji: '大阪', reading: 'おおさか', meaning: 'Osaka', jlptLevel: 'N4' as const },
    { kanji: '地域', reading: 'ちいき', meaning: 'region', jlptLevel: 'N3' as const },

    // Common verbs and activities
    { kanji: '活動', reading: 'かつどう', meaning: 'activity', jlptLevel: 'N3' as const },
    { kanji: '研究', reading: 'けんきゅう', meaning: 'research', jlptLevel: 'N3' as const },
    { kanji: '開発', reading: 'かいはつ', meaning: 'development', jlptLevel: 'N3' as const },
    { kanji: '生活', reading: 'せいかつ', meaning: 'life/living', jlptLevel: 'N4' as const },

    // Time expressions
    { kanji: '今日', reading: 'きょう', meaning: 'today', jlptLevel: 'N5' as const },
    { kanji: '明日', reading: 'あした', meaning: 'tomorrow', jlptLevel: 'N5' as const },
    { kanji: '時間', reading: 'じかん', meaning: 'time', jlptLevel: 'N5' as const }
  ];

  // Find vocabulary that actually appears in the text
  const foundVocab = vocabDatabase.filter(vocab =>
    allText.includes(vocab.kanji)
  ).map(vocab => {
    const matches = (allText.match(new RegExp(vocab.kanji, 'g')) || []);
    const position = allText.indexOf(vocab.kanji);
    return {
      ...vocab,
      frequency: matches.length,
      position: {
        start: position,
        end: position + vocab.kanji.length
      },
      context: position > -1 ?
        allText.substring(Math.max(0, position - 15), position + vocab.kanji.length + 15) : ''
    };
  }).sort((a, b) => b.frequency - a.frequency);

  console.log(`[VOCAB] Found ${foundVocab.length} vocabulary items in real content`);
  return foundVocab.slice(0, 20); // Return top 20 vocabulary items
}

/**
 * Estimate JLPT level based on program content and genre
 */
function estimateJLPTLevel(program: any): 'N5' | 'N4' | 'N3' | 'N2' | 'N1' {
  const genres = program.genres || [];
  const title = program.title || '';
  const content = program.content || '';

  // Children's programs -> N5
  if (genres.includes('1003') || /こども|幼児|子供/i.test(title)) {
    return 'N5';
  }

  // Language learning programs -> N4
  if (genres.includes('1007') || /語学|講座|初級/i.test(title)) {
    return 'N4';
  }

  // Educational content -> N3
  if (genres.includes('1002') || /教育|学習|中級/i.test(title)) {
    return 'N3';
  }

  // News and current affairs -> N2
  if (genres.includes('0000') || /ニュース|報道|時事/i.test(title)) {
    return 'N2';
  }

  // Complex documentaries, dramas -> N1
  if (genres.includes('0800') || genres.includes('0300') || /ドキュメンタリー|上級/i.test(title)) {
    return 'N1';
  }

  return 'N3'; // Default
}

/**
 * Calculate learning value (1-10 scale)
 */
function calculateLearningValue(program: any): number {
  let score = 5; // Base score
  const genres = program.genres || [];
  const title = program.title || '';

  // Bonus for educational content
  if (genres.includes('1002') || genres.includes('1007')) score += 3;

  // Bonus for news (good for vocabulary)
  if (genres.includes('0000')) score += 2;

  // Bonus for documentaries
  if (genres.includes('0800')) score += 2;

  // Bonus for cultural content
  if (/文化|伝統|歴史/i.test(title)) score += 1;

  // Penalty for purely entertainment content
  if (genres.includes('0500') && !/語学|教育/i.test(title)) score -= 1;

  return Math.max(1, Math.min(score, 10));
}

/**
 * Check if program is educational
 */
function isEducationalProgram(program: any): boolean {
  const educationalGenres = ['1002', '1007', '1003']; // Education, Language, Children
  return program.genres?.some((genre: string) => educationalGenres.includes(genre)) || false;
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
  const jlptLevel = estimateJLPTLevel(program);

  const difficultyMap = {
    'N5': 2,
    'N4': 4,
    'N3': 6,
    'N2': 8,
    'N1': 10
  };

  return difficultyMap[jlptLevel];
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