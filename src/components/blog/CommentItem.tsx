'use client';

import { useState } from 'react';
import type { Comment } from '@/services/commentService';
import { updateComment, deleteComment } from '@/services/commentService';
import Modal from '@/components/ui/Modal';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  isAdmin?: boolean;
  onUpdate: (updatedComment: Comment) => void;
  onDelete: (commentId: string) => void;
}

export function CommentItem({ comment, currentUserId, isAdmin, onUpdate, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isOwner = currentUserId === comment.userId;
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin;

  const formatDate = (date: string | Date) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return '';
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
    setError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
    setError(null);
  };

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();

    if (trimmed.length < 2) {
      setError('Comment must be at least 2 characters');
      return;
    }

    if (trimmed.length > 2000) {
      setError('Comment must be less than 2000 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await updateComment(comment.id, { content: trimmed });
      onUpdate(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    setShowDeleteModal(false);
    try {
      await deleteComment(comment.id);
      onDelete(comment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex gap-4 p-4 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {comment.userPhotoURL ? (
          <img
            src={comment.userPhotoURL}
            alt={comment.userDisplayName}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-japanese-sakura flex items-center justify-center text-white font-semibold">
            {comment.userDisplayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {comment.userDisplayName}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
            {formatDate(comment.createdAt)}
          </span>
          {comment.isEdited && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:opacity-50"
              rows={3}
              maxLength={2000}
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            {(canEdit || canDelete) && (
              <div className="flex gap-3 mt-3">
                {canEdit && (
                  <button
                    onClick={handleEdit}
                    disabled={isSubmitting}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium disabled:opacity-50"
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDeleteClick}
                    disabled={isSubmitting}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium disabled:opacity-50"
                  >
                    {isSubmitting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Comment"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this comment? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
