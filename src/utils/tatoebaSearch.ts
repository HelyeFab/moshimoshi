// Tatoeba example sentences search utility

export interface ExampleSentence {
  id: string;
  japanese: string;
  english: string | null;
}

export interface TatoebaMetadata {
  totalExamples: number;
  totalChunks: number;
  totalWords: number;
  totalIndexChunks: number;
  chunkSize: number;
  indexChunkSize: number;
  createdAt: string;
}

class TatoebaSearcher {
  private metadata: TatoebaMetadata | null = null;
  private loadedIndexChunks: Map<number, any> = new Map();
  private loadedExampleChunks: Map<number, ExampleSentence[]> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  async initialize() {
    if (this.metadata) return;

    try {
      const response = await fetch('/data/tatoeba/metadata.json');
      this.metadata = await response.json();
    } catch (error) {
      console.error('Failed to load Tatoeba metadata:', error);
      throw new Error('Tatoeba data not available');
    }
  }

  private async loadIndexChunk(chunkIndex: number): Promise<any> {
    const cacheKey = `index-${chunkIndex}`;

    // Return if already loaded
    if (this.loadedIndexChunks.has(chunkIndex)) {
      return this.loadedIndexChunks.get(chunkIndex);
    }

    // Return existing promise if loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Start loading
    const loadPromise = fetch(`/data/tatoeba/index-${chunkIndex}.json`)
      .then(res => res.json())
      .then(data => {
        this.loadedIndexChunks.set(chunkIndex, data);
        this.loadingPromises.delete(cacheKey);
        return data;
      })
      .catch(err => {
        this.loadingPromises.delete(cacheKey);
        throw err;
      });

    this.loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  private async loadExampleChunk(chunkIndex: number): Promise<ExampleSentence[]> {
    const cacheKey = `examples-${chunkIndex}`;

    // Return if already loaded
    if (this.loadedExampleChunks.has(chunkIndex)) {
      return this.loadedExampleChunks.get(chunkIndex)!;
    }

    // Return existing promise if loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Start loading
    const loadPromise = fetch(`/data/tatoeba/examples-${chunkIndex}.json`)
      .then(res => res.json())
      .then(data => {
        this.loadedExampleChunks.set(chunkIndex, data);
        this.loadingPromises.delete(cacheKey);
        return data;
      })
      .catch(err => {
        this.loadingPromises.delete(cacheKey);
        throw err;
      });

    this.loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  private calculateExampleChunkIndex(exampleIndex: number): number {
    if (!this.metadata) return 0;
    return Math.floor(exampleIndex / this.metadata.chunkSize);
  }

  private calculateExampleLocalIndex(exampleIndex: number): number {
    if (!this.metadata) return 0;
    return exampleIndex % this.metadata.chunkSize;
  }

  async searchExamples(word: string, limit: number = 5): Promise<ExampleSentence[]> {
    await this.initialize();

    if (!this.metadata) {
      return [];
    }

    const examples: ExampleSentence[] = [];
    const seenIds = new Set<string>();

    // Search through index chunks
    for (let i = 0; i < this.metadata.totalIndexChunks && examples.length < limit; i++) {
      try {
        const indexChunk = await this.loadIndexChunk(i);

        // Direct word lookup
        if (indexChunk[word]) {
          const exampleIndices = indexChunk[word];

          // Load the corresponding example chunks
          for (const exampleIndex of exampleIndices) {
            if (examples.length >= limit) break;

            const chunkIndex = this.calculateExampleChunkIndex(exampleIndex);
            const localIndex = this.calculateExampleLocalIndex(exampleIndex);

            try {
              const exampleChunk = await this.loadExampleChunk(chunkIndex);
              const example = exampleChunk[localIndex];

              if (example && !seenIds.has(example.id)) {
                examples.push(example);
                seenIds.add(example.id);
              }
            } catch (err) {
              console.error(`Failed to load example chunk ${chunkIndex}:`, err);
            }
          }
        }

      } catch (error) {
        console.error(`Failed to load index chunk ${i}:`, error);
      }
    }

    return examples;
  }

  // Search for multiple words at once (batch search)
  async batchSearchExamples(words: string[], limitPerWord: number = 3): Promise<Map<string, ExampleSentence[]>> {
    await this.initialize();

    const results = new Map<string, ExampleSentence[]>();
    const wordSeenIds = new Map<string, Set<string>>();

    // Initialize results map
    words.forEach(word => {
      results.set(word, []);
      wordSeenIds.set(word, new Set());
    });

    if (!this.metadata) {
      return results;
    }

    // Load and search index chunks
    for (let i = 0; i < this.metadata.totalIndexChunks; i++) {
      try {
        const indexChunk = await this.loadIndexChunk(i);

        // Search for each word in the chunk
        for (const searchWord of words) {
          const currentExamples = results.get(searchWord) || [];
          const seenIds = wordSeenIds.get(searchWord)!;

          if (currentExamples.length < limitPerWord && indexChunk[searchWord]) {
            const exampleIndices = indexChunk[searchWord];

            for (const exampleIndex of exampleIndices) {
              if (currentExamples.length >= limitPerWord) break;

              const chunkIndex = this.calculateExampleChunkIndex(exampleIndex);
              const localIndex = this.calculateExampleLocalIndex(exampleIndex);

              try {
                const exampleChunk = await this.loadExampleChunk(chunkIndex);
                const example = exampleChunk[localIndex];

                if (example && !seenIds.has(example.id)) {
                  currentExamples.push(example);
                  seenIds.add(example.id);
                  results.set(searchWord, currentExamples);
                }
              } catch (err) {
                console.error(`Failed to load example chunk ${chunkIndex}:`, err);
              }
            }
          }
        }

        // Check if all words have enough examples
        const allWordsSatisfied = Array.from(results.entries())
          .every(([word, examples]) => examples.length >= limitPerWord);

        if (allWordsSatisfied) break;

      } catch (error) {
        console.error(`Failed to load index chunk ${i}:`, error);
      }
    }

    return results;
  }

  // Clear cache to free memory
  clearCache() {
    this.loadedIndexChunks.clear();
    this.loadedExampleChunks.clear();
  }

  // Get metadata
  getMetadata(): TatoebaMetadata | null {
    return this.metadata;
  }
}

// Export singleton instance
export const tatoebaSearcher = new TatoebaSearcher();

// Convenience functions
export async function searchTatoebaExamples(word: string, limit?: number): Promise<ExampleSentence[]> {
  return tatoebaSearcher.searchExamples(word, limit);
}

export async function batchSearchTatoebaExamples(words: string[], limitPerWord?: number): Promise<Map<string, ExampleSentence[]>> {
  return tatoebaSearcher.batchSearchExamples(words, limitPerWord);
}