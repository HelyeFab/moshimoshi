/**
 * JLPT N5 and N4 Conjugatable Words Reference
 *
 * This file contains curated lists of verbs and adjectives commonly taught at N5 and N4 levels.
 * These serve as reference for classification when JLPT tags aren't available in JMDict.
 *
 * Sources: Standard JLPT curriculum, common textbooks (Genki, Minna no Nihongo)
 */

/**
 * JLPT N5 Verbs (~80 essential verbs)
 */
export const JLPT_N5_VERBS = [
  // Godan verbs (u-verbs)
  '会う', 'ある', '洗う', '言う', '歌う', '思う', '買う', '書く', '聞く',
  '行く', '泳ぐ', '話す', '出す', '立つ', '待つ', '持つ', '死ぬ', '飲む',
  '読む', '乗る', '乗る', '帰る', '切る', '知る', '売る', '取る', '撮る',
  '走る', '作る', '座る', '吸う', '住む', '遊ぶ', '呼ぶ', '飛ぶ', '歩く',
  '働く', '使う', '消す', '貸す', '押す', '渡す', '話す', '返す', '休む',
  '急ぐ', '脱ぐ', '泳ぐ', '曲がる', '始まる', '終わる', '困る', '登る',
  '止まる', '分かる', '要る', '送る', 'なる', '払う', '降る', 'もらう',
  '咲く', '磨く', '弾く', '引く', '開く', '着く', '置く', '聞く',

  // Ichidan verbs (ru-verbs)
  '食べる', '見る', '寝る', '起きる', '教える', '出る', '入る', 'いる',
  '開ける', '閉める', '捨てる', 'つける', '消える', '疲れる', '忘れる',
  '借りる', '降りる', '浴びる', '着る', '信じる', 'できる', '変える',
  '掛ける', '覚える', '考える', '答える', '受ける', '集める', '勤める',

  // Irregular verbs
  'する', '来る', '勉強する', '散歩する', '料理する', '掃除する',
  '洗濯する', '買い物する', '運動する'
];

/**
 * JLPT N4 Verbs (~100 intermediate verbs)
 */
export const JLPT_N4_VERBS = [
  // Godan verbs
  '合う', '上がる', '預かる', '当たる', '集まる', '謝る', '誤る', '改まる',
  '余る', '現れる', '争う', '表す', '生まれる', '祝う', '打つ', '映る',
  '選ぶ', '送る', '落ちる', '驚く', '踊る', '下ろす', '思い出す', '折る',
  '下がる', '探す', '冷ます', '騒ぐ', '誘う', '育つ', '続く', '包む',
  '並ぶ', '直す', '治す', '慣れる', '鳴る', '似る', '逃げる', '抜く',
  '盗む', '残る', '運ぶ', '晴れる', '冷える', '増える', '曲げる', '混む',
  '焼く', '約束する', '破る', '笑う', '汚す', '起こす', '怒る', '驚く',
  '落とす', '訪ねる', '頼む', '足りる', '違う', '通る', '伝える', '届く',
  '鳴く', '治る', '習う', '並べる', '抜ける', '盗む', '運ぶ', '冷やす',
  '太る', '痩せる', '拾う', '触る', '捕まえる', '逃す', '掴む', '直る',

  // Ichidan verbs
  '開ける', '預ける', '生きる', '遅れる', '覚える', '変える', '片付ける',
  '調べる', 'つける', '伝える', '並べる', '慣れる', '逃げる', '離れる',
  '増やす', '見つける', '焼ける', '破れる', '汚れる', '折れる', '割れる',
  '育てる', '植える', '捨てる', '建てる', '倒れる', '溶ける', '解ける',

  // Irregular verbs
  '持って来る', '連れて来る', '案内する', '失敗する', '成功する',
  '相談する', '紹介する', '説明する', '質問する', '予約する', '連絡する',
  '用意する', '利用する', '注意する', '心配する', '出発する', '到着する',
  '参加する', '卒業する', '留学する', '輸出する', '輸入する'
];

/**
 * JLPT N5 I-Adjectives (~30 essential i-adjectives)
 */
export const JLPT_N5_I_ADJECTIVES = [
  '新しい', '熱い', '暑い', '厚い', '危ない', 'いい', '良い', '忙しい',
  '大きい', '美味しい', '遅い', '重い', '面白い', '軽い', '辛い', '寒い',
  '黄色い', '汚い', '暗い', '近い', '黒い', '詳しい', '涼しい', '寂しい',
  '白い', '狭い', '正しい', '楽しい', '強い', '冷たい', '小さい', '近い',
  '遠い', 'とても', '長い', '速い', '早い', '低い', '高い', '悪い',
  '難しい', '眠い', '若い', '古い', '太い', '細い', '欲しい', '易しい',
  '優しい', '安い', '柔らかい', '硬い', '丸い', '四角い', '軽い', '重い',
  '広い', '深い', '浅い', '明るい', '暗い', '温かい', '冷たい'
];

/**
 * JLPT N5 Na-Adjectives (~20 essential na-adjectives)
 */
export const JLPT_N5_NA_ADJECTIVES = [
  '綺麗', '静か', '賑やか', '元気', '有名', '親切', '大切', '便利',
  '不便', '簡単', '大変', '好き', '嫌い', '上手', '下手', '暇',
  '丈夫', '素敵', '色々', '同じ', '特別', '自由', '安全', '危険',
  '確か', '幸せ', '不幸', '真面目', 'いろいろ'
];

/**
 * JLPT N4 I-Adjectives (~40 intermediate i-adjectives)
 */
export const JLPT_N4_I_ADJECTIVES = [
  '珍しい', '素晴らしい', '怖い', '恐ろしい', '嬉しい', '悲しい',
  '懐かしい', '恥ずかしい', '羨ましい', '可笑しい', '恐ろしい',
  '厳しい', '優しい', '激しい', '正しい', '著しい', '親しい',
  '貧しい', '甘い', '苦い', '酸っぱい', '痛い', '痒い', '眠い',
  '怪しい', '厚かましい', '情けない', '頼もしい', '美しい',
  '麗しい', '勇ましい', '騒がしい', '煩い', '騒々しい', '心細い',
  '物凄い', '凄まじい', 'ふさわしい', '相応しい', '望ましい'
];

/**
 * JLPT N4 Na-Adjectives (~30 intermediate na-adjectives)
 */
export const JLPT_N4_NA_ADJECTIVES = [
  '正確', '適当', '十分', '不十分', '完全', '不完全', '複雑', '単純',
  '明確', '不明確', '自然', '不自然', '普通', '異常', '正常', '健康',
  '病気', '丁寧', '乱暴', '親切', '失礼', '必要', '不必要', '可能',
  '不可能', '十分', '不十分', '独特', '様々', '色々', '別々', '一緒',
  '熱心', '真剣', '適当', '大雑把', '慎重', '軽率', '素直', '頑固',
  '派手', '地味', '豊か', '貧しい', '平和', '平等'
];

/**
 * Helper function to check if a word is in N5 lists
 */
export function isN5Word(kanji: string, kana: string, type: 'verb' | 'i-adjective' | 'na-adjective'): boolean {
  const lists = {
    'verb': JLPT_N5_VERBS,
    'i-adjective': JLPT_N5_I_ADJECTIVES,
    'na-adjective': JLPT_N5_NA_ADJECTIVES
  };

  const list = lists[type];
  return list.includes(kanji) || list.includes(kana);
}

/**
 * Helper function to check if a word is in N4 lists
 */
export function isN4Word(kanji: string, kana: string, type: 'verb' | 'i-adjective' | 'na-adjective'): boolean {
  const lists = {
    'verb': JLPT_N4_VERBS,
    'i-adjective': JLPT_N4_I_ADJECTIVES,
    'na-adjective': JLPT_N4_NA_ADJECTIVES
  };

  const list = lists[type];
  return list.includes(kanji) || list.includes(kana);
}

/**
 * Get JLPT level for a word
 */
export function getJLPTLevel(kanji: string, kana: string, type: 'verb' | 'i-adjective' | 'na-adjective'): 'N5' | 'N4' | 'N3+' {
  if (isN5Word(kanji, kana, type)) return 'N5';
  if (isN4Word(kanji, kana, type)) return 'N4';
  return 'N3+';
}
