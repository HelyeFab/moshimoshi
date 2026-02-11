'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import Link from 'next/link';
import { JLPT_LEVELS, DECK_LANGUAGES, MAX_APKG_SIZE_BYTES, ALLOWED_EXTENSIONS } from '@/types/deckmarket';
import { Select } from '@/components/ui/Select';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminDeckMarketCreatePage() {
  const { strings } = useI18n();
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [jlpt, setJlpt] = useState<string>('');
  const [language, setLanguage] = useState('ja');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [importSource, setImportSource] = useState<'apkg' | 'csv'>('apkg');
  const [file, setFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [changelog, setChangelog] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, adminLoading, router]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugEdited) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugEdited(true);
    setSlug(value);
  };

  const applyPrefillFromFilename = (filename: string) => {
    const withoutExt = filename.replace(/\.[^/.]+$/, '');
    const trimmed = withoutExt.trim();
    if (!trimmed) return;

    if (!title) {
      setTitle(trimmed);
    }

    if (!slugEdited) {
      setSlug(generateSlug(trimmed));
    }

    if (!versionLabel) {
      setVersionLabel('v1');
    }
  };

  const validateFile = (selected: File): string | null => {
    if (importSource === 'apkg') {
      const lower = selected.name.toLowerCase();
      const allowed = (ALLOWED_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext));
      if (!allowed) return strings.deckmarket.admin.invalidFile;
      if (selected.size > MAX_APKG_SIZE_BYTES) return strings.deckmarket.admin.fileTooLarge;
    } else {
      if (!selected.name.toLowerCase().endsWith('.csv')) return strings.deckmarket.admin.invalidCsv;
    }
    return null;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    setUploadMessage(null);
    try {
      const res = await fetch('/api/admin/deckmarket/decks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: slug || undefined,
          title,
          description,
          language,
          jlpt: jlpt || null,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create deck');

      const deckId = data.data.id as string;

      if (!file) {
        router.push(`/admin/deckmarket/${deckId}`);
        return;
      }

      const fileError = validateFile(file);
      if (fileError) throw new Error(fileError);

      if (importSource === 'csv') {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        if (versionLabel) formData.append('versionLabel', versionLabel);
        if (changelog) formData.append('changelog', changelog);

        const uploadRes = await fetch(`/api/admin/deckmarket/decks/${deckId}/import-csv`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || strings.deckmarket.admin.uploadFailed);

        setUploadMessage(strings.deckmarket.admin.versionUploaded);
        router.push(`/admin/deckmarket/${deckId}`);
        return;
      }

      setUploading(true);
      const metaRes = await fetch(`/api/admin/deckmarket/decks/${deckId}/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          versionLabel,
          changelog,
        }),
      });
      const metaData = await metaRes.json();
      if (!metaRes.ok) throw new Error(metaData.error || strings.deckmarket.admin.uploadFailed);

      const uploadUrl = metaData.uploadUrl as string;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(strings.deckmarket.admin.uploadFailed));
          }
        };
        xhr.onerror = () => reject(new Error(strings.deckmarket.admin.uploadFailed));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(file);
      });

      setUploadMessage(strings.deckmarket.admin.versionUploaded);
      router.push(`/admin/deckmarket/${deckId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deck');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{strings.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {strings.deckmarket.admin.createDeck}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{strings.deckmarket.subtitle}</p>
        </div>
        <Link
          href="/admin/deckmarket"
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          {strings.common.back}
        </Link>
      </div>

      {/* File Upload Section */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-primary-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {strings.deckmarket.admin.importSource}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { value: 'apkg', label: strings.deckmarket.admin.importApkg },
            { value: 'csv', label: strings.deckmarket.admin.importCsv },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setImportSource(option.value)}
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-medium border transition-all',
                importSource === option.value
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white border-primary-500 shadow-sm'
                  : 'bg-white dark:bg-dark-850 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            {importSource === 'csv'
              ? strings.deckmarket.admin.selectCsvFile
              : strings.deckmarket.admin.selectApkgFile}
          </label>
          <label className="block border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-xl p-6 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {file ? file.name : 'Drop file here or click to browse'}
            </p>
            {file && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(file.size / 1024)} KB
              </p>
            )}
            <input
              type="file"
              accept={importSource === 'csv' ? '.csv' : ALLOWED_EXTENSIONS.join(',')}
              onChange={(e) => {
                setUploadProgress(0);
                const nextFile = e.target.files?.[0] || null;
                setFile(nextFile);
                if (nextFile) {
                  applyPrefillFromFilename(nextFile.name);
                }
              }}
              className="hidden"
            />
          </label>
        </div>
        {uploading && importSource === 'apkg' && (
          <div className="space-y-2">
            <div className="w-full h-2.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {uploadProgress}%
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {strings.deckmarket.admin.versionLabel}
            </label>
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {strings.deckmarket.admin.changelog}
            </label>
            <input
              type="text"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Deck Metadata Section */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Deck Details
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {strings.common.name}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            placeholder={strings.deckmarket.admin.createDeck}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {strings.deckmarket.admin.slug}
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {strings.deckmarket.admin.slugHelp}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {strings.deckmarket.admin.description}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {strings.deckmarket.admin.tags}
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Select
              label={strings.deckmarket.admin.jlpt}
              value={jlpt}
              onChange={(value) => setJlpt(value)}
              placeholder={strings.deckmarket.filters.all}
              options={[
                { value: '', label: strings.deckmarket.filters.all },
                ...JLPT_LEVELS.map((level) => ({ value: level, label: level })),
              ]}
            />
          </div>

          <div>
            <Select
              label={strings.deckmarket.admin.language}
              value={language}
              onChange={(value) => setLanguage(value)}
              options={DECK_LANGUAGES.map((lang) => ({
                value: lang.code,
                label: lang.name,
              }))}
            />
          </div>
        </div>

        {(error || uploadMessage) && (
          <div
            className={cn(
              'rounded-lg p-4 text-sm',
              error
                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            )}
          >
            {error || uploadMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-dark-700">
          <Link
            href="/admin/deckmarket"
            className="px-4 py-2 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
          >
            {strings.common.cancel}
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all shadow-sm font-medium"
          >
            {uploading ? strings.common.processing : saving ? strings.common.saving : strings.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
