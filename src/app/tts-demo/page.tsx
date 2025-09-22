'use client';

import React, { useState } from 'react';
import SpeakerIcon from '@/components/ui/SpeakerIcon';
import AudioPlayer from '@/components/ui/AudioPlayer';
import TTSText from '@/components/ui/TTSText';
import { useTTS } from '@/hooks/useTTS';

export default function TTSDemoPage() {
  const [customText, setCustomText] = useState('');
  const { play, preload, queue, playing, loading } = useTTS();

  // Sample texts for testing
  const hiragana = ['あ', 'い', 'う', 'え', 'お'];
  const katakana = ['ア', 'イ', 'ウ', 'エ', 'オ'];
  const words = ['こんにちは', 'ありがとう', 'さようなら', 'おはよう', 'こんばんは'];
  const sentences = [
    '日本語を勉強しています。',
    '今日は天気がいいですね。',
    'これは素晴らしいテストです。',
  ];

  const handlePreloadAll = async () => {
    await preload([...hiragana, ...katakana, ...words]);
  };

  const handleQueueStory = () => {
    queue([
      { text: 'むかしむかし', delay: 0 },
      { text: 'あるところに', delay: 500 },
      { text: 'おじいさんとおばあさんが', delay: 500 },
      { text: '住んでいました。', delay: 500 },
    ]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          TTS System Demo
        </h1>

        {/* Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-8">
          <h2 className="text-lg font-semibold mb-2">Status</h2>
          <div className="flex gap-4 text-sm">
            <span>Playing: {playing ? '✅' : '❌'}</span>
            <span>Loading: {loading ? '✅' : '❌'}</span>
          </div>
        </div>

        {/* Hiragana Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Hiragana (Google TTS)</h2>
          <div className="flex flex-wrap gap-4">
            {hiragana.map(char => (
              <div key={char} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-2xl">{char}</span>
                <SpeakerIcon text={char} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Katakana Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Katakana (Google TTS)</h2>
          <div className="flex flex-wrap gap-4">
            {katakana.map(char => (
              <div key={char} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-2xl">{char}</span>
                <SpeakerIcon text={char} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Common Words */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Common Words (ElevenLabs)</h2>
          <div className="space-y-2">
            {words.map(word => (
              <div key={word} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <TTSText iconPosition="left" iconSize="md">
                  {word}
                </TTSText>
              </div>
            ))}
          </div>
        </div>

        {/* Sentences with Audio Player */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Sentences with Player (ElevenLabs)</h2>
          <div className="space-y-4">
            {sentences.map((sentence, index) => (
              <div key={index}>
                <p className="mb-2">{sentence}</p>
                <AudioPlayer
                  text={sentence}
                  showControls={true}
                  showProgress={true}
                  showTime={true}
                  showSpeed={true}
                  showVolume={true}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Custom Text Input */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Custom Text</h2>
          <div className="space-y-4">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Enter Japanese text here..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => play(customText)}
                disabled={!customText || loading}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                Play Custom Text
              </button>
              <button
                onClick={() => play(customText, { provider: 'google' })}
                disabled={!customText || loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Force Google TTS
              </button>
              <button
                onClick={() => play(customText, { provider: 'elevenlabs' })}
                disabled={!customText || loading}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                Force ElevenLabs
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Features */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Advanced Features</h2>
          <div className="space-y-4">
            <button
              onClick={handlePreloadAll}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Preload All Basic Audio
            </button>
            <button
              onClick={handleQueueStory}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              Play Story Queue
            </button>
            <button
              onClick={async () => {
                const response = await fetch('/api/tts/cache/stats');
                const stats = await response.json();
                console.log('Cache Stats:', stats);
                alert(`Cache Stats:\nTotal Entries: ${stats.totalEntries}\nTotal Size: ${stats.totalSizeFormatted}`);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Check Cache Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}