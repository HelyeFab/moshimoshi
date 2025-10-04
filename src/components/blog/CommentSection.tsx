'use client';

import { useState, useEffect } from 'react';
import { getComments, type Comment } from '@/services/commentService';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

interface CommentSectionProps {
  postId: string;
  currentUserId?: string;
  isAdmin?: boolean;
}

export function CommentSection({ postId, currentUserId, isAdmin }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!currentUserId;

  // Fetch comments on mount
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedComments = await getComments(postId);
        setComments(fetchedComments);
      } catch (err) {
        console.error('Error loading comments:', err);
        setError('Failed to load comments. Please refresh to try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [postId]);

  const handleCommentAdded = (newComment: Comment) => {
    // Add new comment to the top of the list (optimistic update)
    setComments((prev) => [newComment, ...prev]);
  };

  const handleCommentUpdated = (updatedComment: Comment) => {
    setComments((prev) =>
      prev.map((comment) => (comment.id === updatedComment.id ? updatedComment : comment))
    );
  };

  const handleCommentDeleted = (commentId: string) => {
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
  };

  return (
    <section className="mt-16 pt-12 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-3 h-3 bg-gradient-to-r from-primary-500 to-japanese-sakura rounded-full"></div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Comments {!loading && `(${comments.length})`}
        </h2>
      </div>

      {/* Comment Form */}
      <div className="mb-8">
        <CommentForm
          postId={postId}
          isAuthenticated={isAuthenticated}
          onCommentAdded={handleCommentAdded}
        />
      </div>

      {/* Comments List */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="relative mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 dark:border-primary-800 mx-auto"></div>
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-primary-500 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">Loading comments...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-lg text-center">
            <p className="font-medium mb-2">Error loading comments</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-5xl mb-4">💭</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No comments yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Be the first to share your thoughts on this post!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onUpdate={handleCommentUpdated}
              onDelete={handleCommentDeleted}
            />
          ))
        )}
      </div>
    </section>
  );
}
