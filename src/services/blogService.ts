// Client-side blog service - uses API routes, NO direct Firestore access

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  authorImage?: string;
  cover?: string;
  tags: string[];
  status: 'draft' | 'published' | 'scheduled';
  publishDate: string | Date | any; // API will handle conversion
  createdAt: string | Date | any; // API will handle conversion
  updatedAt: string | Date | any; // API will handle conversion
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  canonical?: string;
  readingTime?: string;
  views?: number;
}


// Create or update a blog post
export async function saveBlogPost(post: Partial<BlogPost>, postId?: string): Promise<string> {
  try {
    const endpoint = postId ? '/api/blog' : '/api/blog';
    const method = postId ? 'PATCH' : 'POST';

    const body = postId ? { id: postId, ...post } : post;

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to save blog post');
    }

    const data = await response.json();
    return data.data.id;
  } catch (error) {
    console.error('Error saving blog post:', error);
    throw error;
  }
}

// Get all blog posts (admin view)
export async function getAllBlogPosts(includeScheduled = true): Promise<BlogPost[]> {
  try {
    const response = await fetch('/api/blog', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch blog posts');
    }

    const data = await response.json();
    const posts = data.data as BlogPost[];

    if (!includeScheduled) {
      const now = new Date();
      return posts.filter(post => {
        if (post.status === 'draft') return false;
        if (post.status === 'scheduled') {
          const publishDate = new Date(post.publishDate);
          return publishDate <= now;
        }
        return true;
      });
    }

    return posts;
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    throw error;
  }
}

// Get published blog posts (public view)
export async function getPublishedBlogPosts(maxPosts?: number): Promise<BlogPost[]> {
  try {
    const url = maxPosts ? `/api/blog/public?limit=${maxPosts}` : '/api/blog/public';
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch blog posts');
    }

    const data = await response.json();
    return data.data as BlogPost[];
  } catch (error) {
    console.error('Error fetching published blog posts:', error);
    throw error;
  }
}

// Get a single blog post by slug
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(`/api/blog/slug/${slug}`, {
      method: 'GET',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch blog post');
    }

    const data = await response.json();
    return data.data as BlogPost;
  } catch (error) {
    console.error('Error fetching blog post by slug:', error);
    throw error;
  }
}

// Get a single blog post by ID (admin)
export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(`/api/blog/${id}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch blog post');
    }

    const data = await response.json();
    return data.data as BlogPost;
  } catch (error) {
    console.error('Error fetching blog post by ID:', error);
    throw error;
  }
}

// Delete a blog post
export async function deleteBlogPost(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/blog?id=${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete blog post');
    }
  } catch (error) {
    console.error('Error deleting blog post:', error);
    throw error;
  }
}

// Get related posts by tags
export async function getRelatedPosts(currentSlug: string, tags: string[], maxPosts = 3): Promise<BlogPost[]> {
  try {
    if (tags.length === 0) return [];

    // For now, fetch all published posts and filter client-side
    // In production, you'd want a dedicated API endpoint for this
    const allPosts = await getPublishedBlogPosts();

    const relatedPosts = allPosts
      .filter(post =>
        post.slug !== currentSlug &&
        post.tags?.some(tag => tags.includes(tag))
      )
      .slice(0, maxPosts);

    return relatedPosts;
  } catch (error) {
    console.error('Error fetching related posts:', error);
    return [];
  }
}

// Increment view count (now handled server-side when fetching post)
export async function incrementBlogPostViews(id: string): Promise<void> {
  // Views are now incremented automatically server-side when fetching a post
  // This function is kept for backward compatibility but does nothing
  return;
}

// Publish scheduled posts (should be called from a server-side cron job)
export async function publishScheduledPosts(): Promise<void> {
  // This should be implemented as a server-side cron job/scheduled function
  // Client-side cannot reliably handle scheduled publishing
  console.warn('Scheduled post publishing should be handled server-side');
}