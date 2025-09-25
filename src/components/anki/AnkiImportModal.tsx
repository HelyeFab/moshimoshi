'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import Alert from '@/components/ui/Alert';
import { Upload, FileText, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { AnkiImporter, ImportResult } from '@/lib/anki/importer';
import { useI18n } from '@/i18n/I18nContext';

interface AnkiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (result: ImportResult) => void;
}

export function AnkiImportModal({ isOpen, onClose, onImportSuccess }: AnkiImportModalProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const validation = AnkiImporter.validateFile(selectedFile);
      if (!validation.valid) {
        setError(validation.error || t('anki.invalidFile'));
        return;
      }

      setFile(selectedFile);
      setError('');
      setImportResult(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      const validation = AnkiImporter.validateFile(droppedFile);
      if (!validation.valid) {
        setError(validation.error || t('anki.invalidFile'));
        return;
      }

      setFile(droppedFile);
      setError('');
      setImportResult(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setError('');

    try {
      const result = await AnkiImporter.importDeck(file, {
        onProgress: (progress, message) => {
          setProgress(progress);
          setProgressMessage(message);
        }
      });

      if (result.success) {
        setImportResult(result);
        if (onImportSuccess) {
          onImportSuccess(result);
        }
      } else {
        setError(result.error || t('anki.importFailed'));
      }
    } catch (error) {
      console.error('Import error:', error);
      setError(error instanceof Error ? error.message : t('anki.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setError('');
    setImportResult(null);
    setProgress(0);
    setProgressMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('anki.importTitle')}
      size="lg"
    >
      <div className="p-6">
        {/* Success State */}
        {importResult?.success && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-text-primary dark:text-dark-text-primary">
              {t('anki.importSuccess')}
            </h3>
            <p className="text-text-secondary dark:text-dark-text-secondary mb-4">
              {t('anki.cardsImported', { count: importResult.cardsImported || 0 })}
            </p>
            {importResult.deck && (
              <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-text-primary dark:text-dark-text-primary">
                  {importResult.deck.name}
                </h4>
                <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                  {importResult.deck.description}
                </p>
              </div>
            )}
            <button
              onClick={handleClose}
              className="btn btn-primary"
            >
              {t('common.close')}
            </button>
          </div>
        )}

        {/* Import Form */}
        {!importResult?.success && (
          <>
            {/* File Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center
                transition-colors cursor-pointer
                ${dragActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-dark-600 hover:border-primary-400'}
                ${file ? 'bg-green-50 dark:bg-green-900/20' : ''}
              `}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".apkg"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="space-y-4">
                  <FileText className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto" />
                  <div className="text-center px-4">
                    <p className="font-semibold text-text-primary dark:text-dark-text-primary break-words">
                      {file.name}
                    </p>
                    <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetModal();
                    }}
                    className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm"
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
                      {t('anki.dropFile')}
                    </p>
                    <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                      {t('anki.orBrowse')}
                    </p>
                  </div>
                  <p className="text-xs text-text-muted dark:text-dark-text-muted">
                    {t('anki.maxFileSize')}
                  </p>
                </div>
              )}
            </div>

            {/* Error Alert */}
            {error && (
              <Alert type="error" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </Alert>
            )}

            {/* Progress Bar */}
            {importing && (
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary dark:text-dark-text-secondary">
                    {progressMessage || t('anki.processing')}
                  </span>
                  <span className="text-text-primary dark:text-dark-text-primary">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleClose}
                disabled={importing}
                className="btn btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? t('anki.importing') : t('anki.import')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Loading Overlay */}
      {importing && (
        <LoadingOverlay message={progressMessage} />
      )}
    </Modal>
  );
}