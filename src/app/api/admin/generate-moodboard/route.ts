import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'

interface GenerateMoodBoardRequest {
  theme: string
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  kanjiCount: number
  includeExamples: boolean
  focusArea?: 'daily' | 'business' | 'travel' | 'nature' | 'emotions' | 'abstract'
}

const JLPT_KANJI_EXAMPLES = {
  N5: [
    '日',
    '月',
    '火',
    '水',
    '木',
    '金',
    '土',
    '人',
    '子',
    '女',
    '男',
    '大',
    '小',
    '中',
    '上',
    '下',
    '左',
    '右',
    '前',
    '後',
  ],
  N4: [
    '春',
    '夏',
    '秋',
    '冬',
    '朝',
    '昼',
    '夜',
    '週',
    '年',
    '今',
    '新',
    '古',
    '近',
    '遠',
    '多',
    '少',
    '早',
    '遅',
    '高',
    '安',
  ],
  N3: [
    '政',
    '治',
    '経',
    '済',
    '社',
    '会',
    '法',
    '律',
    '歴',
    '史',
    '文',
    '化',
    '教',
    '育',
    '科',
    '学',
    '技',
    '術',
    '産',
    '業',
  ],
  N2: [
    '環',
    '境',
    '資',
    '源',
    '効',
    '率',
    '構',
    '造',
    '機',
    '能',
    '関',
    '係',
    '影',
    '響',
    '変',
    '化',
    '発',
    '展',
    '進',
    '歩',
  ],
  N1: [
    '概',
    '念',
    '抽',
    '象',
    '具',
    '体',
    '論',
    '理',
    '実',
    '践',
    '検',
    '証',
    '仮',
    '説',
    '推',
    '測',
    '分',
    '析',
    '統',
    '計',
  ],
}

const THEME_COLORS = {
  daily: '#3B82F6', // Blue
  business: '#10B981', // Green
  travel: '#F59E0B', // Amber
  nature: '#84CC16', // Lime
  emotions: '#EC4899', // Pink
  abstract: '#8B5CF6', // Purple
}

const THEME_EMOJIS = {
  daily: '🏠',
  business: '💼',
  travel: '✈️',
  nature: '🌿',
  emotions: '❤️',
  abstract: '💭',
}

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication using session (works with credentials: 'include')
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin from Firebase
    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc?.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body: GenerateMoodBoardRequest = await request.json()
    const { theme, jlptLevel, kanjiCount = 12, includeExamples = true, focusArea = 'daily' } = body

    // Validate inputs
    if (!theme || !jlptLevel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (kanjiCount < 1 || kanjiCount > 30) {
      return NextResponse.json({ error: 'Kanji count must be between 1 and 30' }, { status: 400 })
    }

    // In production, you would call an AI API here
    // For now, generating mock data based on the request
    const availableKanji = JLPT_KANJI_EXAMPLES[jlptLevel]
    const selectedKanji = availableKanji.slice(0, Math.min(kanjiCount, availableKanji.length))

    const mockMoodBoard = {
      title: theme,
      description: `A collection of ${jlptLevel} kanji related to ${theme}`,
      themeColor: THEME_COLORS[focusArea] || '#7C3AED',
      emoji: THEME_EMOJIS[focusArea] || '📚',
      kanjiList: selectedKanji.map(kanji => ({
        kanji,
        meaning: getMockMeaning(kanji),
        onyomi: getMockOnyomi(kanji),
        kunyomi: getMockKunyomi(kanji),
        jlptLevel,
        strokeCount: Math.floor(Math.random() * 15) + 3,
        tags: [focusArea, theme.toLowerCase()],
        examples: includeExamples ? getMockExamples(kanji) : [],
      })),
    }

    return NextResponse.json({
      success: true,
      moodBoard: mockMoodBoard,
      message: 'Mood board generated successfully (mock data)',
    })
  } catch (error) {
    console.error('Error generating mood board:', error)
    return NextResponse.json({ error: 'Failed to generate mood board' }, { status: 500 })
  }
}

function getMockMeaning(kanji: string): string {
  const meanings: { [key: string]: string } = {
    日: 'day, sun',
    月: 'month, moon',
    火: 'fire',
    水: 'water',
    木: 'tree, wood',
    金: 'gold, money',
    土: 'earth, soil',
    人: 'person',
    子: 'child',
    女: 'woman',
    男: 'man',
    大: 'big',
    小: 'small',
    中: 'middle',
    上: 'up, above',
    下: 'down, below',
    左: 'left',
    右: 'right',
    前: 'before, front',
    後: 'after, behind',
  }
  return meanings[kanji] || 'meaning'
}

function getMockOnyomi(kanji: string): string[] {
  const onyomi: { [key: string]: string[] } = {
    日: ['ニチ', 'ジツ'],
    月: ['ゲツ', 'ガツ'],
    火: ['カ'],
    水: ['スイ'],
    木: ['ボク', 'モク'],
    金: ['キン', 'コン'],
    土: ['ド', 'ト'],
    人: ['ジン', 'ニン'],
    子: ['シ', 'ス'],
    女: ['ジョ', 'ニョ'],
    男: ['ダン', 'ナン'],
  }
  return onyomi[kanji] || ['オン']
}

function getMockKunyomi(kanji: string): string[] {
  const kunyomi: { [key: string]: string[] } = {
    日: ['ひ', 'か'],
    月: ['つき'],
    火: ['ひ'],
    水: ['みず'],
    木: ['き', 'こ'],
    金: ['かね', 'かな'],
    土: ['つち'],
    人: ['ひと'],
    子: ['こ'],
    女: ['おんな'],
    男: ['おとこ'],
  }
  return kunyomi[kanji] || ['くん']
}

function getMockExamples(kanji: string): string[] {
  return [`${kanji}曜日 - day of the week`, `${kanji}本 - Japan`, `今${kanji} - today`]
}
