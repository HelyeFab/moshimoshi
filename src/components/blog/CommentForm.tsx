'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createComment, validateCommentContent, type Comment } from '@/services/commentService';

interface CommentFormProps {
  postId: string;
  isAuthenticated: boolean;
  onCommentAdded: (comment: Comment) => void;
}

export function CommentForm({ postId, isAuthenticated, onCommentAdded }: CommentFormProps) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError(null);

    // Validate content
    const validation = validateCommentContent(content);
    if (!validation.valid) {
      setError(validation.error || 'Invalid comment');
      return;
    }

    setIsSubmitting(true);

    try {
      const newComment = await createComment({ postId, content });
      onCommentAdded(newComment);
      setContent(''); // Clear form on success
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-gradient-to-r from-primary-50 to-japanese-sakura/10 dark:from-primary-900/20 dark:to-japanese-sakuraDark/10 rounded-xl p-6 text-center border border-primary-200 dark:border-primary-800">
        <div className="text-4xl mb-3">💬</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Join the conversation
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Sign in to share your thoughts and connect with other readers
        </p>
        <button
          onClick={() => router.push('/auth/signin')}
          className="px-6 py-3 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-lg hover:from-primary-600 hover:to-japanese-sakuraDark transition-all font-medium shadow-md hover:shadow-lg"
        >
          Sign in to comment
        </button>
      </div>
    );
  }

  const remainingChars = 2000 - content.length;
  const isNearLimit = remainingChars < 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="comment-content" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Add a comment
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isSubmitting}
          placeholder="Share your thoughts..."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          rows={4}
          maxLength={2000}
          aria-label="Comment content"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'comment-error' : 'comment-chars'}
        />
        <div className="flex items-center justify-between mt-2">
          <span
            id="comment-chars"
            className={`text-sm ${
              isNearLimit ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {remainingChars} characters remaining
          </span>
        </div>
      </div>

      {error && (
        <div
          id="comment-error"
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !content.trim()}
        className="px-6 py-3 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-lg hover:from-primary-600 hover:to-japanese-sakuraDark transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Posting...
          </span>
        ) : (
          'Post Comment'
        )}
      </button>
    </form>
  );
}
