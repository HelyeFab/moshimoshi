import { NextRequest, NextResponse } from 'next/server';
import { KANJI_FAMILIES } from '@/lib/kanji/families';

// Predefined kanji lists for each family component
const FAMILY_KANJI_MAP: Record<string, string[]> = {
  // Water family
  '氵': ['海', '河', '湖', '洗', '泳', '洋', '深', '波', '涙', '消', '流', '浴', '港', '湯', '汁', '沢', '油', '治', '泉', '津', '液', '混', '清', '済', '渡', '満', '漁', '潮', '激', '濃'],
  '水': ['水', '氷', '永', '泉', '求', '汁', '沈', '決', '沖', '没', '沢'],

  // Ice family
  '冫': ['冷', '凍', '凄', '凝', '冬', '寒', '凛'],

  // Fire family
  '火': ['火', '灯', '炎', '焼', '煙', '照', '熱', '燃', '爆', '炭', '灰'],
  '灬': ['点', '黒', '熱', '然', '無', '照', '煮', '焦', '烈'],

  // Earth family
  '土': ['土', '地', '場', '坂', '均', '坊', '城', '基', '堂', '塔', '塗', '塩', '境', '墓', '壁', '壊', '壌'],

  // Metal family
  '金': ['金', '銀', '銅', '鉄', '鋼', '銭', '鈴', '鉛', '錆', '鍵', '鎖', '鏡', '鐘'],

  // Tree family
  '木': ['木', '林', '森', '村', '材', '松', '板', '柱', '根', '植', '枝', '机', '本', '札', '杉', '李', '杏', '東', '果', '柔', '栄', '桜', '梅', '検', '楽', '様', '横', '橋', '機', '樹'],

  // Plant family
  '艹': ['花', '芋', '芝', '芯', '芳', '芸', '苗', '苛', '若', '苦', '英', '茂', '茅', '茎', '茨', '茶', '草', '荒', '荘', '荷', '菊', '菌', '菓', '菜', '華', '萎', '萌', '萩', '落', '葉', '葛', '葬', '蒋', '蒐', '蒙', '蒲', '蒸', '蓄', '蓋', '蓑', '蓮'],

  // Mountain family
  '山': ['山', '岐', '岡', '岩', '岬', '岳', '岸', '峠', '峡', '峰', '島', '峻', '崇', '崎', '崖', '崩', '嵐', '嶺'],

  // Sun family
  '日': ['日', '旦', '旧', '旨', '早', '旬', '旺', '昆', '昇', '明', '易', '昔', '星', '映', '春', '昨', '昭', '是', '昼', '時', '晩', '普', '景', '晴', '晶', '暁', '暇', '暑', '暖', '暗', '暦', '暫', '暮', '暴', '曇', '曖', '曜', '曝'],

  // Moon family
  '月': ['月', '有', '服', '朋', '朗', '望', '朝', '期', '朧', '肌', '肝', '肺', '胃', '胸', '腕', '腰', '腸', '臓'],

  // Rain family
  '雨': ['雨', '雪', '雲', '零', '雷', '電', '需', '震', '霊', '霜', '霞', '霧', '露', '靄'],

  // Stone family
  '石': ['石', '砂', '研', '砕', '砲', '破', '硝', '硫', '硬', '碁', '碑', '確', '磁', '磨', '礁', '礎', '礫'],

  // Human family
  '人': ['人', '今', '仏', '他', '付', '代', '令', '以', '仮', '仲', '件', '任', '企', '伏', '伐', '休', '会', '伝', '伯', '伴', '伸', '似', '住', '位', '低', '依', '何', '余', '作', '使', '例', '供', '価', '便', '係', '促', '俊', '俗', '保', '信', '修'],
  '亻': ['仏', '他', '付', '代', '令', '以', '仮', '仲', '件', '任', '企', '伏', '伐', '休', '会', '伝', '伯', '伴', '伸', '似', '住', '位', '低', '依', '何', '余', '作', '使', '例', '供', '価', '便', '係', '促', '俊', '俗', '保', '信', '修'],

  // Woman family
  '女': ['女', '好', '妹', '姉', '始', '姿', '妻', '娘', '婚', '嫁', '婦', '媒', '嬢'],

  // Child family
  '子': ['子', '孔', '字', '存', '孝', '季', '学', '孫', '孤'],

  // Hand family
  '手': ['手', '打', '払', '扱', '批', '承', '技', '抄', '把', '抑', '投', '抗', '折', '抜', '択', '押', '抽', '担', '拍', '拐', '拒', '拓', '拘', '招', '拝', '拠', '拡', '括', '拾', '持', '指', '挑', '挙', '挟', '振', '挿', '捉', '捕', '捗', '捨', '掃', '授', '掌', '排', '掘', '掛', '採', '探', '接', '控', '推', '措', '掲', '描', '提', '揚', '換', '握', '揮', '援', '揺', '損', '搬', '搭', '携', '摂', '摘', '摩'],
  '扌': ['打', '払', '扱', '批', '承', '技', '抄', '把', '抑', '投', '抗', '折', '抜', '択', '押', '抽', '担', '拍', '拐', '拒', '拓', '拘', '招', '拝', '拠', '拡', '括', '拾', '持', '指', '挑', '挙', '挟', '振', '挿', '捉', '捕', '捗', '捨', '掃', '授', '掌', '排', '掘', '掛', '採', '探', '接', '控', '推', '措', '掲', '描', '提', '揚', '換', '握', '揮', '援', '揺', '損', '搬', '搭', '携', '摂', '摘', '摩'],

  // Mouth family
  '口': ['口', '古', '句', '叫', '召', '可', '台', '史', '右', '司', '号', '各', '合', '名', '吏', '吐', '向', '君', '否', '含', '吸', '吹', '呈', '呉', '告', '周', '味', '呼', '命', '和', '咲', '品', '員', '唄', '唆', '唇', '唐', '唯', '唱', '商', '問', '啓', '善', '喉', '喚', '喜', '喝', '喪', '喫', '営', '嗅', '嘆', '嘉', '嘱', '器', '噴', '嚇', '囁'],

  // Heart family
  '心': ['心', '必', '忌', '忍', '志', '忘', '忙', '応', '忠', '快', '念', '怒', '怖', '思', '怠', '急', '性', '怪', '恋', '恐', '恒', '恥', '恨', '恩', '恭', '息', '恵', '悔', '悟', '悠', '患', '悦', '悩', '悪', '悲', '悼', '情', '惑', '惜', '惨', '惰', '想', '愁', '愉', '意', '愚', '愛', '感', '慈', '態', '慌', '慎', '慕', '慢', '慣', '慨', '慮', '慰', '慶', '憂', '憎', '憤', '憧', '憩', '憲', '憶', '憾', '懇', '懐', '懲', '懸'],
  '忄': ['忙', '性', '怪', '恒', '恨', '恩', '恭', '悔', '悟', '悦', '悩', '悼', '情', '惑', '惜', '惨', '惰', '愁', '慌', '慎', '慢', '慣', '慨', '慮', '慰', '憂', '憎', '憤', '憧', '憩', '憶', '憾', '懐', '懲', '懸'],

  // Eye family
  '目': ['目', '盲', '直', '相', '盾', '省', '看', '県', '真', '眠', '眺', '眼', '着', '睡', '督', '瞬', '瞭', '瞳', '矛'],

  // Speech family
  '言': ['言', '計', '訂', '討', '訓', '託', '記', '訟', '訪', '設', '許', '訳', '訴', '診', '証', '詐', '詔', '評', '詞', '詠', '詣', '試', '詩', '詮', '詰', '話', '該', '詳', '誇', '誉', '誌', '認', '誓', '誕', '誘', '語', '誠', '誤', '説', '読', '課', '誰', '調', '談', '請', '論', '諦', '諧', '諭', '諮', '諸', '諾', '謀', '謁', '謄', '謎', '謙', '講', '謝', '謡', '謹', '識', '譜', '警', '議', '譲', '護', '讃'],

  // Vehicle family
  '車': ['車', '軌', '軍', '軒', '軟', '転', '軸', '軽', '較', '載', '輝', '輩', '輪', '輸', '轄', '轟'],

  // Thread family
  '糸': ['糸', '系', '糾', '紀', '約', '紅', '紋', '納', '紐', '純', '紙', '級', '紛', '素', '紡', '索', '紫', '累', '細', '紳', '紹', '紺', '終', '組', '経', '結', '絞', '絡', '給', '統', '絵', '絶', '絹', '継', '続', '維', '綱', '網', '綴', '綻', '綿', '緊', '総', '緑', '緒', '線', '締', '編', '緩', '緯', '練', '緻', '縁', '縄', '縛', '縦', '縫', '縮', '績', '繁', '繊', '織', '繕', '繭', '繰', '繹'],
};

function getKanjiForFamily(familyId: string): string[] {
  const family = KANJI_FAMILIES[familyId];
  if (!family) return [];

  // Get kanji for all components of this family
  const allKanji = new Set<string>();

  family.components.forEach(component => {
    const kanjiList = FAMILY_KANJI_MAP[component] || [];
    kanjiList.forEach(k => allKanji.add(k));
  });

  return Array.from(allKanji);
}

function getKanjiDetails(kanji: string) {
  // Simple mock details - in production, fetch from a kanji database
  return {
    kanji,
    meanings: ['meaning'],
    on_readings: ['on'],
    kun_readings: ['kun'],
    stroke_count: 10,
    jlpt: 3,
    grade: 3,
    frequency: 100
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const familyId = searchParams.get('family');
  const details = searchParams.get('details') === 'true';
  const crossFamilies = searchParams.get('crossFamilies') === 'true';

  if (!familyId) {
    return NextResponse.json({
      error: 'Family ID is required'
    }, { status: 400 });
  }

  const family = KANJI_FAMILIES[familyId];

  if (!family) {
    return NextResponse.json({
      error: 'Family not found'
    }, { status: 404 });
  }

  const kanjiList = getKanjiForFamily(familyId);

  const response = {
    family: familyId,
    label: family.label,
    labelJa: family.labelJa,
    color: family.color,
    icon: family.icon,
    note: family.note,
    components: family.components,
    count: kanjiList.length,
    kanji: details
      ? kanjiList.map(k => getKanjiDetails(k))
      : kanjiList
  };

  if (crossFamilies && family.relatedFamilies) {
    // Add cross-family data
    const crossFamilyKanji: any[] = [];
    family.relatedFamilies.forEach(relatedId => {
      const relatedKanji = getKanjiForFamily(relatedId);
      relatedKanji.forEach(k => {
        if (kanjiList.includes(k)) {
          crossFamilyKanji.push({
            kanji: k,
            families: [familyId, relatedId]
          });
        }
      });
    });
    (response as any).crossFamilyKanji = crossFamilyKanji;
  }

  return NextResponse.json(response);
}