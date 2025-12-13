import { useState, useCallback, useEffect } from 'react';
import { AnkiImporter, AnkiDeck, ImportResult } from '@/lib/anki/importer';
import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useI18n } from '@/i18n/I18nContext';

interface UseAnkiImportOptions {
  userId?: string;
  isPremium?: boolean;
  onSuccess?: (deck: AnkiDeck) => void;
  onError?: (error: string) => void;
}

interface StoredAnkiDeck extends AnkiDeck {
  userId: string;
  createdAt: number;
  updatedAt: number;
  cardCount: number;
  metadata?: {
    originalFilename?: string;
    importedAt: string;
    hasMedia: boolean;
  };
}

export function useAnkiImport(options?: UseAnkiImportOptions) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [savedDecks, setSavedDecks] = useState<StoredAnkiDeck[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const { showToast } = useToast();
  const { t } = useI18n();

  const userId = options?.userId || 'guest';
  const isPremium = options?.isPremium || false;

  // Load saved decks on mount and when userId/isPremium changes
  const loadDecks = useCallback(async () => {
    if (userId === 'guest') {
      setSavedDecks([]);
      return;
    }

    setIsLoadingDecks(true);
    try {
      const decks = await ankiDeckManager.getDecks(userId, isPremium);
      setSavedDecks(decks);
    } catch (error) {
      console.error('[useAnkiImport] Failed to load decks:', error);
    } finally {
      setIsLoadingDecks(false);
    }
  }, [userId, isPremium]);

  // Subscribe to deck changes
  useEffect(() => {
    loadDecks();

    const unsubscribe = ankiDeckManager.subscribe('decks-changed', loadDecks);
    return () => unsubscribe();
  }, [loadDecks]);

  const importDeck = useCallback(async (file: File): Promise<ImportResult> => {
    setIsImporting(true);
    setProgress(0);
    setProgressMessage('');

    try {
      const result = await AnkiImporter.importDeck(file, {
        onProgress: (prog, message) => {
          setProgress(prog);
          setProgressMessage(message);
        }
      });

      if (result.success && result.deck) {
        // Save the deck to persistent storage
        if (userId !== 'guest') {
          setProgressMessage('Saving deck...');
          const savedDeck = await ankiDeckManager.saveDeck(
            result.deck,
            userId,
            isPremium,
            file.name
          );
          console.log('[useAnkiImport] Deck saved:', savedDeck.id);
        }

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
  }, [t, showToast, options, userId, isPremium]);

  const deleteDeck = useCallback(async (deckId: string): Promise<boolean> => {
    if (userId === 'guest') {
      showToast(t('anki.loginRequired'), 'error');
      return false;
    }

    try {
      const success = await ankiDeckManager.deleteDeck(deckId, userId, isPremium);
      if (success) {
        showToast(t('anki.deckDeleted'), 'success');
      }
      return success;
    } catch (error) {
      console.error('[useAnkiImport] Failed to delete deck:', error);
      showToast(t('anki.deleteFailed'), 'error');
      return false;
    }
  }, [userId, isPremium, showToast, t]);

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
    showToast(t('anki.mediaCacheCleared'), 'success');
  }, [showToast, t]);

  const refreshDecks = useCallback(() => {
    loadDecks();
  }, [loadDecks]);

  return {
    // Import operations
    importDeck,
    validateFile,
    isImporting,
    progress,
    progressMessage,
    // Deck management
    savedDecks,
    isLoadingDecks,
    deleteDeck,
    refreshDecks,
    // Media management
    getMediaStats,
    clearMedia,
  };
}