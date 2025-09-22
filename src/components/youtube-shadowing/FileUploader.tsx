'use client';

import { useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { motion } from 'framer-motion';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  maxSizeMB?: number;
}

export default function FileUploader({ onFileSelect, isLoading, maxSizeMB = 100 }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const { t, strings } = useI18n();

  const acceptedFormats = '.mp4,.mp3,.wav,.m4a,.webm,.ogg';
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError('');

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const acceptedExtensions = acceptedFormats.split(',');
    if (!acceptedExtensions.includes(fileExtension)) {
      setError(`Invalid file type. ${strings.youtubeShadowing.input.acceptedFormats}`);
      return;
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      setError(`File too large. ${strings.youtubeShadowing.input.maxSize} ${maxSizeMB}MB`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file: File): string => {
    if (file.type.startsWith('video/')) return '🎬';
    if (file.type.startsWith('audio/')) return '🎵';
    return '📄';
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
          dragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
            : 'border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats}
          onChange={handleFileInput}
          className="hidden"
          disabled={isLoading}
        />

        <div className="text-center">
          {selectedFile ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-3"
            >
              <div className="text-5xl">{getFileIcon(selectedFile)}</div>
              <div className="space-y-1">
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              {isLoading && (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('common.processing')}
                  </span>
                </div>
              )}
              {!isLoading && (
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setError('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400
                           dark:hover:text-gray-200 underline transition-colors"
                >
                  {t('common.clear')}
                </button>
              )}
            </motion.div>
          ) : (
            <>
              <div className="text-5xl mb-4">
                {dragActive ? '📥' : '📤'}
              </div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                {dragActive
                  ? 'Drop your file here'
                  : 'Drag and drop your media file here'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('common.or')}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary-500 text-white font-medium rounded-lg
                         hover:bg-primary-600 focus:outline-none focus:ring-2
                         focus:ring-primary-500 focus:ring-offset-2 transition-colors
                         dark:focus:ring-offset-dark-800"
              >
                {strings.youtubeShadowing.input.uploadButton}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200
                   dark:border-red-800 rounded-lg"
        >
          <p className="text-sm text-red-800 dark:text-red-200">
            {error}
          </p>
        </motion.div>
      )}

      <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
        <p className="flex items-center gap-2">
          <span>📏</span>
          <span>{strings.youtubeShadowing.input.maxSize} {maxSizeMB}MB</span>
        </p>
        <p className="flex items-center gap-2">
          <span>📁</span>
          <span>{strings.youtubeShadowing.input.acceptedFormats}</span>
        </p>
      </div>
    </div>
  );
}