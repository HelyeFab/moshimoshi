/**
 * Base Content Adapter
 * Abstract base class for all review content adapters
 */

import type { ReviewableContent } from '../core/interfaces';

export abstract class BaseContentAdapter<T = any> {
  abstract adapt(item: T): ReviewableContent;

  adaptBatch(items: T[]): ReviewableContent[] {
    return items.map(item => this.adapt(item));
  }
}