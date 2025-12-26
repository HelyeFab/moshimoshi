// Client-side resource service - uses API routes, NO direct Firestore access

import { ResourcePost, ResourceFormData } from '@/types/resources';

// Create a new resource
export async function saveResource(resource: ResourceFormData): Promise<string> {
  try {
    const response = await fetch('/api/admin/resources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(resource),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save resource');
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error saving resource:', error);
    throw error;
  }
}

// Update an existing resource
export async function updateResource(id: string, resource: ResourceFormData): Promise<void> {
  try {
    const response = await fetch(`/api/admin/resources/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(resource),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update resource');
    }
  } catch (error) {
    console.error('Error updating resource:', error);
    throw error;
  }
}

// Get a single resource by ID
export async function getResourceById(id: string): Promise<ResourcePost | null> {
  try {
    const response = await fetch(`/api/admin/resources/${id}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch resource');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching resource by ID:', error);
    throw error;
  }
}

// Delete a resource
export async function deleteResource(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/admin/resources/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete resource');
    }
  } catch (error) {
    console.error('Error deleting resource:', error);
    throw error;
  }
}
