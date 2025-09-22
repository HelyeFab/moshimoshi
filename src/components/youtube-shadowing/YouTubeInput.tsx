'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';

interface YouTubeInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export default function YouTubeInput({ onSubmit, isLoading }: YouTubeInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { t, strings } = useI18n();

  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[\w-]+.*$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+.*$/,
      /^(https?:\/\/)?(m\.)?youtube\.com\/watch\?v=[\w-]+.*$/,
      /^(https?:\/\/)?(music\.)?youtube\.com\/watch\?v=[\w-]+.*$/
    ];

    return patterns.some(pattern => pattern.test(url));
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)([\w-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError(strings.youtubeShadowing.errors.emptyUrl);
      return;
    }

    if (!validateYouTubeUrl(trimmedUrl)) {
      setError(strings.youtubeShadowing.errors.invalidUrl);
      return;
    }

    const videoId = extractVideoId(trimmedUrl);
    if (!videoId) {
      setError(strings.youtubeShadowing.errors.extractFailed);
      return;
    }

    // Normalize URL to standard format
    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
    onSubmit(normalizedUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="youtube-url"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {strings.youtubeShadowing.input.youtubeTitle}
        </label>
        <div className="relative">
          <input
            id="youtube-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={strings.youtubeShadowing.input.placeholder}
            className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 dark:border-dark-600 rounded-lg
                     focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none
                     transition-colors bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100
                     placeholder-gray-400 dark:placeholder-gray-500"
            disabled={isLoading}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-6 h-6 text-gray-400 dark:text-gray-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16.5v-9l8 4.5-8 4.5z"/>
            </svg>
          </div>
          {url && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setUrl('');
                setError('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5
                       hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md transition-colors"
              aria-label={t('common.clear')}
            >
              <svg
                className="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 bg-primary-500 text-white font-medium rounded-lg
                 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-colors dark:focus:ring-offset-dark-800"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('common.processing')}
          </span>
        ) : (
          strings.youtubeShadowing.input.extract
        )}
      </button>

      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p className="mb-2">{strings.youtubeShadowing.input.supportedFormats}</p>
        <ul className="list-disc list-inside space-y-1 text-gray-400 dark:text-gray-500">
          <li>youtube.com/watch?v=...</li>
          <li>youtu.be/...</li>
          <li>youtube.com/shorts/...</li>
          <li>m.youtube.com/watch?v=...</li>
          <li>music.youtube.com/watch?v=...</li>
        </ul>
      </div>
    </form>
  );
}