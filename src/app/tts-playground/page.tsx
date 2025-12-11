'use client'

import { useState, useRef } from 'react'

type VoiceOption = {
  value: string
  label: string
  hint?: string
}

const voicevoxOptions: VoiceOption[] = [
  { value: '11', label: '11 · VOICEVOX Nemo (female)' },
  { value: '13', label: '13 · VOICEVOX Aoyama Ryusei (male)' },
  { value: '3', label: '3 · VOICEVOX Zundamon (soft masc)' },
  { value: '1', label: '1 · VOICEVOX Shikoku Metan (bright female)' },
  { value: '8', label: '8 · VOICEVOX Kasukabe Tsumugi (calm female)' },
  { value: '12', label: '12 · VOICEVOX Oto Kishi (gentle female)' },
  { value: '14', label: '14 · VOICEVOX WhiteCUL (clear female)' },
  { value: '16', label: '16 · VOICEVOX Kyomachi Seika (warm female)' },
  { value: '20', label: '20 · VOICEVOX Tojo Luka (youthful male)' },
  { value: '21', label: '21 · VOICEVOX Amasawa Koharu (soft female)' },
  { value: '23', label: '23 · VOICEVOX No. 23 (energetic female)' },
  { value: '24', label: '24 · VOICEVOX Natsuki Karin (husky female)' },
  { value: '29', label: '29 · VOICEVOX No. 29 (bright male)' },
  { value: '42', label: '42 · VOICEVOX Shirakawa Yui (relaxed female)' },
  { value: '46', label: '46 · VOICEVOX Ado Roki (soft female)' },
]

const edgeOptions: VoiceOption[] = [
  { value: 'ja-JP-NanamiNeural', label: 'Edge Nanami (fallback female)', hint: 'Edge TTS' },
  { value: 'ja-JP-KeitaNeural', label: 'Edge Keita (fallback male)', hint: 'Edge TTS' },
]

export default function TTSPlaygroundPage() {
  const [text, setText] = useState('こんにちは、今日はとてもいい天気ですね。')
  const [voice, setVoice] = useState<string>('11')
  const [speed, setSpeed] = useState<number>(0.75)
  const [pitch, setPitch] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [cached, setCached] = useState<boolean | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handleSynthesize = async () => {
    if (!text.trim()) {
      setError('テキストを入力してください。')
      return
    }

    setLoading(true)
    setError(null)
    setAudioUrl(null)
    setProvider(null)
    setCached(null)

    try {
      const response = await fetch('/api/tts/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
          speed,
          pitch,
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'TTS synthesis failed')
      }

      const data = await response.json()
      const result = data.data || data
      const url = result.audioUrl

      setAudioUrl(url)
      setProvider(result.provider || null)
      setCached(typeof result.cached === 'boolean' ? result.cached : null)

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.src = url.includes('googleapis.com')
          ? `/api/tts/proxy?url=${encodeURIComponent(url)}`
          : url
        await audioRef.current.play()
      }
    } catch (err: any) {
      setError(err.message || 'Synthesis failed')
    } finally {
      setLoading(false)
    }
  }

  const handlePlay = async () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      await audioRef.current.play()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-4">Japanese TTS Playground</h1>
        <p className="text-slate-300 mb-6">
          Paste Japanese text, pick a speaker, and tweak speed to hear the output.
        </p>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Text
            <textarea
              className="mt-2 w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="日本語の文章を入力してください。"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-200">VOICEVOX speakers</div>
              <select
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={voice}
                onChange={e => setVoice(e.target.value)}
              >
                {voicevoxOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-400">
                Enter any VOICEVOX speaker ID (numeric) to test voices beyond this list.
              </div>
              <input
                type="text"
                value={voice}
                onChange={e => setVoice(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., 11"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-200">Edge TTS fallbacks</div>
              <select
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onChange={e => setVoice(e.target.value)}
                value={edgeOptions.find(v => v.value === voice)?.value || ''}
              >
                <option value="">Select Edge voice</option>
                {edgeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.hint ? ` (${option.hint})` : ''}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-400">Use if VOICEVOX is unavailable.</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-slate-200">
            Speed (0.5 – 1.5)
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={speed}
                onChange={e => setSpeed(parseFloat(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                step={0.05}
                min={0.5}
                max={1.5}
                value={speed}
                onChange={e => setSpeed(parseFloat(e.target.value) || 0.75)}
                className="w-20 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Pitch (-10 to 10)
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={-10}
                max={10}
                step={1}
                value={pitch}
                onChange={e => setPitch(parseInt(e.target.value, 10))}
                className="flex-1"
              />
              <input
                type="number"
                step={1}
                min={-10}
                max={10}
                value={pitch}
                onChange={e => setPitch(parseInt(e.target.value, 10) || 0)}
                className="w-20 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
              />
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSynthesize}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? 'Generating…' : 'Generate & Play'}
            </button>
            <button
              onClick={handlePlay}
              disabled={!audioUrl || loading}
              className="px-4 py-2 rounded-md bg-slate-800 text-slate-100 font-semibold border border-slate-700 hover:bg-slate-700 disabled:opacity-50"
            >
              Replay
            </button>
            <button
              onClick={() =>
                setText('次の文章を読み上げてみてください。速度を変えて自然さを確認しましょう。')
              }
              disabled={loading}
              className="px-4 py-2 rounded-md bg-slate-800 text-slate-100 font-semibold border border-slate-700 hover:bg-slate-700 disabled:opacity-50"
            >
              Load Sample Text
            </button>
          </div>

          {error && <div className="text-sm text-rose-400">Error: {error}</div>}

          {audioUrl && (
            <div className="text-sm text-slate-300 space-y-1">
              <div>Audio ready. {provider ? `Provider: ${provider}` : ''}</div>
              {cached !== null && <div>Cached: {cached ? 'yes' : 'no'}</div>}
              <audio ref={audioRef} controls className="w-full" src={audioUrl} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
