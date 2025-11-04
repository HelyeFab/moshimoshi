'use client';

import { useState, useEffect, useRef } from 'react';
import { TranscriptLine } from '@/types/youtubeShadowing';
import { GrammarHighlightedText, GrammarLegend } from '@/components/reading/GrammarHighlightedText';
import { generateFuriganaWithCache } from '@/utils/furigana';
import { GraduationCap, PencilRuler } from 'lucide-react';
// TODO: Import search words and word types from proper location
// import { searchWords } from '@/utils/api';
// import { JapaneseWord } from '@/types';
interface JapaneseWord {
  id: string;
  japanese: string;
  reading?: string;
  meaning: string[];
  jlpt?: number;
  common?: boolean;
}
// TODO: Import or create WordLookupModal
// import WordLookupModal from '@/components/vocabulary/WordLookupModal';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { useSubscription } from '@/hooks/useSubscription';
import { UserEditedTranscriptsManager } from '@/utils/userEditedTranscripts';
import { motion, AnimatePresence } from 'framer-motion';
// TODO: Import or create RegenerateTranscript component
// import RegenerateTranscript from './RegenerateTranscript';
import { TranscriptCacheManager } from '@/utils/transcriptCache';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { useWordExplanation } from '@/hooks/useWordExplanation';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface EditableTranscriptReaderProps {
  transcript: TranscriptLine[];
  currentLineIndex: number;
  onLineClick: (index: number) => void;
  onSeekToTime?: (time: number) => void;  // Direct seek callback (like moshi-player)
  showFurigana: boolean;
  showTranslations: boolean;
  showGrammar: boolean;
  onWordClick?: (word: string) => void;
  contentId: string;
  contentType: 'youtube' | 'audio' | 'video';
  videoUrl?: string;
  videoTitle?: string;
  onTranscriptRegenerated?: (transcript: TranscriptLine[]) => void;
}

export default function EditableTranscriptReader({
  transcript,
  currentLineIndex,
  onLineClick,
  onSeekToTime,
  showFurigana,
  showTranslations,
  showGrammar,
  onWordClick,
  contentId,
  contentType,
  videoUrl,
  videoTitle,
  onTranscriptRegenerated
}: EditableTranscriptReaderProps) {
  const { user } = useAuth();
  const { t, strings } = useI18n();
  const { isPremium } = useSubscription();
  const { showToast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState<TranscriptLine[]>([]);
  const [processedTranscript, setProcessedTranscript] = useState<Array<{
    original: TranscriptLine;
    withFurigana: string;
  }>>([]);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showEditTools, setShowEditTools] = useState(false);
  const editRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Auto-scroll refs (like moshi-player)
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Word explanation state
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);

  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    currentWord,
    reset: resetWordExplanation
  } = useWordExplanation({
    onError: (error) => {
      showToast(error, 'error');
    }
  });

  // Load user's edited transcript if available
  useEffect(() => {
    const loadEditedTranscript = async () => {
      if (!user || !isPremium || !contentId) return;

      try {
        const userEdited = await UserEditedTranscriptsManager.getUserEditedTranscript(
          user.uid,
          contentId
        );
        
        if (userEdited) {
          setEditedTranscript(userEdited.transcript);
          setHasEdits(true);
        } else {
          setEditedTranscript(transcript);
        }
      } catch (error) {
        console.error('Failed to load edited transcript:', error);
        setEditedTranscript(transcript);
      }
    };

    loadEditedTranscript();
  }, [user, isPremium, contentId, transcript]);

  // Helper function to clean romaji from text
  const cleanRomaji = (text: string): string => {
    // Remove common romaji patterns (lowercase Latin letters between Japanese text)
    // This regex removes sequences of Latin letters that appear after Japanese characters
    return text.replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+\s*[a-z\s]+/gi, (match) => {
      // Extract just the Japanese part
      const japaneseOnly = match.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
      return japaneseOnly ? japaneseOnly.join('') : match;
    });
  };

  // Process transcript with furigana
  useEffect(() => {
    const processTranscript = async () => {
      const transcriptToProcess = editedTranscript.length > 0 ? editedTranscript : transcript;
      
      // Clean romaji from all transcript lines
      const cleanedTranscript = transcriptToProcess.map(line => ({
        ...line,
        text: cleanRomaji(line.text)
      }));
      
      if (!showFurigana || cleanedTranscript.length === 0) {
        setProcessedTranscript(cleanedTranscript.map(line => ({ original: line, withFurigana: line.text })));
        return;
      }

      const processed = await Promise.all(
        cleanedTranscript.map(async (line) => {
          try {
            const withFurigana = await generateFuriganaWithCache(line.text);
            return { original: line, withFurigana };
          } catch (error) {
            console.error('Failed to generate furigana:', error);
            return { original: line, withFurigana: line.text };
          }
        })
      );

      setProcessedTranscript(processed);
    };

    processTranscript();
  }, [transcript, editedTranscript, showFurigana]);

  // Auto-scroll to current segment (like moshi-player)
  useEffect(() => {
    if (editMode || currentLineIndex < 0 || currentLineIndex >= processedTranscript.length) return;

    const currentSegment = processedTranscript[currentLineIndex];
    if (!currentSegment) return;

    const segmentKey = `${currentSegment.original.id}`;
    const segmentElement = segmentRefs.current[segmentKey];

    if (segmentElement && transcriptContainerRef.current) {
      const container = transcriptContainerRef.current;
      const elementTop = segmentElement.offsetTop;
      const elementHeight = segmentElement.offsetHeight;
      const containerHeight = container.offsetHeight;
      const containerScrollTop = container.scrollTop;

      // Check if element is not fully visible (100px buffer zones - moshi-player pattern)
      const isElementAboveViewport = elementTop < containerScrollTop + 100;
      const isElementBelowViewport = elementTop + elementHeight > containerScrollTop + containerHeight - 100;

      if (isElementAboveViewport || isElementBelowViewport) {
        // Smooth scroll to CENTER the active segment
        const scrollPosition = elementTop - containerHeight / 2 + elementHeight / 2;
        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [currentLineIndex, processedTranscript, editMode]);

  const handleWordClick = async (word: string) => {
    if (editMode) return; // Disable word lookup in edit mode

    const cleanWord = word.replace(/<[^>]*>/g, '');
    if (!cleanWord || cleanWord.length === 0) return;

    setIsWordModalOpen(true);
    await explainWord(cleanWord);

    if (onWordClick) {
      onWordClick(cleanWord);
    }
  };

  const handleCloseWordModal = () => {
    setIsWordModalOpen(false);
    resetWordExplanation();
  };

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditToggle = () => {
    if (editMode && hasChanges()) {
      setShowSaveConfirm(true);
    } else {
      setEditMode(!editMode);
    }
  };

  const hasChanges = () => {
    return JSON.stringify(editedTranscript) !== JSON.stringify(transcript);
  };

  const handleTextEdit = (index: number, newText: string) => {
    const updated = [...editedTranscript];
    updated[index] = { ...updated[index], text: newText };
    setEditedTranscript(updated);
  };

  const handleSplitLine = (index: number) => {
    const line = editedTranscript[index];
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const container = editRefs.current[line.id];
    
    if (!container || !container.contains(range.commonAncestorContainer)) return;
    
    // Get the text before and after the cursor
    const fullText = line.text;
    const textBefore = range.startContainer.textContent?.substring(0, range.startOffset) || '';
    const textAfter = range.startContainer.textContent?.substring(range.startOffset) || '';
    
    if (!textBefore || !textAfter) return;
    
    // Calculate the time split
    const totalDuration = line.endTime - line.startTime;
    const splitRatio = textBefore.length / fullText.length;
    const splitTime = line.startTime + (totalDuration * splitRatio);
    
    // Create two new lines
    const newLines = [
      {
        ...line,
        id: `${line.id}_1`,
        text: textBefore.trim(),
        endTime: splitTime
      },
      {
        ...line,
        id: `${line.id}_2`,
        text: textAfter.trim(),
        startTime: splitTime
      }
    ];
    
    // Replace the original line with the two new lines
    const updated = [...editedTranscript];
    updated.splice(index, 1, ...newLines);
    setEditedTranscript(updated);
  };

  const handleMergeWithNext = (index: number) => {
    if (index >= editedTranscript.length - 1) return;
    
    const currentLine = editedTranscript[index];
    const nextLine = editedTranscript[index + 1];
    
    const mergedLine = {
      ...currentLine,
      text: `${currentLine.text} ${nextLine.text}`,
      endTime: nextLine.endTime
    };
    
    const updated = [...editedTranscript];
    updated.splice(index, 2, mergedLine);
    setEditedTranscript(updated);
  };

  const handleSave = async () => {
    if (!user || !isPremium || !contentId) return;
    
    setSaving(true);
    try {
      await UserEditedTranscriptsManager.saveUserEditedTranscript({
        userId: user.uid,
        contentId,
        contentType,
        videoUrl,
        transcript: editedTranscript,
        originalTranscriptId: contentId,
        videoTitle
      });
      
      setHasEdits(true);
      setEditMode(false);
      setShowSaveConfirm(false);
    } catch (error) {
      console.error('Failed to save edited transcript:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedTranscript(hasEdits ? editedTranscript : transcript);
    setEditMode(false);
    setShowSaveConfirm(false);
  };

  const handleResetToOriginal = async () => {
    if (!user || !contentId) return;
    
    if (confirm('Are you sure you want to reset to the original transcript? This will delete all your edits.')) {
      try {
        await UserEditedTranscriptsManager.deleteUserEditedTranscript(user.uid, contentId);
        setEditedTranscript(transcript);
        setHasEdits(false);
        setEditMode(false);
      } catch (error) {
        console.error('Failed to reset transcript:', error);
        alert('Failed to reset transcript. Please try again.');
      }
    }
  };

  const [regenerationSuccess, setRegenerationSuccess] = useState(false);

  const handleTranscriptRegenerated = async (newTranscript: TranscriptLine[], provider: string) => {
    console.log('Transcript regenerated with provider:', provider);
    
    // Update local state with the formatted transcript
    setEditedTranscript(newTranscript);
    setHasEdits(false);
    
    // The transcript is already formatted by RegenerateTranscript component
    // No need to clear formatted transcript as it's already been updated
    
    // Call parent callback if provided
    if (onTranscriptRegenerated) {
      onTranscriptRegenerated(newTranscript);
    }
    
    // Show success message
    setShowRegenerateModal(false);
    setRegenerationSuccess(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setRegenerationSuccess(false);
    }, 3000);
  };

  return (
    <div className="space-y-4">
      {/* Success Message */}
      <AnimatePresence>
        {regenerationSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                Transcript regenerated and formatted successfully! The sentences are now properly split for shadowing.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Controls */}
      {isPremium && showEditTools && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          {!editMode ? (
            /* Normal Mode - Centered buttons */
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  onClick={handleEditToggle}
                  className="flex-1 max-w-xs px-4 py-2 rounded-lg font-medium bg-secondary hover:bg-secondary/80 transition-all"
                >
                  Edit Transcript
                </button>

                {/* Regenerate Button - Premium only, visible outside edit mode for YouTube videos */}
                {videoUrl && isPremium && (
                  <button
                    onClick={() => setShowRegenerateModal(true)}
                    className="flex-1 max-w-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center justify-center gap-2"
                    title="Clear cached transcript and regenerate with improved formatting"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                )}
              </div>
              
              {hasEdits && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    (Using edited version)
                  </span>
                  <button
                    onClick={handleResetToOriginal}
                    className="text-sm text-destructive hover:underline"
                  >
                    Reset to Original
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Edit Mode - Responsive layout */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleEditToggle}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground transition-all"
                >
                  Exit Edit Mode
                </button>
                
                <button
                  onClick={handleCancel}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 font-medium"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges()}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
          
          {editMode && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p>• Click on any text to edit it</p>
              <p>• Use the Split button to divide a line at cursor position</p>
              <p>• Use the Merge button to combine with the next line</p>
            </div>
          )}
        </div>
      )}


      {/* Transcript Lines */}
      <div className="rounded-lg shadow-sm border border-gray-300/50 dark:border-gray-700/50 relative bg-white dark:bg-[#a0aace]">
        {/* Transcript header with count */}
        <div className="px-4 py-3 border-b border-gray-300">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLegend(!showLegend)}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
                aria-label="Toggle grammar legend"
              >
                <GraduationCap className={`w-4 h-4 transition-colors ${showLegend ? 'text-primary' : 'text-gray-900 dark:text-gray-100'}`} />
              </button>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Full Transcript
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-white">
                {processedTranscript.length} lines
              </span>
              {isPremium && (
                <button
                  onClick={() => setShowEditTools(!showEditTools)}
                  className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
                  aria-label="Toggle edit tools"
                >
                  <PencilRuler className={`w-4 h-4 transition-colors ${showEditTools ? 'text-primary' : 'text-gray-900 dark:text-gray-100'}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grammar Legend - toggleable */}
        {showGrammar && !editMode && showLegend && (
          <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
            <GrammarLegend />
          </div>
        )}
        
        {/* Scrollable transcript content with custom scrollbar */}
        <div
          ref={transcriptContainerRef}
          className="max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <div className="space-y-1">
            {processedTranscript.map((item, index) => (
            <div
              key={item.original.id}
              ref={(el) => {
                const segmentKey = `${item.original.id}`;
                segmentRefs.current[segmentKey] = el;
              }}
              className={`relative ${editMode ? 'p-6' : 'p-4'} ${
                !editMode ? 'cursor-pointer' : ''
              } transition-all ${
                index === currentLineIndex && !editMode
                  ? 'bg-primary/10 border-l-4 border-primary-500'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => {
                if (!editMode) {
                  console.log(`Jumping to segment: ${formatTimestamp(item.original.startTime)} - "${item.original.text.substring(0, 30)}..."`);
                  onLineClick(index);  // Update state
                  onSeekToTime?.(item.original.startTime);  // Direct seek
                }
              }}
            >
              {/* Timestamp - Top Right Corner */}
              <span className="absolute top-2 right-2 text-[10px] text-gray-500 font-mono">
                {formatTimestamp(item.original.startTime)}
              </span>

              {/* Text Content */}
              <div className="pr-16">
                  {editMode ? (
                    <div>
                      <div
                        ref={(el) => {
                          if (el) {
                            editRefs.current[item.original.id] = el;
                          }
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        className="text-foreground japanese-text text-lg leading-relaxed outline-none focus:ring-2 focus:ring-primary rounded p-2"
                        onBlur={(e) => handleTextEdit(index, e.currentTarget.textContent || '')}
                        dangerouslySetInnerHTML={{ __html: item.original.text }}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleSplitLine(index)}
                          className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 rounded"
                        >
                          Split Here
                        </button>
                        {index < processedTranscript.length - 1 && (
                          <button
                            onClick={() => handleMergeWithNext(index)}
                            className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 rounded"
                          >
                            Merge with Next
                          </button>
                        )}
                      </div>
                    </div>
                  ) : showGrammar ? (
                    <GrammarHighlightedText
                      text={item.original.text}
                      onWordClick={handleWordClick}
                      highlightMode="all"
                      showFurigana={showFurigana}
                    />
                  ) : (
                    <p
                      className="text-gray-900 japanese-text text-lg leading-loose"
                      style={{ color: '#111827' }}
                      dangerouslySetInnerHTML={{
                        __html: showFurigana ? item.withFurigana : item.original.text
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const target = e.target as HTMLElement;
                        if (target.tagName !== 'RT' && target.tagName !== 'RP') {
                          const selection = window.getSelection();
                          const word = selection?.toString().trim();
                          if (word) {
                            handleWordClick(word);
                          }
                        }
                      }}
                    />
                  )}
                  {showTranslations && item.original.translation && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.original.translation}
                    </p>
                  )}
                </div>

              {/* Play indicator */}
              {index === currentLineIndex && !editMode && (
                <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
        
        {/* Scroll indicator */}
        {processedTranscript.length > 10 && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none">
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="text-xs text-muted-foreground bg-card/90 px-3 py-1 rounded-full border border-border/50 backdrop-blur-sm">
                ↓ Scroll for more
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Confirmation Modal */}
      <AnimatePresence>
        {showSaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSaveConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-card rounded-lg shadow-lg border border-border p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Unsaved Changes</h3>
              <p className="text-muted-foreground mb-6">
                You have unsaved changes. Do you want to save them before exiting edit mode?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setEditMode(false);
                    setShowSaveConfirm(false);
                    setEditedTranscript(hasEdits ? editedTranscript : transcript);
                  }}
                  className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80"
                >
                  Discard Changes
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Word Explanation Modal */}
      <WordExplanationModal
        isOpen={isWordModalOpen}
        onClose={handleCloseWordModal}
        word={currentWord}
        explanation={wordExplanation}
        loading={wordLoading}
        error={wordError}
      />

      {/* Regenerate Transcript Modal - TODO: Implement */}
      {showRegenerateModal && videoUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-4">Regenerate Transcript</h3>
            <p className="text-muted-foreground">Transcript regeneration not implemented yet</p>
            <button
              onClick={() => setShowRegenerateModal(false)}
              className="mt-4 px-4 py-2 bg-secondary rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
