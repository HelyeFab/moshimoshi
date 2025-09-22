import { NextRequest, NextResponse } from 'next/server';
import { SKIP_PATTERNS, type SkipPattern } from '@/lib/kanji/skip';

// Predefined kanji lists for SKIP patterns
const SKIP_KANJI_MAP: Record<SkipPattern, Record<string, string[]>> = {
  'left-right': {
    '1-2': ['仁', '化', '付', '代', '他', '仕', '仙', '仲', '伝', '休', '伸', '作', '但', '位', '住', '体', '何', '伯', '伴', '似', '余'],
    '1-3': ['川', '州', '巡', '訓', '順', '班', '狙', '狂', '狭', '独', '猟', '猫', '狩'],
    '1-4': ['打', '江', '池', '汁', '汗', '汚', '汝', '沈', '沖', '没', '沢', '河', '沿', '況', '泊', '泌', '法', '波', '泥', '注'],
    '1-5': ['材', '村', '杉', '析', '林', '枚', '板', '松', '枠', '枝', '柄', '柔', '柱', '柳', '栄', '校', '株', '核', '根', '格'],
    'Other': ['明', '時', '語', '調', '談', '論', '議', '識', '護', '読', '財', '貨', '販', '質', '賛', '賞', '賢', '賦', '購']
  },
  'up-down': {
    '2-1': ['二', '三', '五', '六', '七', '八', '九', '十', '千', '万', '丈', '上', '下', '不', '与', '且', '世', '丘', '丙'],
    '2-2': ['旦', '旧', '旨', '早', '旬', '昆', '昇', '明', '易', '昔', '星', '映', '春', '昨', '昭', '是', '昼', '時', '晩'],
    '2-3': ['宇', '守', '安', '宋', '完', '宏', '宗', '官', '宙', '定', '宛', '宜', '宝', '実', '客', '室', '宮', '害', '家'],
    '2-4': ['花', '芋', '芝', '芯', '芳', '芸', '苗', '若', '苦', '英', '茂', '茶', '草', '荒', '荷', '菊', '菜', '華', '落'],
    'Other': ['雪', '雲', '電', '雷', '霊', '震', '霜', '霧', '露', '青', '静', '非', '面', '革', '靴', '韓', '音', '響', '頁']
  },
  'enclosure': {
    '3-1': ['囗', '四', '回', '因', '団', '困', '囲', '図', '固', '国', '圃', '圏', '園', '圓'],
    '3-2': ['門', '間', '閉', '開', '閑', '関', '閣', '閥', '閲', '闇', '闘'],
    '3-3': ['辺', '込', '迂', '迅', '迎', '近', '返', '迫', '述', '迷', '追', '退', '送', '逃', '逆', '透', '逐', '途', '通'],
    '3-4': ['广', '庁', '広', '庄', '庇', '床', '序', '底', '店', '府', '度', '座', '庫', '庭', '康', '廊', '廃', '廟'],
    'Other': ['風', '凡', '凶', '凸', '凹', '出', '函', '刀', '刃', '分', '切', '刈', '刊', '刑', '列', '初', '判', '別']
  },
  'solid': {
    '4-1': ['一', '丁', '七', '万', '丈', '三', '上', '下', '不', '与', '且', '世', '丘', '丙', '両', '並', '中', '串', '丸'],
    '4-2': ['乙', '九', '乞', '也', '乳', '乾', '亀', '了', '予', '争', '事', '互', '五', '井', '亜', '亡', '交', '享', '京'],
    '4-3': ['人', '入', '八', '公', '六', '兵', '其', '具', '典', '兼', '内', '円', '冊', '再', '冒', '冗', '写', '冠', '冬'],
    '4-4': ['力', '功', '加', '劣', '助', '努', '励', '労', '効', '勇', '勉', '動', '勘', '務', '勝', '募', '勢', '勤', '勧'],
    'Other': ['毛', '氏', '民', '気', '水', '氷', '永', '求', '汁', '汗', '江', '池', '汚', '汝', '沈', '沖', '没', '沢']
  }
};

function getSkipKanji(pattern?: SkipPattern, subcategories: boolean = false) {
  if (!pattern) {
    // Return all patterns
    const allData: any = {
      patterns: SKIP_PATTERNS,
      totalCount: 0,
      kanji: [],
      categorized: {} as Record<SkipPattern, any[]>,
      stats: {
        leftRight: 0,
        upDown: 0,
        enclosure: 0,
        solid: 0
      }
    };

    Object.entries(SKIP_KANJI_MAP).forEach(([p, categories]) => {
      const patternKanji: any[] = [];
      Object.entries(categories).forEach(([cat, kanjiList]) => {
        kanjiList.forEach(k => {
          patternKanji.push({
            kanji: k,
            pattern: p,
            category: cat !== 'Other' ? cat : undefined
          });
        });
      });
      allData.categorized[p as SkipPattern] = patternKanji;
      allData.kanji.push(...patternKanji);

      // Update stats
      const statKey = p.replace('-', '') as keyof typeof allData.stats;
      if (statKey === 'leftright') {
        allData.stats.leftRight = patternKanji.length;
      } else if (statKey === 'updown') {
        allData.stats.upDown = patternKanji.length;
      } else if (statKey in allData.stats) {
        allData.stats[statKey] = patternKanji.length;
      }
    });

    allData.totalCount = allData.kanji.length;

    if (subcategories) {
      allData.subcategorized = Object.entries(SKIP_KANJI_MAP).reduce((acc, [p, categories]) => {
        acc[p] = Object.entries(categories).reduce((catAcc, [cat, kanjiList]) => {
          if (cat !== 'Other') {
            catAcc[cat] = kanjiList.map(k => ({ kanji: k }));
          }
          return catAcc;
        }, {} as Record<string, any[]>);
        return acc;
      }, {} as Record<string, Record<string, any[]>>);
    }

    return allData;
  }

  // Return specific pattern
  const categories = SKIP_KANJI_MAP[pattern];
  if (!categories) {
    return { kanji: [], totalCount: 0 };
  }

  const kanji: any[] = [];
  const subcategorized: Record<string, any[]> = {};

  Object.entries(categories).forEach(([cat, kanjiList]) => {
    kanjiList.forEach(k => {
      kanji.push({
        kanji: k,
        pattern,
        category: cat !== 'Other' ? cat : undefined
      });
    });

    if (subcategories && cat !== 'Other') {
      subcategorized[cat] = kanjiList.map(k => ({ kanji: k }));
    }
  });

  const result: any = {
    pattern: SKIP_PATTERNS[pattern],
    totalCount: kanji.length,
    kanji
  };

  if (subcategories) {
    result.subcategorized = subcategorized;
  }

  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pattern = searchParams.get('pattern') as SkipPattern | null;
  const subcategories = searchParams.get('subcategories') === 'true';

  const data = getSkipKanji(pattern || undefined, subcategories);

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { skipCode } = await request.json();

  if (!skipCode) {
    return NextResponse.json({
      error: 'SKIP code is required'
    }, { status: 400 });
  }

  // Parse SKIP code (e.g., "1-4-3" means left-right, 4 strokes left, 3 strokes right)
  const parts = skipCode.split('-');
  if (parts.length !== 3) {
    return NextResponse.json({
      error: 'Invalid SKIP code format'
    }, { status: 400 });
  }

  const patternNum = parseInt(parts[0]);
  const patterns: Record<number, SkipPattern> = {
    1: 'left-right',
    2: 'up-down',
    3: 'enclosure',
    4: 'solid'
  };

  const pattern = patterns[patternNum];
  if (!pattern) {
    return NextResponse.json({
      error: 'Invalid pattern number'
    }, { status: 400 });
  }

  // For this demo, return some matching kanji
  const category = `${parts[0]}-${parts[1]}`;
  const matchingKanji = SKIP_KANJI_MAP[pattern]?.[category] || [];

  return NextResponse.json({
    skipCode,
    pattern,
    kanji: matchingKanji.slice(0, 10) // Limit to 10 for demo
  });
}