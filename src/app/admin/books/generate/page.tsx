'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { JLPTLevel } from '@/types/ai-story';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { motion } from 'framer-motion';
import { Upload, Sparkles } from 'lucide-react';

interface GenerationProgress {
  step: 'content' | 'cover' | 'audio' | 'complete';
  message: string;
  progress: number;
}

export default function GenerateBookPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const { showToast } = useToast();

  // Form state
  const [bookName, setBookName] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [additionalContext, setAdditionalContext] = useState<string>('');
  const [coverOption, setCoverOption] = useState<'upload' | 'ai'>('ai');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [currentStep, setCurrentStep] = useState<'setup' | 'generating' | 'complete'>('setup');
  const [generatedBookId, setGeneratedBookId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/');
    }
  }, [user, sessionLoading, router]);

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!bookName) {
      showToast('Please enter a book name', 'error');
      return;
    }

    if (!user?.uid) {
      showToast('Authentication required', 'error');
      return;
    }

    setIsGenerating(true);
    setCurrentStep('generating');
    setGenerationProgress({
      step: 'content',
      message: 'Generating condensed book summary...',
      progress: 10
    });

    try {
      let coverImageUrl = '';

      // Step 1: Upload cover image if provided
      if (coverOption === 'upload' && coverImageFile) {
        setGenerationProgress({
          step: 'cover',
          message: 'Uploading cover image...',
          progress: 5
        });

        const formData = new FormData();
        formData.append('file', coverImageFile);
        formData.append('path', `books/covers/${Date.now()}_${coverImageFile.name}`);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          coverImageUrl = uploadData.url;
        } else {
          console.warn('Cover image upload failed, continuing without it');
        }
      }

      // Step 2: Generate book content
      setGenerationProgress({
        step: 'content',
        message: 'AI is creating the condensed summary...',
        progress: 20
      });

      const generateResponse = await fetch('/api/admin/books/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          bookName,
          author,
          jlptLevel,
          additionalContext,
          coverImageUrl,
          generateCover: coverOption === 'ai'
        })
      });

      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        throw new Error(error.error || 'Failed to generate book');
      }

      const { draftId } = await generateResponse.json();
      setGeneratedBookId(draftId);

      setGenerationProgress({
        step: 'complete',
        message: 'Book generated successfully! Publishing...',
        progress: 90
      });

      // Step 3: Auto-publish the book
      const publishResponse = await fetch('/api/admin/books/publish-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ draftId })
      });

      if (!publishResponse.ok) {
        throw new Error('Failed to publish book');
      }

      setGenerationProgress({
        step: 'complete',
        message: 'Book published successfully!',
        progress: 100
      });

      showToast('Book generated and published successfully!', 'success');

      // Redirect to books management page
      setTimeout(() => {
        router.push('/admin/books');
      }, 2000);

    } catch (error) {
      console.error('Book generation error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate book', 'error');
      setCurrentStep('setup');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  if (sessionLoading) {
    return <LoadingOverlay />;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          📚 Generate Book Summary
        </h1>

        {/* Setup Form */}
        {currentStep === 'setup' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-dark-700 space-y-6"
          >
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">AI will generate:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>A <strong>narrative story version</strong> (not a summary) in Japanese</li>
                    <li>Length: <strong>1000-1500 characters</strong> (5-7 min read, 2-3 pages)</li>
                    <li>Proper story flow with beginning, middle, and end</li>
                    <li>JLPT-appropriate vocabulary and grammar</li>
                    <li>⏱️ Generation may take up to 10 minutes (using your Sheldon server)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Book Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Book Name *
              </label>
              <input
                type="text"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                placeholder="e.g., The Little Prince, Rich Dad Poor Dad"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Author (Optional)
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g., Antoine de Saint-Exupéry"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty and AI will research and fill in the correct author name
              </p>
            </div>

            {/* JLPT Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                JLPT Level *
              </label>
              <select
                value={jlptLevel}
                onChange={(e) => setJlptLevel(e.target.value as JLPTLevel)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              >
                <option value="N5">N5 (Beginner)</option>
                <option value="N4">N4 (Elementary)</option>
                <option value="N3">N3 (Intermediate)</option>
                <option value="N2">N2 (Upper Intermediate)</option>
                <option value="N1">N1 (Advanced)</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The AI will condense the book to match this level's vocabulary and grammar
              </p>
            </div>

            {/* Additional Context */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Context (Optional)
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
                placeholder="Any specific focus or instructions for the AI..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              />
            </div>

            {/* Cover Image Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Book Cover
              </label>
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setCoverOption('ai')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    coverOption === 'ai'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <Sparkles className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">AI Generate</span>
                </button>
                <button
                  onClick={() => setCoverOption('upload')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    coverOption === 'upload'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <Upload className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">Upload Image</span>
                </button>
              </div>

              {coverOption === 'upload' && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                  />
                  {coverImagePreview && (
                    <div className="mt-3">
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className="w-48 h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!bookName || isGenerating}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm"
            >
              Generate Book Summary
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
                Generating Book Summary...
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

              {/* Loading Animation */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
