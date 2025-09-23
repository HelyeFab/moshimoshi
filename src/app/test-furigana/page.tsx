'use client'

import { useState, useEffect } from 'react'
import KuromojiService from '@/utils/kuromojiService'

export default function TestFuriganaPage() {
  const [originalText, setOriginalText] = useState('今日は学校に行きました。')
  const [furiganaText, setFuriganaText] = useState('')
  const [loading, setLoading] = useState(false)

  const testFurigana = async () => {
    setLoading(true)
    const kuromoji = KuromojiService.getInstance()

    try {
      console.log('Testing with text:', originalText)
      const result = await kuromoji.addFurigana(originalText)
      console.log('Furigana result:', result)
      setFuriganaText(result)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    testFurigana()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Furigana Test Page</h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-2">Input Text:</label>
          <input
            type="text"
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          onClick={testFurigana}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Generate Furigana'}
        </button>

        <div className="space-y-2">
          <h2 className="font-semibold">Original:</h2>
          <div className="p-4 bg-gray-100 rounded">{originalText}</div>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold">With Furigana (Raw HTML):</h2>
          <div className="p-4 bg-gray-100 rounded font-mono text-sm break-all">{furiganaText}</div>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold">Rendered:</h2>
          <div
            className="p-4 bg-gray-100 rounded text-2xl"
            dangerouslySetInnerHTML={{ __html: furiganaText }}
          />
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold">Direct Ruby Test:</h2>
          <div className="p-4 bg-gray-100 rounded text-2xl">
            <ruby>今日<rt>きょう</rt></ruby>は
            <ruby>学校<rt>がっこう</rt></ruby>に
            <ruby>行<rt>い</rt></ruby>きました。
          </div>
        </div>
      </div>
    </div>
  )
}