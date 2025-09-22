import { NextRequest, NextResponse } from 'next/server';
import { SEMANTIC_RADICALS } from '@/lib/kanji/radicals';
import fs from 'fs/promises';
import path from 'path';

// Predefined kanji lists for each radical
const RADICAL_KANJI_MAP: Record<string, Record<string, string[]>> = {
  water: {
    'Rivers & Seas': ['河', '川', '海', '洋', '湖', '池', '沼', '港', '湾', '浜', '岸', '沖', '潮', '波', '流', '渓', '滝', '瀬'],
    'Water Actions': ['洗', '泳', '浴', '流', '注', '汲', '濯', '漂', '浮', '沈', '溺', '漏', '滴', '濾'],
    'Liquids & States': ['水', '氷', '液', '汁', '油', '汗', '涙', '湿', '濡', '乾', '蒸', '沸', '凍'],
    'Water Qualities': ['清', '濁', '深', '浅', '澄', '淡', '濃', '温', '冷', '涼', '湧', '満', '渇'],
    'Uncategorized': ['沢', '治', '泉', '津', '混', '済', '渡', '漁', '激']
  },
  fire: {
    'Fire & Heat': ['火', '炎', '焼', '燃', '灯', '燭', '焚', '煙', '灰', '炭', '煤'],
    'Cooking': ['煮', '炒', '蒸', '煎', '焙', '炊', '熟', '烹'],
    'Light & Energy': ['照', '光', '輝', '煌', '爆', '熱', '暖', '熾'],
    'Destruction': ['焼', '焦', '燃', '爆', '滅', '消'],
    'Uncategorized': ['点', '黒', '然', '無', '烈']
  },
  tree: {
    'Trees & Forest': ['木', '林', '森', '樹', '桜', '松', '杉', '梅', '柳', '桃', '栗', '柿', '椿', '楓', '樫', '檜', '榊'],
    'Wood Products': ['材', '板', '柱', '机', '椅', '棚', '箱', '桶', '樽', '札', '枠', '柵'],
    'Plant Parts': ['根', '幹', '枝', '葉', '実', '花', '芽', '種', '果', '核'],
    'Wood Actions': ['植', '伐', '枯', '朽', '栽', '剪'],
    'Uncategorized': ['本', '末', '朱', '株', '村', '東', '栄', '柔', '検', '楽', '様', '横', '橋', '機']
  },
  person: {
    'Social Roles': ['人', '仏', '僧', '侍', '使', '係', '偉', '傑', '僕', '僚', '儀'],
    'Actions & States': ['休', '伏', '伐', '伝', '伴', '伸', '住', '依', '作', '保', '信', '修', '倒', '借', '停', '健', '働', '像'],
    'Relationships': ['仲', '伯', '俊', '俗', '倍', '候', '偶', '傍', '債', '催', '傷', '傾'],
    'Abstract Concepts': ['他', '付', '代', '令', '以', '仮', '件', '任', '企', '会', '似', '位', '低', '何', '余', '例', '供', '価', '便', '促', '値', '偏', '偽', '備', '億', '償', '優', '儲'],
    'Uncategorized': ['今', '介', '仕', '仙', '伎', '伯', '但', '佐', '佳', '侃', '侑', '俄', '俳', '倉', '倫', '偵', '傘', '僅', '儒']
  },
  hand: {
    'Grasping & Holding': ['持', '握', '掴', '捕', '把', '拘', '執', '携', '摑'],
    'Pushing & Pulling': ['押', '推', '拉', '引', '抽', '拐', '拒', '抑'],
    'Throwing & Hitting': ['打', '投', '抛', '撃', '拍', '批', '撲'],
    'Picking & Choosing': ['拾', '採', '択', '抜', '摘', '拓', '挑'],
    'Technical Actions': ['技', '操', '控', '接', '援', '授', '描', '提', '揮', '振', '挿', '探', '排', '掘', '措', '揚', '換', '損', '搬', '搭', '摂', '摩', '撮', '擁', '擦', '擬'],
    'Uncategorized': ['払', '扱', '承', '抄', '抗', '折', '担', '招', '拝', '拠', '拡', '括', '指', '挙', '挟', '捉', '捗', '捨', '掃', '掌', '掛', '掲', '揺', '撤']
  },
  mouth: {
    'Speaking & Sound': ['言', '話', '語', '説', '談', '詩', '詞', '訴', '告', '叫', '呼', '唱', '喝', '喚', '嘆', '噂', '囁'],
    'Eating & Tasting': ['食', '飲', '味', '甘', '辛', '苦', '咲', '噛', '飲', '喫', '嚥'],
    'Mouth Actions': ['口', '吐', '吸', '吹', '呑', '咳', '唾', '嗽', '哈'],
    'Questions & Answers': ['問', '答', '否', '可', '呈', '唯'],
    'Uncategorized': ['古', '句', '召', '台', '史', '右', '司', '号', '各', '合', '名', '吏', '向', '君', '含', '呉', '周', '命', '和', '品', '員', '唄', '唆', '唇', '唐', '商', '啓', '善', '喉', '喜', '喪', '営', '嗅', '嘉', '嘱', '器', '噴', '嚇']
  },
  heart: {
    'Emotions': ['心', '愛', '恋', '憎', '怒', '喜', '哀', '楽', '悲', '怖', '恐', '慌', '憂', '憤', '慈', '悦', '怨'],
    'Mental States': ['思', '想', '念', '忘', '憶', '慮', '意', '志', '悟', '惑', '愚', '慢', '慎', '憧', '懐'],
    'Character Traits': ['忍', '忠', '恭', '慶', '態', '性', '情', '感', '恥', '恨', '恩', '悔', '患', '惜', '惨', '惰', '愁', '慣', '慨', '慰'],
    'Actions': ['忙', '快', '怠', '急', '恒', '息', '悩', '悼', '慕', '憩', '憲', '憾', '懇', '懲', '懸'],
    'Uncategorized': ['必', '忌', '応', '怪', '愉']
  },
  movement: {
    'Walking & Running': ['走', '歩', '足', '踏', '跳', '躍', '踊', '蹴', '跨', '躓'],
    'Coming & Going': ['来', '去', '行', '往', '復', '返', '帰', '還', '巡', '回', '辿'],
    'Movement Types': ['進', '退', '逃', '追', '遂', '遇', '遊', '運', '遍', '過', '達', '遠', '近', '速', '遅', '逐', '途', '通', '逝', '造', '連', '逮', '週', '逸', '違', '遡', '遣', '適', '遭', '遮', '遵', '遷', '選', '遺', '避', '邁'],
    'Transportation': ['送', '迎', '輸', '載', '搬'],
    'Uncategorized': ['辺', '込', '迂', '迅', '迫', '迭', '述', '迷', '逆', '透']
  },
  metal: {
    'Metals': ['金', '銀', '銅', '鉄', '鋼', '鉛', '錫', '鉱', '鋳'],
    'Metal Objects': ['鈴', '鍵', '鎖', '鏡', '鐘', '針', '釘', '鍋', '釜', '鎌', '鋏', '錠', '鎧'],
    'Metal Actions': ['鍛', '錬', '鋳', '錆', '鈍', '鋭', '銘', '鐫'],
    'Money': ['銭', '銀', '釣', '銘'],
    'Uncategorized': ['釈', '鈎', '鉢', '銃', '鋒', '錯', '鎮', '鑑']
  },
  earth: {
    'Land & Ground': ['土', '地', '陸', '田', '畑', '野', '原', '園', '場', '境', '域', '埋', '堀'],
    'Buildings': ['城', '塔', '堂', '基', '堤', '塀', '墓', '壁', '堺'],
    'Earth Materials': ['砂', '泥', '塵', '埃', '坑', '堆'],
    'Actions': ['培', '埋', '掘', '填', '壊', '墜'],
    'Uncategorized': ['坂', '均', '坊', '塗', '塩', '壌', '壇', '壕', '壬', '壮', '壷']
  },
  plant: {
    'Flowers': ['花', '桜', '梅', '菊', '蘭', '菫', '萩', '蓮', '芍', '芙', '茉', '莉'],
    'Vegetables': ['芋', '菜', '葱', '蒜', '薯', '茄', '蕪', '蓬', '芹'],
    'Grass & Herbs': ['草', '芝', '苔', '蔦', '葛', '茨', '荊', '薬', '茶', '芳', '香'],
    'Plant Growth': ['芽', '茎', '葉', '花', '実', '種', '根', '苗', '若', '茂', '荒', '枯', '萎', '蒸', '落'],
    'Uncategorized': ['芯', '芸', '苛', '苦', '英', '茅', '荘', '荷', '菌', '菓', '華', '萌', '葬', '蒋', '蒐', '蒙', '蒲', '蓄', '蓋', '蓑', '蔑', '蔓', '蔚', '蔭', '蔵', '蕉', '蕎', '蕩', '薄', '薦', '薩', '薪', '薫', '藁', '藍', '藤', '藩', '藻', '蘇']
  }
};

function getRadicalKanji(radicalId: string, subThemes: boolean = false) {
  const radical = SEMANTIC_RADICALS[radicalId];
  if (!radical) return { kanji: [], subThemeGroups: {} };

  const themeGroups = RADICAL_KANJI_MAP[radicalId] || {};
  const allKanji: any[] = [];

  Object.entries(themeGroups).forEach(([theme, kanjiList]) => {
    kanjiList.forEach(k => {
      allKanji.push({
        kanji: k,
        theme: theme !== 'Uncategorized' ? theme : undefined
      });
    });
  });

  if (subThemes) {
    return {
      kanji: allKanji,
      subThemeGroups: Object.entries(themeGroups).reduce((acc, [theme, kanjiList]) => {
        if (theme !== 'Uncategorized') {
          acc[theme] = kanjiList.map(k => ({ kanji: k }));
        }
        return acc;
      }, {} as Record<string, any[]>),
      uncategorized: themeGroups['Uncategorized']?.map(k => ({ kanji: k })) || []
    };
  }

  return { kanji: allKanji, subThemeGroups: {} };
}

// Cache for all kanji data
let allKanjiCache: Map<string, any> | null = null;

async function loadAllKanjiData() {
  if (allKanjiCache) {
    return allKanjiCache;
  }

  const kanjiMap = new Map<string, any>();
  const levels = ['5', '4', '3', '2', '1'];

  for (const level of levels) {
    try {
      const filePath = path.join(process.cwd(), 'public', 'data', 'kanji', `jlpt_${level}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const kanjiData = JSON.parse(fileContent);

      for (const kanji of kanjiData) {
        // Transform to match expected structure with readings property
        kanjiMap.set(kanji.kanji, {
          kanji: kanji.kanji,
          meaning: kanji.meaning || '',
          meanings: kanji.meaning ? kanji.meaning.split(/[,;]/).map((m: string) => m.trim()) : [],
          onyomi: kanji.onyomi || [],
          kunyomi: kanji.kunyomi || [],
          readings: {
            on: kanji.onyomi || [],
            kun: kanji.kunyomi || []
          },
          strokeCount: kanji.strokeCount || 10,
          jlpt: `N${level}` as const,
          examples: []
        });
      }
    } catch (error) {
      console.error(`Failed to load JLPT N${level} data:`, error);
    }
  }

  allKanjiCache = kanjiMap;
  return kanjiMap;
}

async function getKanjiDetailsBatch(kanjiList: string[]) {
  const kanjiMap = await loadAllKanjiData();

  // Convert to array, maintaining order and providing fallbacks
  return kanjiList.map(kanji => {
    const found = kanjiMap.get(kanji);
    if (found) {
      return found;
    }

    // Fallback if kanji not found in database
    return {
      kanji,
      meaning: '',
      meanings: [],
      onyomi: [],
      kunyomi: [],
      readings: {
        on: [],
        kun: []
      },
      strokeCount: 0,
      jlpt: 'N5' as const,
      examples: []
    };
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const radicalId = searchParams.get('radical');
  const subThemes = searchParams.get('subThemes') === 'true';

  if (!radicalId) {
    return NextResponse.json({
      error: 'Radical ID is required'
    }, { status: 400 });
  }

  const radical = SEMANTIC_RADICALS[radicalId];

  if (!radical) {
    return NextResponse.json({
      error: 'Radical not found'
    }, { status: 404 });
  }

  const { kanji: kanjiList, subThemeGroups, uncategorized } = getRadicalKanji(radicalId, subThemes);

  // Fetch detailed kanji data using batch loading
  const kanjiWithDetails = await getKanjiDetailsBatch(kanjiList);

  const response: any = {
    radical,
    totalCount: kanjiList.length,
    kanji: kanjiWithDetails
  };

  if (subThemes) {
    // Enrich subThemeGroups with details using batch loading
    const enrichedSubThemeGroups: Record<string, any[]> = {};
    for (const [theme, kanjiArray] of Object.entries(subThemeGroups || {})) {
      const kanjiStrings = kanjiArray.map((item: any) => item.kanji);
      enrichedSubThemeGroups[theme] = await getKanjiDetailsBatch(kanjiStrings);
    }
    response.subThemeGroups = enrichedSubThemeGroups;

    // Enrich uncategorized with details using batch loading
    if (uncategorized && uncategorized.length > 0) {
      const uncategorizedKanji = uncategorized.map((item: any) => item.kanji);
      response.uncategorized = await getKanjiDetailsBatch(uncategorizedKanji);
    }
  }

  return NextResponse.json(response);
}