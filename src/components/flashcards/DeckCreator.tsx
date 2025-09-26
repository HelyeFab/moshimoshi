'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Upload, FileText, Package, Sparkles, ChevronRight, Save, Trash2, List } from 'lucide-react';
import type { CreateDeckRequest, FlashcardContent, CardSide, CardStyle } from '@/types/flashcards';
import type { UserList } from '@/types/userLists';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { DECK_COLORS, SUGGESTED_DECK_EMOJIS } from '@/types/flashcards';
import { AnkiImportModal } from '@/components/anki/AnkiImportModal';
import { VirtualCardList } from './VirtualCardList';
import { ImageUpload } from './ImageUpload';
import { listManager } from '@/lib/lists/ListManager';
import { useRouter } from 'next/navigation';

interface DeckCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deck: CreateDeckRequest) => void;
  userLists?: UserList[];
  userId: string;
  isPremium: boolean;
  editDeck?: any; // FlashcardDeck type when editing
}

type ImportSource = 'scratch' | 'anki' | 'list' | 'csv';

export function DeckCreator({
  isOpen,
  onClose,
  onSave,
  userLists = [],
  userId,
  isPremium,
  editDeck
}: DeckCreatorProps) {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'source' | 'details' | 'cards'>('source');
  const [importSource, setImportSource] = useState<ImportSource>('scratch');
  const [showAnkiImport, setShowAnkiImport] = useState(false);

  // Deck details - initialize with editDeck values if editing
  const [deckName, setDeckName] = useState(editDeck?.name || '');
  const [description, setDescription] = useState(editDeck?.description || '');
  const [selectedEmoji, setSelectedEmoji] = useState(editDeck?.emoji || '🎴');
  const [selectedColor, setSelectedColor] = useState<string>(editDeck?.color || 'primary');
  const [cardStyle, setCardStyle] = useState<CardStyle>(editDeck?.cardStyle || 'minimal');
  const [sessionLength, setSessionLength] = useState<number>(editDeck?.settings?.sessionLength || 20);

  // Cards - initialize with editDeck cards if editing
  const [cards, setCards] = useState<Array<{ front: string; back: string; notes?: string }>>(editDeck?.cards?.map((card: any) => ({
    front: card.front.text,
    back: card.back.text,
    notes: card.metadata?.notes || ''
  })) || []);
  const [currentCard, setCurrentCard] = useState<{
    front: string;
    back: string;
    notes: string;
    frontImage?: { type: 'image'; url: string; alt?: string };
    backImage?: { type: 'image'; url: string; alt?: string };
  }>({ front: '', back: '', notes: '' });
  const [selectedListId, setSelectedListId] = useState<string>('');

  // If editing, skip source selection and go straight to details
  React.useEffect(() => {
    if (editDeck && isOpen) {
      setStep('details');
    }
  }, [editDeck, isOpen]);

  const handleImportSource = (source: ImportSource) => {
    // Redirect free users to pricing for premium features
    if ((source === 'anki' || source === 'csv') && !isPremium) {
      router.push('/pricing');
      return;
    }

    setImportSource(source);
    if (source === 'anki') {
      setShowAnkiImport(true);
    } else if (source === 'scratch') {
      setStep('details');
    } else if (source === 'list') {
      setStep('details');
    } else if (source === 'csv') {
      fileInputRef.current?.click();
    }
  };

  const handleAnkiImportSuccess = (result: any) => {
    if (result.deck) {
      setDeckName(result.deck.name);
      setDescription(result.deck.description || '');
      // Convert Anki cards to our format
      const importedCards = result.deck.cards.map((card: any) => ({
        front: card.front,
        back: card.back,
        notes: card.tags?.join(', ') || ''
      }));
      setCards(importedCards);
      setShowAnkiImport(false);
      setStep('details');
    }
  };

  const handleListImport = async () => {
    if (!selectedListId) return;

    const lists = await listManager.getLists(userId, isPremium);
    const list = lists.find(l => l.id === selectedListId);

    if (list) {
      setDeckName(list.name);
      // Convert list items to cards
      const importedCards = list.items.map(item => ({
        front: item.content,
        back: item.metadata?.meaning || item.metadata?.reading || '',
        notes: item.metadata?.notes || ''
      }));
      setCards(importedCards);
      setStep('cards');
    }
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const importedCards: typeof cards = [];

      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes('front') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const [front, back, notes] = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (front && back) {
          importedCards.push({ front, back, notes: notes || '' });
        }
      }

      setCards(importedCards);
      setDeckName(file.name.replace('.csv', ''));
      setStep('details');
    };
    reader.readAsText(file);
  };

  const addCard = () => {
    if (currentCard.front && currentCard.back) {
      const newCard: FlashcardContent = {
        id: `card-${Date.now()}-${Math.random()}`,
        front: {
          text: currentCard.front,
          media: currentCard.frontImage
        },
        back: {
          text: currentCard.back,
          media: currentCard.backImage
        },
        metadata: { status: 'new', createdAt: Date.now() }
      };
      if (currentCard.notes) {
        (newCard as any).notes = currentCard.notes;
      }
      setCards([...cards, newCard]);
      setCurrentCard({ front: '', back: '', notes: '' });
    }
  };

  const removeCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!deckName || (importSource === 'scratch' && cards.length === 0)) return;

    const deckRequest: CreateDeckRequest = {
      name: deckName,
      description,
      emoji: selectedEmoji,
      color: selectedColor,
      cardStyle,
      settings: {
        studyDirection: 'front-to-back',
        autoPlay: false,
        showHints: true,
        animationSpeed: 'normal',
        soundEffects: true,
        hapticFeedback: true,
        sessionLength: sessionLength,
        reviewMode: 'srs'
      },
      sourceListId: importSource === 'list' ? selectedListId : undefined,
      initialCards: cards.map(card => ({
        front: { text: card.front } as CardSide,
        back: { text: card.back } as CardSide,
        metadata: card.notes ? { notes: card.notes } : undefined
      }))
    };

    onSave(deckRequest);
    resetForm();
  };

  const resetForm = () => {
    setStep('source');
    setImportSource('scratch');
    setDeckName('');
    setDescription('');
    setSelectedEmoji('🎴');
    setSelectedColor('primary');
    setCardStyle('minimal');
    setSessionLength(20);
    setCards([]);
    setCurrentCard({ front: '', back: '', notes: '' });
    setSelectedListId('');
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full sm:max-w-3xl h-[85vh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-dark-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-primary-500" />
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {editDeck ? t('flashcards.editDeck') : t('flashcards.createDeck')}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="px-4 sm:px-6 py-3 bg-gray-50 dark:bg-dark-850 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto">
                  <div className={cn(
                    'flex items-center justify-center min-w-[40px] w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
                    step === 'source' ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
                  )}>
                    <span className="sm:hidden">1</span>
                    <span className="hidden sm:inline">1. {t('flashcards.import.selectFile')}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                  <div className={cn(
                    'flex items-center justify-center min-w-[40px] w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
                    step === 'details' ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
                  )}>
                    <span className="sm:hidden">2</span>
                    <span className="hidden sm:inline">2. {t('flashcards.deckSettings')}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                  <div className={cn(
                    'flex items-center justify-center min-w-[40px] w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
                    step === 'cards' ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
                  )}>
                    <span className="sm:hidden">3</span>
                    <span className="hidden sm:inline">3. {t('flashcards.addCard')}</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                {step === 'source' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <button
                      onClick={() => handleImportSource('scratch')}
                      className="p-4 sm:p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 transition-all group flex flex-col items-center text-center"
                    >
                      <Plus className="w-6 sm:w-8 h-6 sm:h-8 text-primary-500 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">{t('common.create')}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.empty.createFirst')}
                      </p>
                    </button>

                    <button
                      onClick={() => handleImportSource('anki')}
                      className={cn(
                        "p-4 sm:p-6 rounded-xl border-2 transition-all group flex flex-col items-center text-center relative",
                        !isPremium
                          ? "border-gray-200 dark:border-gray-700 opacity-75 hover:border-orange-400 dark:hover:border-orange-600"
                          : "border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600"
                      )}
                    >
                      <Package className={cn(
                        "w-6 sm:w-8 h-6 sm:h-8 mb-2 sm:mb-3 group-hover:scale-110 transition-transform",
                        isPremium ? "text-blue-500" : "text-gray-400 dark:text-gray-600"
                      )} />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">{t('flashcards.import.ankiTitle')}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.import.supportedFormats')}
                      </p>
                      {!isPremium && (
                        <span className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          {t('common.premiumOnly')}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => handleImportSource('list')}
                      className="p-4 sm:p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 transition-all group flex flex-col items-center text-center"
                    >
                      <List className="w-6 sm:w-8 h-6 sm:h-8 text-green-500 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">{t('flashcards.import.fromList')}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {userLists.length > 0 ? `${userLists.length} ${t('lists.title')}` : t('flashcards.import.yourLists')}
                      </p>
                    </button>

                    <button
                      onClick={() => handleImportSource('csv')}
                      className={cn(
                        "p-4 sm:p-6 rounded-xl border-2 transition-all group flex flex-col items-center text-center relative",
                        !isPremium
                          ? "border-gray-200 dark:border-gray-700 opacity-75 hover:border-orange-400 dark:hover:border-orange-600"
                          : "border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600"
                      )}
                    >
                      <Upload className={cn(
                        "w-6 sm:w-8 h-6 sm:h-8 mb-2 sm:mb-3 group-hover:scale-110 transition-transform",
                        isPremium ? "text-purple-500" : "text-gray-400 dark:text-gray-600"
                      )} />
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">{t('flashcards.import.csvTitle')}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t('flashcards.import.csv')}
                      </p>
                      {!isPremium && (
                        <span className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          {t('common.premiumOnly')}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {step === 'details' && (
                  <div className="space-y-6">
                    {/* Deck Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.deckName')}
                      </label>
                      <input
                        type="text"
                        value={deckName}
                        onChange={(e) => setDeckName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={t('flashcards.deckName')}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.deckDescription')}
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows={3}
                        placeholder={t('flashcards.deckDescription')}
                      />
                    </div>

                    {/* Emoji Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('lists.emoji')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_DECK_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => setSelectedEmoji(emoji)}
                            className={cn(
                              'w-12 h-12 rounded-lg text-2xl transition-all',
                              selectedEmoji === emoji
                                ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                                : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('lists.color')}
                      </label>
                      <div className="flex gap-2">
                        {DECK_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={cn(
                              'w-12 h-12 rounded-lg transition-all',
                              selectedColor === color && 'ring-2 ring-offset-2 ring-primary-500',
                              color === 'primary' && 'bg-gradient-to-br from-pink-400 to-pink-600',
                              color === 'ocean' && 'bg-gradient-to-br from-blue-400 to-blue-600',
                              color === 'matcha' && 'bg-gradient-to-br from-green-400 to-green-600',
                              color === 'sunset' && 'bg-gradient-to-br from-orange-400 to-red-600',
                              color === 'lavender' && 'bg-gradient-to-br from-purple-400 to-purple-600',
                              color === 'monochrome' && 'bg-gradient-to-br from-gray-400 to-gray-600'
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Card Style */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.customize.cardStyle')}
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['minimal', 'decorated', 'themed'] as CardStyle[]).map(style => (
                          <button
                            key={style}
                            onClick={() => setCardStyle(style)}
                            className={cn(
                              'px-4 py-2 rounded-lg font-medium transition-all',
                              cardStyle === style
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                            )}
                          >
                            {t(`flashcards.customize.${style}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Session Length */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flashcards.settings.sessionLength')}
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="5"
                          max="100"
                          value={sessionLength}
                          onChange={(e) => setSessionLength(Number(e.target.value))}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="5"
                            max="100"
                            value={sessionLength}
                            onChange={(e) => {
                              const value = Math.max(5, Math.min(100, Number(e.target.value)));
                              setSessionLength(value);
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('flashcards.cards')}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('flashcards.settings.sessionLengthHint')}
                      </p>
                    </div>

                    {/* List Selection (if importing from list) */}
                    {importSource === 'list' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('flashcards.import.selectList')}
                        </label>
                        <select
                          value={selectedListId}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="">{t('flashcards.import.selectList')}</option>
                          {userLists.length > 0 ? (
                            userLists.map(list => (
                              <option key={list.id} value={list.id}>
                                {list.emoji} {list.name} ({list.items.length} items)
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>
                              {t('flashcards.import.noLists')}
                            </option>
                          )}
                        </select>
                        {userLists.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {t('flashcards.import.createListFirst')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {step === 'cards' && (
                  <div className="space-y-6">
                    {/* Add New Card Form */}
                    <div className="p-4 bg-gray-50 dark:bg-dark-850 rounded-lg">
                      <h3 className="font-semibold mb-4">{t('flashcards.addCard')}</h3>
                      <div className="space-y-4">
                        {/* Front Side */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('flashcards.frontSide')}
                          </label>
                          <input
                            type="text"
                            value={currentCard.front}
                            onChange={(e) => setCurrentCard({ ...currentCard, front: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700"
                            placeholder={t('flashcards.frontSide')}
                          />
                          <ImageUpload
                            currentImage={currentCard.frontImage ? { url: currentCard.frontImage.url, alt: currentCard.frontImage.alt } : undefined}
                            onImageAdded={(imageData) => setCurrentCard({ ...currentCard, frontImage: imageData })}
                            onImageRemoved={() => {
                              const { frontImage, ...rest } = currentCard;
                              setCurrentCard(rest);
                            }}
                            maxSizeMB={1}
                          />
                        </div>

                        {/* Back Side */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('flashcards.backSide')}
                          </label>
                          <input
                            type="text"
                            value={currentCard.back}
                            onChange={(e) => setCurrentCard({ ...currentCard, back: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700"
                            placeholder={t('flashcards.backSide')}
                          />
                          <ImageUpload
                            currentImage={currentCard.backImage ? { url: currentCard.backImage.url, alt: currentCard.backImage.alt } : undefined}
                            onImageAdded={(imageData) => setCurrentCard({ ...currentCard, backImage: imageData })}
                            onImageRemoved={() => {
                              const { backImage, ...rest } = currentCard;
                              setCurrentCard(rest);
                            }}
                            maxSizeMB={1}
                          />
                        </div>

                        {/* Notes */}
                        <input
                          type="text"
                          value={currentCard.notes}
                          onChange={(e) => setCurrentCard({ ...currentCard, notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700"
                          placeholder={t('flashcards.cardNotes')}
                        />
                        <button
                          onClick={addCard}
                          disabled={!currentCard.front || !currentCard.back}
                          className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-4 h-4 inline mr-2" />
                          {t('flashcards.addCard')}
                        </button>
                      </div>
                    </div>

                    {/* Card List with Virtual Scrolling */}
                    {cards.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        {t('flashcards.empty.noCards')}
                      </p>
                    ) : (
                      <VirtualCardList
                        cards={cards}
                        onRemove={removeCard}
                        containerHeight={256} // Equivalent to max-h-64
                        itemHeight={80}
                        showStats={false}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg"
                      />
                    )}

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('flashcards.totalCards', { count: cards.length })}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <button
                  onClick={() => {
                    if (step === 'details') setStep('source');
                    else if (step === 'cards') setStep('details');
                  }}
                  className={cn(
                    "px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors",
                    step === 'source' && 'invisible'
                  )}
                >
                  {t('common.back')}
                </button>

                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={onClose}
                    className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>

                  {step === 'details' && (
                    <button
                      onClick={() => {
                        if (importSource === 'list' && selectedListId) {
                          handleListImport();
                        } else {
                          setStep('cards');
                        }
                      }}
                      disabled={!deckName}
                      className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 sm:gap-2"
                    >
                      {t('common.next')}
                      <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4" />
                    </button>
                  )}

                  {step === 'cards' && (
                    <button
                      onClick={handleSave}
                      disabled={!deckName || (importSource === 'scratch' && cards.length === 0)}
                      className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 sm:gap-2"
                    >
                      <Save className="w-3 sm:w-4 h-3 sm:h-4" />
                      {t('common.save')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden file input for CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVUpload}
        className="hidden"
      />

      {/* Anki Import Modal */}
      <AnkiImportModal
        isOpen={showAnkiImport}
        onClose={() => setShowAnkiImport(false)}
        onImportSuccess={handleAnkiImportSuccess}
      />
    </>
  );
}