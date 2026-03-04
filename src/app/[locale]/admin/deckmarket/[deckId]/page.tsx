'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import Modal from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Upload } from 'lucide-react';
import {
  JLPT_LEVELS,
  DECK_LANGUAGES,
  MAX_APKG_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} from '@/types/deckmarket';
import type { DeckMarketDeck, DeckMarketVersion } from '@/types/deckmarket';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function AdminDeckMarketEditPage() {
  const { strings } = useI18n();
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<DeckMarketVersion[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [jlpt, setJlpt] = useState<string>('');
  const [language, setLanguage] = useState('ja');
  const [hasNativeAudio, setHasNativeAudio] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [importSource, setImportSource] = useState<'apkg' | 'csv'>('apkg');
  const [versionLabel, setVersionLabel] = useState('');
  const [changelog, setChangelog] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, versionId: '' });
  const [deleteDeckOpen, setDeleteDeckOpen] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, adminLoading, router]);

  useEffect(() => {
    if (isAdmin && deckId) {
      loadDeck();
    }
  }, [isAdmin, deckId]);

  const loadDeck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/deckmarket/decks/${deckId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load deck');

      const deckData: DeckMarketDeck = data.data.deck;
      setVersions(data.data.versions || []);

      setTitle(deckData.title || '');
      setDescription(deckData.description || '');
      setTags((deckData.tags || []).join(', '));
      setJlpt(deckData.jlpt || '');
      setLanguage(deckData.language || 'ja');
      setHasNativeAudio(deckData.hasNativeAudio === true);
      setIsPublished(!!deckData.isPublished);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deck');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/deckmarket/decks/${deckId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          hasNativeAudio,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          jlpt: jlpt || null,
          language,
          isPublished,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update deck');

      setSaveMessage(strings.deckmarket.admin.deckUpdated);
      loadDeck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deck');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (selected: File | null) => {
    setUploadMessage(null);
    setUploadError(null);
    setUploadProgress(0);
    setFile(selected);
  };

  const validateFile = (selected: File): string | null => {
    if (importSource === 'csv') {
      if (!selected.name.toLowerCase().endsWith('.csv')) return strings.deckmarket.admin.invalidCsv;
      return null;
    }

    const lower = selected.name.toLowerCase();
    const allowed = (ALLOWED_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext));
    if (!allowed) return strings.deckmarket.admin.invalidFile;
    if (selected.size > MAX_APKG_SIZE_BYTES) return strings.deckmarket.admin.fileTooLarge;
    return null;
  };

  const handleUpload = async () => {
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadMessage(null);

    try {
      if (importSource === 'csv') {
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
        setFile(null);
        setVersionLabel('');
        setChangelog('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadDeck();
        return;
      }

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
      if (!metaRes.ok) throw new Error(metaData.error || 'Failed to get upload URL');

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
      setFile(null);
      setVersionLabel('');
      setChangelog('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadDeck();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : strings.deckmarket.admin.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      const res = await fetch(`/api/admin/deckmarket/decks/${deckId}/versions/${versionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete version');

      setDeleteConfirm({ isOpen: false, versionId: '' });
      loadDeck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete version');
    }
  };

  const handleDeleteDeck = async () => {
    setDeletingDeck(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/deckmarket/decks/${deckId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete deck');

      router.push('/admin/deckmarket');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deck');
    } finally {
      setDeletingDeck(false);
      setDeleteDeckOpen(false);
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
            {strings.deckmarket.admin.editDeck}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{deckId}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDeleteDeckOpen(true)}
            className="text-sm px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            {strings.common.delete}
          </button>
          <button
            onClick={() => router.push('/admin/deckmarket')}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {strings.common.back}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-600 dark:text-gray-400">{strings.common.loading}</div>
      ) : (
        <>
          {/* Section A: Metadata Editor */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full bg-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{strings.deckmarket.admin.editDeck}</h3>
            </div>

            {saveMessage && (
              <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-3 rounded-lg">
                {saveMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                {strings.common.name}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
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

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={hasNativeAudio}
                onChange={(e) => setHasNativeAudio(e.target.checked)}
                className="rounded accent-primary-500"
              />
              Includes native Japanese audio
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded accent-primary-500"
              />
              {isPublished ? strings.deckmarket.admin.published : strings.deckmarket.admin.draft}
            </label>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-dark-700">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all shadow-sm font-medium"
              >
                {saving ? strings.common.saving : strings.common.saveChanges}
              </button>
            </div>
          </div>

          {/* Section B: Upload New Version */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full bg-primary-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {strings.deckmarket.admin.uploadVersion}
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
                  onClick={() => {
                    setImportSource(option.value);
                    setUploadError(null);
                    setUploadMessage(null);
                    setUploadProgress(0);
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    importSource === option.value
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-dark-850 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {uploadError && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-xl">
                {uploadError}
              </div>
            )}

            {uploadMessage && (
              <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-3 rounded-xl">
                {uploadMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                {importSource === 'csv'
                  ? strings.deckmarket.admin.selectCsvFile
                  : strings.deckmarket.admin.selectFile}
              </label>
              <label className="block border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-xl p-6 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {file ? file.name : 'Drop file here or click to browse'}
                </p>
                {file && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatBytes(file.size)}
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importSource === 'csv' ? '.csv' : ALLOWED_EXTENSIONS.join(',')}
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

            <div>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all shadow-sm font-medium"
              >
                {uploading ? strings.common.processing : strings.deckmarket.admin.uploadVersion}
              </button>
            </div>
          </div>

          {/* Section C: Versions List */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {strings.deckmarket.deck.versions}
                </h3>
              </div>
            </div>
            {versions.length === 0 ? (
              <div className="p-6 text-gray-600 dark:text-gray-400">
                {strings.deckmarket.admin.noVersions}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-850">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300">{strings.deckmarket.deck.version}</th>
                      <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300">{strings.deckmarket.deck.size}</th>
                      <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300">{strings.deckmarket.deck.updated}</th>
                      <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300">{strings.deckmarket.deck.changelog}</th>
                      <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300">{strings.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version) => (
                      <tr
                        key={version.id}
                        className="border-t border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-750"
                      >
                        <td className="p-4 text-gray-900 dark:text-white">{version.versionLabel}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300">{formatBytes(version.sizeBytes)}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300">{version.createdAt ? new Date(version.createdAt).toLocaleDateString() : '-'}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300">{version.changelog || '-'}</td>
                        <td className="p-4">
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, versionId: version.id })}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            {strings.deckmarket.admin.deleteVersion}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, versionId: '' })}
        title={strings.deckmarket.admin.deleteVersion}
      >
        <p className="text-gray-700 dark:text-gray-300">{strings.deckmarket.admin.confirmDelete}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setDeleteConfirm({ isOpen: false, versionId: '' })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
          >
            {strings.common.cancel}
          </button>
          <button
            onClick={() => handleDeleteVersion(deleteConfirm.versionId)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            {strings.common.delete}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={deleteDeckOpen}
        onClose={() => setDeleteDeckOpen(false)}
        title={strings.common.delete}
      >
        <p className="text-gray-700 dark:text-gray-300">{strings.deckmarket.admin.confirmDelete}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setDeleteDeckOpen(false)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
          >
            {strings.common.cancel}
          </button>
          <button
            onClick={handleDeleteDeck}
            disabled={deletingDeck}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {deletingDeck ? strings.common.processing : strings.common.delete}
          </button>
        </div>
      </Modal>
    </div>
  );
}
