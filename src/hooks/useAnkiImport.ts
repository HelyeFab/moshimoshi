import { useState, useCallback } from 'react';
import { AnkiImporter, AnkiDeck, ImportResult } from '@/lib/anki/importer';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useI18n } from '@/i18n/I18nContext';

interface UseAnkiImportOptions {
  onSuccess?: (deck: AnkiDeck) => void;
  onError?: (error: string) => void;
}

export function useAnkiImport(options?: UseAnkiImportOptions) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const { showToast } = useToast();
  const { t } = useI18n();

  const importDeck = useCallback(async (file: File): Promise<ImportResult> => {
    setIsImporting(true);
    setProgress(0);
    setProgressMessage('');

    try {
      const result = await AnkiImporter.importDeck(file, {
        onProgress: (progress, message) => {
          setProgress(progress);
          setProgressMessage(message);
        }
      });

      if (result.success && result.deck) {
        showToast(
          t('anki.cardsImported', { count: result.cardsImported || 0 }),
          'success'
        );
        options?.onSuccess?.(result.deck);
      } else {
        const error = result.error || t('anki.importFailed');
        showToast(error, 'error');
        options?.onError?.(error);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('anki.importFailed');
      showToast(errorMessage, 'error');
      options?.onError?.(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsImporting(false);
      setProgress(0);
      setProgressMessage('');
    }
  }, [t, showToast, options]);

  const validateFile = useCallback((file: File): boolean => {
    const validation = AnkiImporter.validateFile(file);
    if (!validation.valid) {
      showToast(validation.error || t('anki.invalidFile'), 'error');
      return false;
    }
    return true;
  }, [t, showToast]);

  const getMediaStats = useCallback(async () => {
    return await AnkiImporter.getMediaStats();
  }, []);

  const clearMedia = useCallback(async () => {
    await AnkiImporter.clearAllMedia();
    showToast('Media cache cleared', 'success');
  }, [showToast]);

  return {
    importDeck,
    validateFile,
    getMediaStats,
    clearMedia,
    isImporting,
    progress,
    progressMessage
  };
}