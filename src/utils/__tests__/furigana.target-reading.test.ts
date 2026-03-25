import { generateTargetKanjiRuby } from '../furigana'

describe('generateTargetKanjiRuby', () => {
  it('renders the target kanji with the card target reading instead of inferred whole-word furigana', () => {
    const html = generateTargetKanjiRuby('日本人', '人', 'じん')

    expect(html).toContain('<ruby>人<rp>(</rp><rt>じん</rt><rp>)</rp></ruby>')
    expect(html).toContain('日')
    expect(html).toContain('本')
    expect(html).not.toContain('<rt>ひと</rt>')
  })

  it('supports irregular whole-word readings by teaching the target reading only', () => {
    const html = generateTargetKanjiRuby('9日', '日', 'か')

    expect(html).toBe('9<ruby>日<rp>(</rp><rt>か</rt><rp>)</rp></ruby>')
    expect(html).not.toContain('<rt>にち</rt>')
  })

  it('applies the target reading to every occurrence of the target kanji in the word', () => {
    const html = generateTargetKanjiRuby('人人', '人', 'にん')

    expect(html).toBe(
      '<ruby>人<rp>(</rp><rt>にん</rt><rp>)</rp></ruby><ruby>人<rp>(</rp><rt>にん</rt><rp>)</rp></ruby>'
    )
  })

  it('escapes non-target text while still rendering ruby for the target kanji', () => {
    const html = generateTargetKanjiRuby('人<', '人', 'じん')

    expect(html).toBe('<ruby>人<rp>(</rp><rt>じん</rt><rp>)</rp></ruby>&lt;')
  })

  it('falls back to escaped plain text when required inputs are missing', () => {
    expect(generateTargetKanjiRuby('人<', '', 'じん')).toBe('人&lt;')
    expect(generateTargetKanjiRuby('人<', '人', '')).toBe('人&lt;')
  })
})
