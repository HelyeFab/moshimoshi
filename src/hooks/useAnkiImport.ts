import { useState, useCallback, useEffect } from 'react';
import { AnkiImporter, AnkiDeck, ImportResult } from '@/lib/anki/importer';
import { ankiDeckManager, StoredAnkiDeck } from '@/lib/anki/AnkiDeckManager';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useI18n } from '@/i18n/I18nContext';

interface UseAnkiImportOptions {
  userId?: string;
  isPremium?: boolean;
  onSuccess?: (deck: AnkiDeck) => void;
  onError?: (error: string) => void;
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
      console.log('[useAnkiImport] Loading decks for user:', userId, 'isPremium:', isPremium);
      const decks = await ankiDeckManager.getDecks(userId, isPremium);

      // Debug: Log deck structure to help diagnose blank cards
      if (decks.length > 0) {
        const firstDeck = decks[0];
        console.log('[useAnkiImport] First deck loaded:', {
          id: firstDeck.id,
          name: firstDeck.name,
          cardCount: firstDeck.cardCount,
          actualCardsLength: firstDeck.cards?.length,
          hasCards: !!firstDeck.cards && firstDeck.cards.length > 0,
          firstCard: firstDeck.cards?.[0] ? {
            id: firstDeck.cards[0].id,
            hasFront: !!firstDeck.cards[0].front,
            hasBack: !!firstDeck.cards[0].back,
            front: firstDeck.cards[0].front?.substring?.(0, 30),
            back: firstDeck.cards[0].back?.substring?.(0, 30),
            keys: Object.keys(firstDeck.cards[0]).slice(0, 10),
          } : 'no cards',
        });
      } else {
        console.log('[useAnkiImport] No decks found');
      }

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
        // NOTE: Don't save here - let the page handle saving with proper error handling
        // The page's handleImportSuccess has LIMIT_REACHED error handling

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