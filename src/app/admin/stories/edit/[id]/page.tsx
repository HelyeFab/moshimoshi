'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { storyService } from '@/lib/services/StoryService';
// Navigation is now global via NavigationWrapper in root layout;
import { Story, StoryQuizQuestion } from '@/types/story';
import { JLPTLevel } from '@/types/ai-story';
import { STORY_THEMES } from '@/types/story';
import { ChevronLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

interface PageData {
  text: string;
  translation: string;
  imageUrl?: string;
}

interface QuizQuestionData {
  id: string;
  question: string;
  questionJa?: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  explanationJa?: string;
}

export default function EditStoryPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();

  const storyId = params.id as string;
  const isDraft = searchParams.get('draft') === 'true';

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [title, setTitle] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<string>(STORY_THEMES[0]);
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [pages, setPages] = useState<PageData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [quiz, setQuiz] = useState<QuizQuestionData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load story data
  useEffect(() => {
    const loadStory = async () => {
      try {
        let storyData;

        if (isDraft) {
          // Load from drafts collection via API
          const response = await fetch(`/api/admin/stories/drafts/${storyId}`);
          if (!response.ok) {
            showToast('Draft not found', 'error');
            router.push('/admin/stories');
            return;
          }

          const { draft } = await response.json();

          // Convert draft to story format for editing
          storyData = {
            id: draft.id,
            title: draft.characterSheet?.storyTitle || 'Untitled',
            titleJa: draft.characterSheet?.storyTitleJa || '無題',
            description: draft.characterSheet?.summary || '',
            theme: draft.theme || 'adventure',
            jlptLevel: draft.jlptLevel || 'N5',
            pages: draft.pages || [],
            quiz: draft.quiz || [],
            status: 'draft' as const,
            tags: [],
            slug: draft.id,
            authorId: draft.userId || '',
            viewCount: 0,
            completionCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        } else {
          // Load from stories collection
          storyData = await storyService.getStory(storyId);
          if (!storyData) {
            showToast('Story not found', 'error');
            router.push('/admin/stories');
            return;
          }
        }

        setStory(storyData);
        setTitle(storyData.title);
        setTitleJa(storyData.titleJa);
        setDescription(storyData.description);
        setTheme(storyData.theme);
        setJlptLevel(storyData.jlptLevel);
        setStatus(storyData.status);
        setTags(storyData.tags || []);

        // Convert story pages to editable format
        setPages(storyData.pages.map(page => ({
          text: page.text,
          translation: page.translation,
          imageUrl: page.imageUrl || ''
        })));

        // Load quiz data
        setQuiz((storyData.quiz || []).map(q => ({
          id: q.id,
          question: q.question,
          questionJa: q.questionJa || '',
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation || '',
          explanationJa: q.explanationJa || ''
        })));
      } catch (error) {
        console.error('Error loading story:', error);
        showToast('Failed to load story', 'error');
        router.push('/admin/stories');
      } finally {
        setLoading(false);
      }
    };

    if (storyId) {
      loadStory();
    }
  }, [storyId, isDraft, router, showToast]);

  const handleAddPage = () => {
    setPages([...pages, { text: '', translation: '', imageUrl: '' }]);
  };

  const handleRemovePage = (index: number) => {
    if (pages.length > 1) {
      setPages(pages.filter((_, i) => i !== index));
    }
  };

  const handlePageChange = (index: number, field: keyof PageData, value: string) => {
    const newPages = [...pages];
    newPages[index] = { ...newPages[index], [field]: value };
    setPages(newPages);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Quiz handlers
  const handleAddQuiz = () => {
    const newQuestion: QuizQuestionData = {
      id: `quiz-${Date.now()}`,
      question: '',
      questionJa: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: '',
      explanationJa: ''
    };
    setQuiz([...quiz, newQuestion]);
  };

  const handleRemoveQuiz = (index: number) => {
    setQuiz(quiz.filter((_, i) => i !== index));
  };

  const handleQuizChange = (index: number, field: keyof QuizQuestionData, value: any) => {
    const newQuiz = [...quiz];
    newQuiz[index] = { ...newQuiz[index], [field]: value };
    setQuiz(newQuiz);
  };

  const handleQuizOptionChange = (quizIndex: number, optionIndex: number, value: string) => {
    const newQuiz = [...quiz];
    const options = [...newQuiz[quizIndex].options];
    options[optionIndex] = value;
    newQuiz[quizIndex] = { ...newQuiz[quizIndex], options };
    setQuiz(newQuiz);
  };

  const handleSave = async () => {
    if (!title || !titleJa || !description) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (pages.some(p => !p.text || !p.translation)) {
      showToast('All pages must have Japanese text and translation', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const formattedPages = pages.map((page, index) => ({
        pageNumber: index + 1,
        text: page.text,
        translation: page.translation,
        imageUrl: page.imageUrl || '',
        imageAlt: `Page ${index + 1}`,
        vocabularyNotes: story?.pages[index]?.vocabularyNotes || {},
        grammarNotes: story?.pages[index]?.grammarNotes || {}
      }));

      await storyService.updateStory(storyId, {
        title,
        titleJa,
        description,
        jlptLevel,
        theme,
        tags,
        pages: formattedPages,
        status,
        quiz: quiz as StoryQuizQuestion[]
      });

      showToast('Story updated successfully!', 'success');

      router.push('/admin/stories');
    } catch (error) {
      console.error('Error updating story:', error);
      showToast('Failed to update story', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return;
    }

    try {
      await storyService.deleteStory(storyId);
      showToast('Story deleted successfully', 'success');
      router.push('/admin/stories');
    } catch (error) {
      console.error('Error deleting story:', error);
      showToast('Failed to delete story', 'error');
    }
  };

  if (!user || !user.isAdmin) {
    return null;
  }

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <>
      {/* Navigation is now global - rendered in root layout */}
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
        <div className="container mx-auto px-4 py-8">
          <Link
            href="/admin/stories"
            className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-6"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back to Stories
          </Link>
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Edit Story
            </h1>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Delete Story
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-dark-700 space-y-6">
          {/* Status */}
          <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title (English) *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                placeholder="Enter English title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title (Japanese) *
              </label>
              <input
                type="text"
                value={titleJa}
                onChange={(e) => setTitleJa(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                placeholder="Enter Japanese title with furigana"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use ruby tags for furigana: &lt;ruby&gt;漢字&lt;rt&gt;かんじ&lt;/rt&gt;&lt;/ruby&gt;
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder="Brief description of the story"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              >
                {STORY_THEMES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

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
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                placeholder="Add a tag"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Story Pages
              </h2>
              <button
                onClick={handleAddPage}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <PlusIcon className="w-4 h-4" />
                Add Page
              </button>
            </div>

            <div className="space-y-6">
              {pages.map((page, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Page {index + 1}
                    </h3>
                    {pages.length > 1 && (
                      <button
                        onClick={() => handleRemovePage(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Japanese Text *
                      </label>
                      <textarea
                        value={page.text}
                        onChange={(e) => handlePageChange(index, 'text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                        rows={4}
                        placeholder="Enter Japanese text with ruby tags for furigana"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        English Translation *
                      </label>
                      <textarea
                        value={page.translation}
                        onChange={(e) => handlePageChange(index, 'translation', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                        rows={3}
                        placeholder="Enter English translation"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Image URL (optional)
                      </label>
                      <input
                        type="text"
                        value={page.imageUrl}
                        onChange={(e) => handlePageChange(index, 'imageUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quiz Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Quiz Questions
              </h2>
              <button
                onClick={handleAddQuiz}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <PlusIcon className="w-4 h-4" />
                Add Question
              </button>
            </div>

            {quiz.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400 mb-2">No quiz questions yet</p>
                <button
                  onClick={handleAddQuiz}
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Add your first question
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {quiz.map((question, qIndex) => (
                  <div
                    key={question.id}
                    className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-800"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        Question {qIndex + 1}
                      </h3>
                      <button
                        onClick={() => handleRemoveQuiz(qIndex)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Question Text */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Question (English)
                          </label>
                          <input
                            type="text"
                            value={question.question}
                            onChange={(e) => handleQuizChange(qIndex, 'question', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100"
                            placeholder="Enter question in English"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Question (Japanese)
                          </label>
                          <input
                            type="text"
                            value={question.questionJa}
                            onChange={(e) => handleQuizChange(qIndex, 'questionJa', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100"
                            placeholder="Enter question in Japanese"
                          />
                        </div>
                      </div>

                      {/* Options */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Answer Options
                        </label>
                        <div className="space-y-2">
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${qIndex}`}
                                checked={question.correctIndex === oIndex}
                                onChange={() => handleQuizChange(qIndex, 'correctIndex', oIndex)}
                                className="w-4 h-4 text-green-600"
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400 w-8">
                                {String.fromCharCode(65 + oIndex)}.
                              </span>
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleQuizOptionChange(qIndex, oIndex, e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100"
                                placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Select the radio button next to the correct answer
                        </p>
                      </div>

                      {/* Explanations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Explanation (English)
                          </label>
                          <textarea
                            value={question.explanation}
                            onChange={(e) => handleQuizChange(qIndex, 'explanation', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100"
                            rows={2}
                            placeholder="Optional explanation"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Explanation (Japanese)
                          </label>
                          <textarea
                            value={question.explanationJa}
                            onChange={(e) => handleQuizChange(qIndex, 'explanationJa', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100"
                            rows={2}
                            placeholder="Optional explanation in Japanese"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Display */}
          {story && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Story Statistics</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Views:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{story.viewCount}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Completions:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{story.completionCount}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Quiz Questions:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{quiz.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => router.push('/admin/stories')}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}