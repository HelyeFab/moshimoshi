'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { JLPTLevel } from '@/types/aiStory';
import { STORY_THEMES } from '@/types/story';
import { AIStoryDraft, AIGenerationProgress, AICharacterSheet } from '@/types/ai-story';
import { storyService } from '@/lib/services/StoryService';
import Navbar from '@/components/layout/Navbar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { motion, AnimatePresence } from 'framer-motion';

export default function GenerateStoryPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const { showToast } = useToast();

  // Form state
  const [theme, setTheme] = useState<string>('');
  const [customTheme, setCustomTheme] = useState<string>('');
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [pageCount, setPageCount] = useState<number>(5);
  const [generateImages, setGenerateImages] = useState<boolean>(true);
  const [includeQuiz, setIncludeQuiz] = useState<boolean>(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<AIGenerationProgress | null>(null);
  const [storyDraft, setStoryDraft] = useState<AIStoryDraft | null>(null);
  const [currentStep, setCurrentStep] = useState<'setup' | 'generating' | 'review'>('setup');
  const [draftId, setDraftId] = useState<string | null>(null);

  // Character and session state for consistency
  const [characterProfile, setCharacterProfile] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/');
    }
  }, [user, sessionLoading, router]);

  const handleGenerate = async () => {
    const finalTheme = theme === 'custom' ? customTheme : theme;

    if (!finalTheme) {
      showToast({
        message: 'Please select or enter a theme',
        type: 'error'
      });
      return;
    }

    if (!user?.uid) {
      showToast({
        message: 'Authentication required',
        type: 'error'
      });
      return;
    }

    setIsGenerating(true);
    setCurrentStep('generating');
    setGenerationProgress({
      step: 'character_sheet',
      message: 'Creating character designs and story world...',
      progress: 10
    });

    try {
      // Step 1: Generate character sheet
      const characterResponse = await fetch('/api/admin/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          step: 'character_sheet',
          theme: finalTheme,
          jlptLevel,
          pageCount
        })
      });

      if (!characterResponse.ok) {
        const error = await characterResponse.json();
        throw new Error(error.error || 'Failed to generate character sheet');
      }

      const characterData = await characterResponse.json();
      const newDraftId = characterData.draftId;
      setDraftId(newDraftId);

      // Update progress
      setGenerationProgress({
        step: 'outline',
        message: 'Creating story outline and plot structure...',
        progress: 25
      });

      // Step 2: Generate outline
      const outlineResponse = await fetch('/api/admin/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          step: 'outline',
          theme: finalTheme,
          jlptLevel,
          pageCount,
          draftId: newDraftId
        })
      });

      if (!outlineResponse.ok) {
        const error = await outlineResponse.json();
        throw new Error(error.error || 'Failed to generate outline');
      }

      // Step 3: Generate pages one by one
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        setGenerationProgress({
          step: 'pages',
          currentPage: pageNum,
          totalPages: pageCount,
          message: `Writing page ${pageNum} of ${pageCount}...`,
          progress: 25 + (pageNum / pageCount) * 40
        });

        const pageResponse = await fetch('/api/admin/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            step: 'generate_page',
            jlptLevel,
            pageNumber: pageNum,
            draftId: newDraftId
          })
        });

        if (!pageResponse.ok) {
          const error = await pageResponse.json();
          throw new Error(error.error || `Failed to generate page ${pageNum}`);
        }
      }

      // Step 4: Generate quiz if requested
      if (includeQuiz) {
        setGenerationProgress({
          step: 'quiz',
          message: 'Creating comprehension quiz questions...',
          progress: 70
        });

        const quizResponse = await fetch('/api/admin/generate-story', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            step: 'generate_quiz',
            jlptLevel,
            draftId: newDraftId
          })
        });

        if (!quizResponse.ok) {
          console.error('Quiz generation failed, but continuing...');
        }
      }

      // Step 5: Generate images if requested
      if (generateImages) {
        setGenerationProgress({
          step: 'images',
          currentPage: 0,
          totalPages: pageCount,
          message: 'Generating story illustrations...',
          progress: 80
        });

        // TODO: Add image generation for each page
        // This would call an image generation API for each page
        // For now, we'll skip actual image generation
      }

      setGenerationProgress({
        step: 'complete',
        message: 'Story generation complete!',
        progress: 100
      });

      // Load the completed draft
      const draft = await storyService.getAIDraft(newDraftId);
      if (draft) {
        setStoryDraft(draft);
        setCurrentStep('review');
      }

      showToast({
        message: 'Story generated successfully!',
        type: 'success'
      });

    } catch (error) {
      console.error('Story generation error:', error);
      showToast({
        message: error instanceof Error ? error.message : 'Failed to generate story',
        type: 'error'
      });
      setCurrentStep('setup');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  const handlePublish = async () => {
    if (!storyDraft || !draftId) return;

    try {
      // Convert draft to story format and save
      const slug = storyDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

      await storyService.saveStory({
        title: storyDraft.title,
        titleJa: storyDraft.titleJa,
        description: storyDraft.description,
        theme: storyDraft.theme,
        jlptLevel: storyDraft.jlptLevel,
        pages: storyDraft.pages,
        quiz: [],
        authorId: user?.uid || 'admin',
        status: 'published',
        viewCount: 0,
        completionCount: 0,
        slug,
        tags: ['ai-generated'],
        isAIGenerated: true,
        aiModel: storyDraft.metadata.openAiModel,
        characterSheet: storyDraft.characterSheet
      });

      // Update draft status
      await storyService.updateAIDraftStatus(draftId, 'published');

      showToast({
        message: 'Story published successfully!',
        type: 'success'
      });

      router.push('/admin/stories');
    } catch (error) {
      console.error('Error publishing story:', error);
      showToast({
        message: 'Failed to publish story',
        type: 'error'
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!storyDraft || !draftId) return;

    try {
      await storyService.updateAIDraftStatus(draftId, 'draft');

      showToast({
        message: 'Draft saved successfully!',
        type: 'success'
      });

      router.push('/admin/stories');
    } catch (error) {
      console.error('Error saving draft:', error);
      showToast({
        message: 'Failed to save draft',
        type: 'error'
      });
    }
  };

  if (sessionLoading) {
    return <LoadingOverlay />;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-dark">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          AI Story Generator
        </h1>

        {/* Setup Form */}
        {currentStep === 'setup' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg space-y-6"
          >
            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Story Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select a theme...</option>
                {STORY_THEMES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="custom">Custom Theme...</option>
              </select>

              {theme === 'custom' && (
                <input
                  type="text"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  placeholder="Enter your custom theme..."
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                />
              )}
            </div>

            {/* JLPT Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                JLPT Level
              </label>
              <select
                value={jlptLevel}
                onChange={(e) => setJlptLevel(e.target.value as JLPTLevel)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              >
                <option value="N5">N5 (Beginner)</option>
                <option value="N4">N4 (Elementary)</option>
                <option value="N3">N3 (Intermediate)</option>
                <option value="N2">N2 (Upper Intermediate)</option>
                <option value="N1">N1 (Advanced)</option>
              </select>
            </div>

            {/* Page Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Pages
              </label>
              <input
                type="number"
                min="3"
                max="20"
                value={pageCount}
                onChange={(e) => setPageCount(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Recommended: 3-10 pages for optimal generation
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generateImages}
                  onChange={(e) => setGenerateImages(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Generate illustrations for each page
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeQuiz}
                  onChange={(e) => setIncludeQuiz(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Include comprehension quiz
                </span>
              </label>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!theme && !customTheme}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
            >
              Generate Story
            </button>
          </motion.div>
        )}

        {/* Generation Progress */}
        {currentStep === 'generating' && generationProgress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg"
          >
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Generating Your Story...
              </h2>

              {/* Progress Message */}
              <p className="text-gray-600 dark:text-gray-400">
                {generationProgress.message}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <motion.div
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${generationProgress.progress || 0}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Step Details */}
              {generationProgress.currentPage && generationProgress.totalPages && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Page {generationProgress.currentPage} of {generationProgress.totalPages}
                </p>
              )}

              {/* Loading Animation */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Review Draft */}
        {currentStep === 'review' && storyDraft && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Draft Preview */}
            <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {storyDraft.title}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                {storyDraft.titleJa}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {storyDraft.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Theme:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {storyDraft.theme}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Level:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {storyDraft.jlptLevel}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Pages:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {storyDraft.pages.length}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Status:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {storyDraft.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Character Sheet Preview */}
            {storyDraft.characterSheet && (
              <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Character Design
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      Main Character:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {storyDraft.characterSheet.mainCharacter.name} ({storyDraft.characterSheet.mainCharacter.nameJa})
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">
                    {storyDraft.characterSheet.mainCharacter.description}
                  </p>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      Visual Style:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {storyDraft.characterSheet.visualStyle}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Page Preview */}
            <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Story Pages Preview
              </h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {storyDraft.pages.slice(0, 3).map((page, index) => (
                  <div key={index} className="border-l-4 border-primary-500 pl-4">
                    <p className="font-medium text-gray-900 dark:text-white mb-1">
                      Page {page.pageNumber}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {page.text.substring(0, 150)}...
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                      {page.translation.substring(0, 150)}...
                    </p>
                  </div>
                ))}
                {storyDraft.pages.length > 3 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    ... and {storyDraft.pages.length - 3} more pages
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handlePublish}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                Publish Story
              </button>
              <button
                onClick={handleSaveDraft}
                className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
              >
                Save as Draft
              </button>
              <button
                onClick={() => {
                  setCurrentStep('setup');
                  setStoryDraft(null);
                  setDraftId(null);
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Start Over
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}