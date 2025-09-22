import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Schema for IndexedDB Pokemon storage
interface PokemonDBSchema extends DBSchema {
  caughtPokemon: {
    key: string; // Composite key: userId:pokemonId
    value: {
      id: string; // Composite key: userId:pokemonId
      pokemonId: number;
      userId: string | null; // null for guest/anonymous users
      userEmail: string | null; // null for guest/anonymous users
      caughtAt: string; // ISO date string
      jlptLevel?: number; // Optional: from game context
      kanjiIds?: string[]; // Optional: kanji learned when caught
      source?: 'game' | 'reward' | 'achievement'; // How it was obtained
    };
    indexes: {
      'by-user': string; // userId for quick filtering
      'by-email': string; // userEmail for additional validation
      'by-pokemon': number; // pokemonId for checking if specific Pokemon caught
      'by-date': string; // caughtAt for sorting by catch date
    };
  };
}

class PokemonStorageManager {
  private db: IDBPDatabase<PokemonDBSchema> | null = null;
  private readonly DB_NAME = 'moshimoshi-pokemon';
  private readonly DB_VERSION = 1;

  async initDB(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<PokemonDBSchema>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Create the caughtPokemon store if it doesn't exist
          if (!db.objectStoreNames.contains('caughtPokemon')) {
            const store = db.createObjectStore('caughtPokemon', { keyPath: 'id' });

            // Create indexes for efficient querying
            store.createIndex('by-user', 'userId');
            store.createIndex('by-email', 'userEmail');
            store.createIndex('by-pokemon', 'pokemonId');
            store.createIndex('by-date', 'caughtAt');
          }
        },
      });
      // IndexedDB initialized successfully
    } catch (error) {
      console.error('[PokemonStorage] Failed to initialize IndexedDB:', error);
      this.db = null;
    }
  }

  // Save a caught Pokemon to local storage
  async savePokemonLocally(
    pokemonId: number,
    userId: string | null,
    userEmail: string | null,
    source: 'game' | 'reward' | 'achievement' = 'game',
    jlptLevel?: number,
    kanjiIds?: string[]
  ): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) {
        console.error('[PokemonStorage] Database not initialized');
        return;
      }

      // Create composite ID combining userId and pokemonId
      const compositeId = `${userId || 'guest'}:${pokemonId}`;

      // Check if already caught
      const existing = await this.db.get('caughtPokemon', compositeId);
      if (existing) {
        // Pokemon already caught by user
        return;
      }

      await this.db.put('caughtPokemon', {
        id: compositeId,
        pokemonId,
        userId,
        userEmail,
        caughtAt: new Date().toISOString(),
        source,
        jlptLevel,
        kanjiIds,
      });

      // Pokemon saved locally
    } catch (error) {
      console.error('[PokemonStorage] Failed to save Pokemon locally:', error);
    }
  }

  // Check if a specific Pokemon is caught by the user
  async isPokemonCaught(pokemonId: number, userId: string | null): Promise<boolean> {
    try {
      await this.initDB();
      if (!this.db) return false;

      const compositeId = `${userId || 'guest'}:${pokemonId}`;
      const pokemon = await this.db.get('caughtPokemon', compositeId);
      return !!pokemon;
    } catch (error) {
      console.error('[PokemonStorage] Failed to check Pokemon:', error);
      return false;
    }
  }

  // Get all caught Pokemon for a user
  async getAllCaughtPokemonLocally(userId: string | null, userEmail: string | null = null): Promise<number[]> {
    try {
      // Always return empty for no userId (guest users don't persist)
      if (!userId) {
        return [];
      }

      await this.initDB();
      if (!this.db) {
        console.error('[PokemonStorage] Database not initialized');
        return [];
      }

      // Get all Pokemon for this user
      const userPokemon = await this.db.getAllFromIndex('caughtPokemon', 'by-user', userId);

      // If email is provided, double-check for security
      if (userEmail) {
        return userPokemon
          .filter(p => p.userEmail === userEmail)
          .map(p => p.pokemonId)
          .sort((a, b) => a - b);
      }

      return userPokemon
        .map(p => p.pokemonId)
        .sort((a, b) => a - b);
    } catch (error) {
      console.error('[PokemonStorage] Failed to get caught Pokemon:', error);
      return [];
    }
  }

  // Get detailed Pokemon data for a user
  async getCaughtPokemonDetails(userId: string | null) {
    try {
      if (!userId) return [];

      await this.initDB();
      if (!this.db) return [];

      const userPokemon = await this.db.getAllFromIndex('caughtPokemon', 'by-user', userId);
      return userPokemon.sort((a, b) =>
        new Date(b.caughtAt).getTime() - new Date(a.caughtAt).getTime()
      );
    } catch (error) {
      console.error('[PokemonStorage] Failed to get Pokemon details:', error);
      return [];
    }
  }

  // Sync Pokemon from cloud (for premium users)
  async syncFromCloud(cloudPokemonIds: number[], userId: string, userEmail: string): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      // Get current local Pokemon for this user
      const localPokemon = await this.getAllCaughtPokemonLocally(userId, userEmail);
      const localSet = new Set(localPokemon);

      // Add cloud Pokemon that aren't in local storage
      for (const pokemonId of cloudPokemonIds) {
        if (!localSet.has(pokemonId)) {
          await this.savePokemonLocally(pokemonId, userId, userEmail, 'game');
        }
      }

      // Synced Pokemon from cloud
    } catch (error) {
      console.error('[PokemonStorage] Failed to sync from cloud:', error);
    }
  }

  // Get merged list of local and cloud Pokemon
  async getMergedPokemonList(cloudPokemonIds: number[], userId: string, userEmail: string): Promise<number[]> {
    try {
      await this.initDB();

      const localPokemon = await this.getAllCaughtPokemonLocally(userId, userEmail);
      const mergedSet = new Set([...localPokemon, ...cloudPokemonIds]);
      return Array.from(mergedSet).sort((a, b) => a - b);
    } catch (error) {
      console.error('[PokemonStorage] Failed to merge Pokemon lists:', error);
      return cloudPokemonIds; // Fallback to cloud data
    }
  }

  // Clear all Pokemon for a specific user (e.g., on logout)
  async clearUserPokemon(userId: string): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      // Get all Pokemon for this user
      const userPokemon = await this.db.getAllFromIndex('caughtPokemon', 'by-user', userId);

      // Delete each one
      const tx = this.db.transaction('caughtPokemon', 'readwrite');
      for (const pokemon of userPokemon) {
        await tx.store.delete(pokemon.id);
      }
      await tx.done;

      // Cleared Pokemon for user
    } catch (error) {
      console.error('[PokemonStorage] Failed to clear user Pokemon:', error);
    }
  }

  // Clear all Pokemon storage (for development/testing)
  async clearAllStorage(): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      const tx = this.db.transaction('caughtPokemon', 'readwrite');
      await tx.objectStore('caughtPokemon').clear();
      await tx.done;

      // Cleared all Pokemon storage
    } catch (error) {
      console.error('[PokemonStorage] Failed to clear storage:', error);
    }
  }

  // Get Pokemon statistics for a user
  async getPokemonStats(userId: string | null) {
    try {
      if (!userId) return { total: 0, byRarity: {}, recentCatches: [] };

      const details = await this.getCaughtPokemonDetails(userId);

      // Count by rarity (would need to import getPokemonRarity from pokemonData)
      const byRarity = {
        common: 0,
        uncommon: 0,
        rare: 0,
        legendary: 0,
        mythical: 0
      };

      // Get recent catches (last 5)
      const recentCatches = details
        .slice(0, 5)
        .map(p => ({
          pokemonId: p.pokemonId,
          caughtAt: p.caughtAt,
          source: p.source
        }));

      return {
        total: details.length,
        byRarity,
        recentCatches
      };
    } catch (error) {
      console.error('[PokemonStorage] Failed to get stats:', error);
      return { total: 0, byRarity: {}, recentCatches: [] };
    }
  }
}

// Export singleton instance
export const pokemonStorage = new PokemonStorageManager();