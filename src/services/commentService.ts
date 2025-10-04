// Client-side comment service - uses API routes, NO direct Firestore access

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  userEmail: string;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  isEdited: boolean;
  deletedAt?: string | Date;
}

export interface CreateCommentData {
  postId: string;
  content: string;
}

export interface UpdateCommentData {
  content: string;
}

/**
 * Get all comments for a blog post
 */
export async function getComments(postId: string): Promise<Comment[]> {
  try {
    const response = await fetch(`/api/blog/${postId}/comments`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch comments');
    }

    const data = await response.json();
    return data.data as Comment[];
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

/**
 * Create a new comment
 */
export async function createComment(commentData: CreateCommentData): Promise<Comment> {
  try {
    const response = await fetch(`/api/blog/${commentData.postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ content: commentData.content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create comment');
    }

    const data = await response.json();
    return data.data as Comment;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
}

/**
 * Update a comment
 */
export async function updateComment(commentId: string, updateData: UpdateCommentData): Promise<Comment> {
  try {
    const response = await fetch(`/api/blog/comments/${commentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update comment');
    }

    const data = await response.json();
    return data.data as Comment;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  try {
    const response = await fetch(`/api/blog/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete comment');
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

/**
 * Validate comment content
 */
export function validateCommentContent(content: string): { valid: boolean; error?: string } {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return { valid: false, error: 'Comment cannot be empty' };
  }

  if (trimmedContent.length < 2) {
    return { valid: false, error: 'Comment must be at least 2 characters' };
  }

  if (trimmedContent.length > 2000) {
    return { valid: false, error: 'Comment must be less than 2000 characters' };
  }

  return { valid: true };
}
