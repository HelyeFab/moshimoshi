import { NextRequest, NextResponse } from 'next/server';

// Simple furigana generation using basic patterns
// In production, you'd want to use a proper library like kuromoji or MeCab
function generateFurigana(text: string): string {
  // Common kanji-to-furigana mappings for news articles
  const furiganaMap: Record<string, string> = {
    '日本': '<ruby>日本<rt>にほん</rt></ruby>',
    '今日': '<ruby>今日<rt>きょう</rt></ruby>',
    '明日': '<ruby>明日<rt>あした</rt></ruby>',
    '昨日': '<ruby>昨日<rt>きのう</rt></ruby>',
    '時間': '<ruby>時間<rt>じかん</rt></ruby>',
    '学校': '<ruby>学校<rt>がっこう</rt></ruby>',
    '先生': '<ruby>先生<rt>せんせい</rt></ruby>',
    '生徒': '<ruby>生徒<rt>せいと</rt></ruby>',
    '勉強': '<ruby>勉強<rt>べんきょう</rt></ruby>',
    '会社': '<ruby>会社<rt>かいしゃ</rt></ruby>',
    '仕事': '<ruby>仕事<rt>しごと</rt></ruby>',
    '電車': '<ruby>電車<rt>でんしゃ</rt></ruby>',
    '自動車': '<ruby>自動車<rt>じどうしゃ</rt></ruby>',
    '飛行機': '<ruby>飛行機<rt>ひこうき</rt></ruby>',
    '空港': '<ruby>空港<rt>くうこう</rt></ruby>',
    '駅': '<ruby>駅<rt>えき</rt></ruby>',
    '東京': '<ruby>東京<rt>とうきょう</rt></ruby>',
    '大阪': '<ruby>大阪<rt>おおさか</rt></ruby>',
    '京都': '<ruby>京都<rt>きょうと</rt></ruby>',
    '北海道': '<ruby>北海道<rt>ほっかいどう</rt></ruby>',
    '政府': '<ruby>政府<rt>せいふ</rt></ruby>',
    '経済': '<ruby>経済<rt>けいざい</rt></ruby>',
    '社会': '<ruby>社会<rt>しゃかい</rt></ruby>',
    '文化': '<ruby>文化<rt>ぶんか</rt></ruby>',
    '技術': '<ruby>技術<rt>ぎじゅつ</rt></ruby>',
    '科学': '<ruby>科学<rt>かがく</rt></ruby>',
    '医療': '<ruby>医療<rt>いりょう</rt></ruby>',
    '病院': '<ruby>病院<rt>びょういん</rt></ruby>',
    '健康': '<ruby>健康<rt>けんこう</rt></ruby>',
    '環境': '<ruby>環境<rt>かんきょう</rt></ruby>',
    '問題': '<ruby>問題<rt>もんだい</rt></ruby>',
    '解決': '<ruby>解決<rt>かいけつ</rt></ruby>',
    '発表': '<ruby>発表<rt>はっぴょう</rt></ruby>',
    '研究': '<ruby>研究<rt>けんきゅう</rt></ruby>',
    '開発': '<ruby>開発<rt>かいはつ</rt></ruby>',
    '計画': '<ruby>計画<rt>けいかく</rt></ruby>',
    '会議': '<ruby>会議<rt>かいぎ</rt></ruby>',
    '報告': '<ruby>報告<rt>ほうこく</rt></ruby>',
    '新聞': '<ruby>新聞<rt>しんぶん</rt></ruby>',
    '記事': '<ruby>記事<rt>きじ</rt></ruby>',
    '情報': '<ruby>情報<rt>じょうほう</rt></ruby>',
    '連絡': '<ruby>連絡<rt>れんらく</rt></ruby>',
    '電話': '<ruby>電話<rt>でんわ</rt></ruby>',
    '携帯': '<ruby>携帯<rt>けいたい</rt></ruby>',
    '写真': '<ruby>写真<rt>しゃしん</rt></ruby>',
    '映画': '<ruby>映画<rt>えいが</rt></ruby>',
    '音楽': '<ruby>音楽<rt>おんがく</rt></ruby>',
    '運動': '<ruby>運動<rt>うんどう</rt></ruby>',
    '試合': '<ruby>試合<rt>しあい</rt></ruby>',
    '選手': '<ruby>選手<rt>せんしゅ</rt></ruby>',
    '大会': '<ruby>大会<rt>たいかい</rt></ruby>',
    '世界': '<ruby>世界<rt>せかい</rt></ruby>',
    '国際': '<ruby>国際<rt>こくさい</rt></ruby>',
    '外国': '<ruby>外国<rt>がいこく</rt></ruby>',
    '安全': '<ruby>安全<rt>あんぜん</rt></ruby>',
    '危険': '<ruby>危険<rt>きけん</rt></ruby>',
    '事故': '<ruby>事故<rt>じこ</rt></ruby>',
    '災害': '<ruby>災害<rt>さいがい</rt></ruby>',
    '地震': '<ruby>地震<rt>じしん</rt></ruby>',
    '台風': '<ruby>台風<rt>たいふう</rt></ruby>',
    '天気': '<ruby>天気<rt>てんき</rt></ruby>',
    '気温': '<ruby>気温<rt>きおん</rt></ruby>',
    '季節': '<ruby>季節<rt>きせつ</rt></ruby>',
    '春': '<ruby>春<rt>はる</rt></ruby>',
    '夏': '<ruby>夏<rt>なつ</rt></ruby>',
    '秋': '<ruby>秋<rt>あき</rt></ruby>',
    '冬': '<ruby>冬<rt>ふゆ</rt></ruby>',
    '朝': '<ruby>朝<rt>あさ</rt></ruby>',
    '昼': '<ruby>昼<rt>ひる</rt></ruby>',
    '夜': '<ruby>夜<rt>よる</rt></ruby>',
    '月': '<ruby>月<rt>つき</rt></ruby>',
    '年': '<ruby>年<rt>ねん</rt></ruby>',
    '週': '<ruby>週<rt>しゅう</rt></ruby>',
    '人': '<ruby>人<rt>ひと</rt></ruby>',
    '子供': '<ruby>子供<rt>こども</rt></ruby>',
    '大人': '<ruby>大人<rt>おとな</rt></ruby>',
    '男性': '<ruby>男性<rt>だんせい</rt></ruby>',
    '女性': '<ruby>女性<rt>じょせい</rt></ruby>',
    '家族': '<ruby>家族<rt>かぞく</rt></ruby>',
    '友達': '<ruby>友達<rt>ともだち</rt></ruby>',
    '食事': '<ruby>食事<rt>しょくじ</rt></ruby>',
    '料理': '<ruby>料理<rt>りょうり</rt></ruby>',
    '野菜': '<ruby>野菜<rt>やさい</rt></ruby>',
    '果物': '<ruby>果物<rt>くだもの</rt></ruby>',
    '魚': '<ruby>魚<rt>さかな</rt></ruby>',
    '肉': '<ruby>肉<rt>にく</rt></ruby>',
    '水': '<ruby>水<rt>みず</rt></ruby>',
    '店': '<ruby>店<rt>みせ</rt></ruby>',
    '買い物': '<ruby>買い物<rt>かいもの</rt></ruby>',
    '値段': '<ruby>値段<rt>ねだん</rt></ruby>',
    '商品': '<ruby>商品<rt>しょうひん</rt></ruby>',
    '市場': '<ruby>市場<rt>しじょう</rt></ruby>',
    '銀行': '<ruby>銀行<rt>ぎんこう</rt></ruby>',
    '会長': '<ruby>会長<rt>かいちょう</rt></ruby>',
    '社長': '<ruby>社長<rt>しゃちょう</rt></ruby>',
    '首相': '<ruby>首相<rt>しゅしょう</rt></ruby>',
    '大統領': '<ruby>大統領<rt>だいとうりょう</rt></ruby>',
    '警察': '<ruby>警察<rt>けいさつ</rt></ruby>',
    '消防': '<ruby>消防<rt>しょうぼう</rt></ruby>',
    '病気': '<ruby>病気<rt>びょうき</rt></ruby>',
    '薬': '<ruby>薬<rt>くすり</rt></ruby>',
    '手術': '<ruby>手術<rt>しゅじゅつ</rt></ruby>',
    '治療': '<ruby>治療<rt>ちりょう</rt></ruby>',
    '予防': '<ruby>予防<rt>よぼう</rt></ruby>',
    '感染': '<ruby>感染<rt>かんせん</rt></ruby>',
    '対策': '<ruby>対策<rt>たいさく</rt></ruby>',
    '影響': '<ruby>影響<rt>えいきょう</rt></ruby>',
    '原因': '<ruby>原因<rt>げんいん</rt></ruby>',
    '結果': '<ruby>結果<rt>けっか</rt></ruby>',
    '理由': '<ruby>理由<rt>りゆう</rt></ruby>',
    '目的': '<ruby>目的<rt>もくてき</rt></ruby>',
    '方法': '<ruby>方法<rt>ほうほう</rt></ruby>',
    '場所': '<ruby>場所<rt>ばしょ</rt></ruby>',
    '地域': '<ruby>地域<rt>ちいき</rt></ruby>',
    '都市': '<ruby>都市<rt>とし</rt></ruby>',
    '田舎': '<ruby>田舎<rt>いなか</rt></ruby>',
    '自然': '<ruby>自然<rt>しぜん</rt></ruby>',
    '動物': '<ruby>動物<rt>どうぶつ</rt></ruby>',
    '植物': '<ruby>植物<rt>しょくぶつ</rt></ruby>',
    '海': '<ruby>海<rt>うみ</rt></ruby>',
    '山': '<ruby>山<rt>やま</rt></ruby>',
    '川': '<ruby>川<rt>かわ</rt></ruby>',
    '空': '<ruby>空<rt>そら</rt></ruby>',
    '雨': '<ruby>雨<rt>あめ</rt></ruby>',
    '雪': '<ruby>雪<rt>ゆき</rt></ruby>',
    '風': '<ruby>風<rt>かぜ</rt></ruby>',
    '太陽': '<ruby>太陽<rt>たいよう</rt></ruby>'
  };

  let result = text;

  // Sort by length (longer phrases first) to avoid partial replacements
  const sortedKeys = Object.keys(furiganaMap).sort((a, b) => b.length - a.length);

  for (const kanji of sortedKeys) {
    // Use regex with word boundaries where appropriate
    const regex = new RegExp(kanji, 'g');
    result = result.replace(regex, furiganaMap[kanji]);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Generate furigana
    const result = generateFurigana(text);

    return NextResponse.json({
      success: true,
      result: result,
      tokenCount: text.length
    });
  } catch (error) {
    console.error('Error generating furigana:', error);
    return NextResponse.json(
      { error: 'Failed to generate furigana' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    status: 'healthy',
    message: 'Furigana API is running'
  });
}