/**
 * Base Content Adapter
 * Simple abstract base class for review content adapters
 *
 * Use this for simple adapters that just need adapt/transform.
 * For advanced features (options, hints, etc), use base.adapter.ts
 */

import type { ReviewableContent } from '../core/interfaces';

export abstract class BaseContentAdapter<T = any> {
  /**
   * Transform raw content into ReviewableContent
   * Subclasses must implement this method
   */
  abstract adapt(item: T): ReviewableContent;

  /**
   * Alias for adapt() - for compatibility with base.adapter.ts
   */
  transform(item: T): ReviewableContent {
    return this.adapt(item);
  }

  /**
   * Batch transform multiple items
   */
  adaptBatch(items: T[]): ReviewableContent[] {
    return items.map(item => this.adapt(item));
  }
}