'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import { ALLOWED_MD_EXTENSIONS, MAX_MD_SIZE_BYTES } from '@/types/deckmarket';
import type { DeckMarketNote, DeckMarketNoteVersion } from '@/types/deckmarket';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

export default function AdminDeckMarketNoteEditPage() {
  const { strings } = useI18n();
  const router = useRouter();
  const params = useParams();
  const noteId = params.noteId as string;
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [note, setNote] = useState<DeckMarketNote | null>(null);
  const [versions, setVersions] = useState<DeckMarketNoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [changelog, setChangelog] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; versionId: string }>({
    open: false,
    versionId: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    language: 'ja',
    isPublished: false,
  });

  const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit,
    timeoutMs: number
  ) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, adminLoading, router]);

  useEffect(() => {
    if (!isAdmin || !noteId) return;
    loadNote();
  }, [isAdmin, noteId]);

  const loadNote = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deckmarket/notes/${noteId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load note');
      const noteData = data.data.note as DeckMarketNote;
      setNote(noteData);
      setVersions(data.data.versions || []);
      setFormData({
        title: noteData.title,
        description: noteData.description,
        tags: noteData.tags.join(', '),
        language: noteData.language,
        isPublished: noteData.isPublished,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/api/admin/deckmarket/notes/${noteId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          language: formData.language,
          tags: formData.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          isPublished: formData.isPublished,
        }),
      }, 15000);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || strings.deckmarket.admin.updateFailed);
      void loadNote();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(strings.errors.network.timeout);
      } else {
        setError(err instanceof Error ? err.message : strings.deckmarket.admin.updateFailed);
      }
    } finally {
      setSaving(false);
    }
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
      setUploadError(strings.deckmarket.admin.invalidMd);
      setFile(null);
      return;
    }

    if (selected.size > MAX_MD_SIZE_BYTES) {
      setUploadError(strings.deckmarket.admin.fileTooLargeMd);
      setFile(null);
      return;
    }

    setUploadError(null);
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError(strings.deckmarket.admin.selectMdFile);
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formDataPayload = new FormData();
      formDataPayload.append('file', file);
      if (versionLabel) formDataPayload.append('versionLabel', versionLabel);
      if (changelog) formDataPayload.append('changelog', changelog);

      const res = await fetch(`/api/admin/deckmarket/notes/${noteId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formDataPayload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || strings.deckmarket.admin.uploadFailed);
      setFile(null);
      setVersionLabel('');
      setChangelog('');
      await loadNote();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : strings.deckmarket.admin.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!deleteConfirm.versionId) return;
    try {
      const res = await fetch(
        `/api/admin/deckmarket/notes/${noteId}/versions/${deleteConfirm.versionId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || strings.deckmarket.admin.deleteFailed);
      setDeleteConfirm({ open: false, versionId: '' });
      await loadNote();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : strings.deckmarket.admin.deleteFailed);
    }
  };

  const handleTogglePublish = async () => {
    if (!note) return;
    try {
      const nextValue = !formData.isPublished;
      const res = await fetch(`/api/admin/deckmarket/notes/${noteId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: nextValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || strings.deckmarket.admin.updateFailed);
      setFormData((prev) => ({ ...prev, isPublished: nextValue }));
    } catch (err) {
      setError(err instanceof Error ? err.message : strings.deckmarket.admin.updateFailed);
    }
  };

  if (adminLoading || loading) {
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
            {strings.deckmarket.admin.editNote}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{note?.title}</p>
        </div>
        <button
          onClick={() => router.push('/admin/deckmarket/notes')}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500"
        >
          {strings.common.back}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-dark-700 p-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                formData.isPublished
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              )}
            >
              {formData.isPublished ? strings.deckmarket.admin.published : strings.deckmarket.admin.draft}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {formData.isPublished ? strings.deckmarket.admin.published : strings.deckmarket.admin.draft}
            </span>
          </div>
          <button
            onClick={handleTogglePublish}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              formData.isPublished
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            )}
          >
            {formData.isPublished ? strings.deckmarket.admin.unpublish : strings.deckmarket.admin.publish}
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {strings.deckmarket.admin.titleLabel}
          </label>
          <input
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {strings.deckmarket.admin.description}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {strings.deckmarket.admin.tags}
          </label>
          <input
            value={formData.tags}
            onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {strings.deckmarket.admin.language}
          </label>
          <input
            value={formData.language}
            onChange={(e) => setFormData((prev) => ({ ...prev, language: e.target.value }))}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => setFormData((prev) => ({ ...prev, isPublished: e.target.checked }))}
            className="h-4 w-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formData.isPublished ? strings.deckmarket.admin.published : strings.deckmarket.admin.draft}
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full px-4 py-2 rounded-xl text-white font-medium transition-colors',
            saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-500 hover:bg-primary-600'
          )}
        >
          {saving ? strings.common.processing : strings.deckmarket.admin.saveChanges}
        </button>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {strings.deckmarket.admin.uploadNote}
        </h3>
        {uploadError && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm">
            {uploadError}
          </div>
        )}
        <input
          type="file"
          accept=".md"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          className="text-sm text-gray-700 dark:text-gray-300"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {strings.deckmarket.admin.versionLabel}
            </label>
            <input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {strings.deckmarket.admin.changelog}
            </label>
            <input
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={cn(
            'px-4 py-2 rounded-xl text-white font-medium transition-colors',
            uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-500 hover:bg-primary-600'
          )}
        >
          {uploading ? strings.common.processing : strings.deckmarket.admin.uploadNote}
        </button>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {strings.deckmarket.deck.versions}
        </h3>
        {versions.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {strings.deckmarket.admin.noNoteVersions}
          </p>
        )}
        {versions.length > 0 && (
          <div className="space-y-3">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-4 border border-gray-200 dark:border-dark-700 rounded-lg p-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {version.versionLabel || strings.deckmarket.deck.version}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {version.pdfFilename} • {(version.pdfSizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirm({ open: true, versionId: version.id })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50"
                >
                  {strings.deckmarket.admin.deleteVersion}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, versionId: '' })}
        title={strings.deckmarket.admin.deleteVersion}
      >
        <p className="text-gray-700 dark:text-gray-300">{strings.deckmarket.admin.confirmDelete}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setDeleteConfirm({ open: false, versionId: '' })}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300"
          >
            {strings.common.cancel}
          </button>
          <button
            onClick={handleDeleteVersion}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            {strings.deckmarket.admin.deleteVersion}
          </button>
        </div>
      </Modal>
    </div>
  );
}
