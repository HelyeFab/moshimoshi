'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image, X, Link, Camera } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onImageAdded: (imageData: { type: 'image'; url: string; alt?: string }) => void;
  currentImage?: { url: string; alt?: string };
  onImageRemoved?: () => void;
  maxSizeMB?: number;
  className?: string;
}

export function ImageUpload({
  onImageAdded,
  currentImage,
  onImageRemoved,
  maxSizeMB = 2,
  className
}: ImageUploadProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage?.url || null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('flashcards.image.invalidType'));
      return;
    }

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      setError(t('flashcards.image.tooLarge', { size: maxSizeMB }));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPreview(base64);
        onImageAdded({
          type: 'image',
          url: base64,
          alt: file.name
        });
        setUploading(false);
      };

      reader.onerror = () => {
        setError(t('flashcards.image.uploadFailed'));
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(t('flashcards.image.uploadFailed'));
      setUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [maxSizeMB, onImageAdded, t]);

  const handleUrlSubmit = useCallback(() => {
    if (!imageUrl.trim()) return;

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      setError(t('flashcards.image.invalidUrl'));
      return;
    }

    // Check if URL is an image by trying to load it
    const img = new window.Image();
    img.onload = () => {
      setPreview(imageUrl);
      onImageAdded({
        type: 'image',
        url: imageUrl,
        alt: 'External image'
      });
      setImageUrl('');
      setShowUrlInput(false);
      setError(null);
    };

    img.onerror = () => {
      setError(t('flashcards.image.loadFailed'));
    };

    img.src = imageUrl;
  }, [imageUrl, onImageAdded, t]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    setError(null);
    setImageUrl('');
    setShowUrlInput(false);
    onImageRemoved?.();
  }, [onImageRemoved]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Handle pasted images
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const fakeEvent = {
            target: { files: [blob] }
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleFileSelect(fakeEvent);
        }
        break;
      }

      // Handle pasted URLs
      if (item.type === 'text/plain') {
        item.getAsString((text) => {
          if (text.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|svg)/i)) {
            setImageUrl(text);
            setShowUrlInput(true);
            setTimeout(() => handleUrlSubmit(), 100);
          }
        });
      }
    }
  }, [handleFileSelect, handleUrlSubmit]);

  return (
    <div className={cn("space-y-3", className)} onPaste={handlePaste}>
      {/* Current Image Preview */}
      {preview && (
        <div className="relative group">
          <img
            src={preview}
            alt="Card image"
            className="w-full max-h-48 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={t('common.remove')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Options */}
      {!preview && (
        <div className="space-y-2">
          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "w-full p-4 border-2 border-dashed rounded-lg transition-colors",
              "hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10",
              "flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">
              {uploading ? t('common.uploading') : t('flashcards.image.uploadFile')}
            </span>
            <span className="text-xs text-gray-500">
              {t('flashcards.image.maxSize', { size: maxSizeMB })}
            </span>
          </button>

          {/* URL Input Toggle */}
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="w-full p-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Link className="w-4 h-4" />
            {t('flashcards.image.useUrl')}
          </button>

          {/* Paste hint */}
          <p className="text-xs text-center text-gray-500 dark:text-gray-500">
            {t('flashcards.image.pasteHint')}
          </p>
        </div>
      )}

      {/* URL Input */}
      <AnimatePresence>
        {showUrlInput && !preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                placeholder={t('flashcards.image.urlPlaceholder')}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-soft-white dark:bg-dark-700 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!imageUrl.trim()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.add')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg"
        >
          {error}
        </motion.div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}