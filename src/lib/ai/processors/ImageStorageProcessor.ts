/**
 * Image Storage Processor
 * Handles storing temporary images to Firebase Storage with signed URLs
 */

import { BaseProcessor } from './BaseProcessor';
import {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  AIServiceError,
  ImageStorageRequest,
  StoredImage
} from '../types';
import { adminStorage } from '@/lib/firebase/admin';

export class ImageStorageProcessor extends BaseProcessor<ImageStorageRequest, StoredImage> {
  constructor(context: ProcessorContext) {
    super(context);

    if (!adminStorage) {
      throw new AIServiceError(
        'Firebase Admin Storage not initialized',
        'STORAGE_NOT_INITIALIZED',
        500
      );
    }
  }

  /**
   * Process image storage request
   */
  async process(
    request: ImageStorageRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<StoredImage>> {
    this.validateRequest(request);

    try {
      // Download the image from URL
      const imageResponse = await fetch(request.imageUrl);
      if (!imageResponse.ok) {
        throw new AIServiceError(
          `Failed to download image: ${imageResponse.statusText}`,
          'IMAGE_DOWNLOAD_FAILED',
          500
        );
      }

      // Get the image as a buffer
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Get Firebase Storage bucket
      const bucket = adminStorage!.bucket();

      // Create a file reference
      const file = bucket.file(request.storagePath);

      // Prepare metadata
      const metadata: any = {
        contentType: imageResponse.headers.get('content-type') || 'image/jpeg',
        metadata: {
          ...request.metadata,
          uploadedAt: new Date().toISOString(),
          originalUrl: request.imageUrl
        }
      };

      // Upload the buffer
      await file.save(buffer, metadata);

      console.log(`✅ Image stored at: ${request.storagePath}`);

      // Generate a signed URL that expires in 10 years (effectively permanent)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
      });

      const result: StoredImage = {
        url: signedUrl,
        path: request.storagePath,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString(),
        metadata: request.metadata
      };

      return {
        data: result,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: 0 // Storage costs are negligible
        },
        metadata: {
          storagePath: request.storagePath,
          size: buffer.length
        }
      };

    } catch (error: any) {
      console.error('Image storage error:', error);

      if (error instanceof AIServiceError) {
        throw error;
      }

      throw new AIServiceError(
        `Image storage failed: ${error.message}`,
        'IMAGE_STORAGE_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Validate request
   */
  validateRequest(request: ImageStorageRequest): void {
    if (!request.imageUrl || !request.imageUrl.startsWith('http')) {
      throw new AIServiceError(
        'Valid image URL is required',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!request.storagePath || request.storagePath.trim().length === 0) {
      throw new AIServiceError(
        'Storage path is required',
        'VALIDATION_ERROR',
        400
      );
    }

    // Validate storage path format
    if (request.storagePath.includes('..') || request.storagePath.startsWith('/')) {
      throw new AIServiceError(
        'Invalid storage path format',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Delete stored image
   */
  async deleteImage(storagePath: string): Promise<void> {
    try {
      const bucket = adminStorage!.bucket();
      const file = bucket.file(storagePath);
      await file.delete();
      console.log(`🗑️ Image deleted: ${storagePath}`);
    } catch (error: any) {
      console.error('Image deletion error:', error);
      throw new AIServiceError(
        `Image deletion failed: ${error.message}`,
        'IMAGE_DELETION_FAILED',
        500
      );
    }
  }

  /**
   * Check if image exists
   */
  async imageExists(storagePath: string): Promise<boolean> {
    try {
      const bucket = adminStorage!.bucket();
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error: any) {
      console.error('Image existence check error:', error);
      return false;
    }
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(storagePath: string): Promise<any> {
    try {
      const bucket = adminStorage!.bucket();
      const file = bucket.file(storagePath);
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error: any) {
      console.error('Image metadata retrieval error:', error);
      throw new AIServiceError(
        `Failed to get image metadata: ${error.message}`,
        'METADATA_RETRIEVAL_FAILED',
        500
      );
    }
  }

  /**
   * Required by BaseProcessor - not used for storage
   */
  getSystemPrompt(config?: TaskConfig): string {
    return '';
  }

  /**
   * Required by BaseProcessor - not used for storage
   */
  getUserPrompt(request: ImageStorageRequest, config?: TaskConfig): string {
    return '';
  }

  /**
   * Required by BaseProcessor - not used for storage
   */
  parseResponse(response: string): StoredImage {
    throw new Error('parseResponse not used for image storage');
  }
}