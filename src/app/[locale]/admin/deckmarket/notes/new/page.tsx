'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import { ALLOWED_MD_EXTENSIONS, MAX_MD_SIZE_BYTES } from '@/types/deckmarket';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Upload } from 'lucide-react';

const INVALID_SLUG = /[^a-z0-9-]/g;

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminDeckMarketNoteCreatePage() {
  const { strings } = useI18n();
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [language, setLanguage] = useState('ja');
  const [file, setFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [changelog, setChangelog] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

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

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(value.toLowerCase().replace(INVALID_SLUG, ''));
  };

  const handleFileChange = (selected: File | null) => {
    if (!selected) {
      setFile(null);
      return;
    }

    const extensionAllowed = (ALLOWED_MD_EXTENSIONS as readonly string[]).some((ext) =>
      selected.name.toLowerCase().endsWith(ext)
    );

    if (!extensionAllowed) {
      setError(strings.deckmarket.admin.invalidMd);
      setFile(null);
      return;
    }

    if (selected.size > MAX_MD_SIZE_BYTES) {
      setError(strings.deckmarket.admin.fileTooLargeMd);
      setFile(null);
      return;
    }

    setError(null);
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(strings.deckmarket.admin.titleRequired);
      return;
    }

    setSaving(true);
    setError(null);
    setUploadMessage(null);

    try {
      const res = await fetch('/api/admin/deckmarket/notes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: slug || undefined,
          title: title.trim(),
          description: description.trim(),
          language,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || strings.deckmarket.admin.createFailed);

      const noteId = data.data.id as string;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        if (versionLabel) formData.append('versionLabel', versionLabel);
        if (changelog) formData.append('changelog', changelog);

        const uploadRes = await fetch(`/api/admin/deckmarket/notes/${noteId}/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || strings.deckmarket.admin.uploadFailed);
        setUploadMessage(strings.deckmarket.admin.noteUploaded);
      }

      router.push(`/admin/deckmarket/notes/${noteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : strings.deckmarket.admin.createFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {strings.deckmarket.admin.createNote}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {strings.deckmarket.notes.subtitle}
          </p>
        </div>
        <Link
          href="/admin/deckmarket/notes"
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
            {strings.deckmarket.admin.uploadNote}
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            {strings.deckmarket.admin.mdHint}
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
              accept=".md"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>

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

      {/* Note Details Section */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Note Details
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {strings.deckmarket.admin.titleLabel}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            placeholder={strings.deckmarket.admin.createNote}
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

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            {strings.deckmarket.admin.language}
          </label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
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
            href="/admin/deckmarket/notes"
            className="px-4 py-2 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
          >
            {strings.common.cancel}
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all shadow-sm font-medium"
          >
            {saving ? strings.common.processing : strings.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
