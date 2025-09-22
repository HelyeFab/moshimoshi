import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, getFirestore } from 'firebase/firestore';
import { db as configDb, app } from '@/lib/firebase/config';
import { pokemonStorage } from './pokemonStorage';
import { User } from 'firebase/auth';
import logger from '@/lib/logger';

interface PokemonCatch {
  pokemonId: number;
  caughtAt: string;
  jlptLevel?: number;
  kanjiIds?: string[];
  source?: 'game' | 'reward' | 'achievement';
}

interface UserPokedex {
  userId: string;
  caught: number[];
  lastCaught?: {
    id: number;
    date: string;
  };
  totalCaught: number;
  catchHistory?: PokemonCatch[];
  updatedAt: string;
}

class PokemonManager {
  private readonly COLLECTION_NAME = 'pokemon';
  private db: any = null;

  // Get Firestore instance (lazy initialization)
  private getDb() {
    if (!this.db) {
      if (typeof window !== 'undefined' && app) {
        this.db = getFirestore(app);
        console.log('[PokemonManager] Firestore initialized');
      } else if (configDb) {
        this.db = configDb;
        console.log('[PokemonManager] Using config db');
      }
    }
    return this.db;
  }

  // Save caught Pokemon based on user subscription status
  async saveCaughtPokemon(
    pokemonId: number,
    user: User | null,
    isPremium: boolean,
    source: 'game' | 'reward' | 'achievement' = 'game',
    jlptLevel?: number,
    kanjiIds?: string[]
  ): Promise<void> {
    // Saving Pokemon for user

    const catchData: PokemonCatch = {
      pokemonId,
      caughtAt: new Date().toISOString(),
      source,
      jlptLevel,
      kanjiIds,
    };

    // Get user identification
    const userId = user?.uid || null;
    const userEmail = user?.email || null;

    // Always save to localStorage for offline access
    await pokemonStorage.savePokemonLocally(pokemonId, userId, userEmail, source, jlptLevel, kanjiIds);

    // For premium users, also save to Firebase
    if (user && isPremium) {
      // User is premium, saving to Firebase
      await this.savePokemonToCloud(user.uid, userEmail, pokemonId, catchData);
    } else {
      // User is not premium or not logged in, skipping Firebase save
    }
  }

  // Save Pokemon to Firebase
  private async savePokemonToCloud(
    userId: string,
    userEmail: string | null,
    pokemonId: number,
    catchData: PokemonCatch
  ): Promise<void> {
    // Saving Pokemon to cloud

    const db = this.getDb();
    if (!db) {
      console.error('[PokemonManager] Firestore not initialized, cannot save to cloud');
      return;
    }

    try {
      const userPokedexRef = doc(db, this.COLLECTION_NAME, userId);
      const userPokedexDoc = await getDoc(userPokedexRef);

      if (userPokedexDoc.exists()) {
        // Update existing document
        const currentData = userPokedexDoc.data() as UserPokedex;
        const currentCaught = currentData.caught || [];
        const catchHistory = currentData.catchHistory || [];

        // Only add if not already caught
        if (!currentCaught.includes(pokemonId)) {
          currentCaught.push(pokemonId);
          catchHistory.push(catchData);

          const updateData: Partial<UserPokedex> = {
            caught: currentCaught,
            lastCaught: {
              id: pokemonId,
              date: catchData.caughtAt,
            },
            totalCaught: currentCaught.length,
            catchHistory,
            updatedAt: new Date().toISOString(),
          };

          await updateDoc(userPokedexRef, updateData);
          // Successfully updated Firebase with Pokemon
        } else {
          // Pokemon already in cloud collection
        }
      } else {
        // Create new document
        const newPokedex: UserPokedex = {
          userId,
          caught: [pokemonId],
          lastCaught: {
            id: pokemonId,
            date: catchData.caughtAt,
          },
          totalCaught: 1,
          catchHistory: [catchData],
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userPokedexRef, newPokedex);
        // Created new pokedex document
      }
    } catch (error) {
      console.error('[PokemonManager] Failed to save Pokemon to cloud:', error);
      // Don't throw - local storage should still work
    }
  }

  // Get all caught Pokemon (merge local and cloud data)
  async getCaughtPokemon(user: User | null, isPremium: boolean): Promise<number[]> {
    console.log('[PokemonManager] getCaughtPokemon called with:', {
      user: user ? { uid: user.uid, email: user.email } : null,
      isPremium
    });

    try {
      // Always return empty for no user (guests don't persist)
      if (!user) {
        console.log('[PokemonManager] No user, returning empty array');
        return [];
      }

      const userId = user.uid;
      const userEmail = user.email;

      console.log('[PokemonManager] Attempting to fetch from cloud for userId:', userId);

      // For now, always try to fetch from cloud regardless of premium status for debugging
      const cloudPokemonIds = await this.getPokemonFromCloud(userId);
      console.log('[PokemonManager] Cloud Pokemon IDs loaded:', cloudPokemonIds);

      if (cloudPokemonIds.length > 0) {
        // Sync to local for offline use
        await pokemonStorage.syncFromCloud(cloudPokemonIds, userId, userEmail || '');
        return cloudPokemonIds;
      }

      // Fallback to local
      console.log('[PokemonManager] No cloud data, checking local storage');
      const localPokemon = await pokemonStorage.getAllCaughtPokemonLocally(userId, userEmail);
      console.log('[PokemonManager] Local Pokemon loaded:', localPokemon);
      return localPokemon;
    } catch (error) {
      console.error('[PokemonManager] Error getting caught Pokemon:', error);
      return [];
    }
  }

  // Get Pokemon from Firebase
  private async getPokemonFromCloud(userId: string): Promise<number[]> {
    try {
      console.log('[PokemonManager] getPokemonFromCloud - Fetching for userId:', userId);

      const db = this.getDb();
      if (!db) {
        console.error('[PokemonManager] Firestore not initialized - db is:', db);
        return [];
      }

      console.log('[PokemonManager] Firestore is initialized, getting doc reference');
      const userPokedexRef = doc(db, this.COLLECTION_NAME, userId);
      console.log('[PokemonManager] Fetching document from collection:', this.COLLECTION_NAME, 'for userId:', userId);

      const userPokedexDoc = await getDoc(userPokedexRef);
      console.log('[PokemonManager] Document fetched. Exists:', userPokedexDoc.exists());

      if (userPokedexDoc.exists()) {
        const data = userPokedexDoc.data() as UserPokedex;
        console.log('[PokemonManager] Found Firebase data:', data);
        const caught = data.caught || [];
        console.log('[PokemonManager] Returning', caught.length, 'Pokemon:', caught);
        return caught;
      }

      console.log('[PokemonManager] No Firebase document found for userId:', userId);
      return [];
    } catch (error: any) {
      // Check if it's a permission error - this is expected for new users or users without Pokemon
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        // This is normal - user hasn't caught any Pokemon yet or doesn't have permission
        // No need to log an error for this expected case
        return [];
      }

      // Only log actual unexpected errors
      console.error('[PokemonManager] Failed to get Pokemon from cloud:', error);
      return [];
    }
  }

  // Check if a specific Pokemon is caught
  async isPokemonCaught(
    pokemonId: number,
    user: User | null,
    isPremium: boolean
  ): Promise<boolean> {
    const caughtPokemon = await this.getCaughtPokemon(user, isPremium);
    return caughtPokemon.includes(pokemonId);
  }

  // Get Pokedex stats
  async getPokedexStats(user: User | null, isPremium: boolean): Promise<{
    totalCaught: number;
    lastCaught?: { id: number; date: string };
    byRarity?: Record<string, number>;
  }> {
    const caughtPokemon = await this.getCaughtPokemon(user, isPremium);

    if (!user || !isPremium) {
      // For free users, just return count
      return {
        totalCaught: caughtPokemon.length,
      };
    }

    // For premium users, try to get additional stats from cloud
    try {
      const userPokedexRef = doc(db, this.COLLECTION_NAME, user.uid);
      const userPokedexDoc = await getDoc(userPokedexRef);

      if (userPokedexDoc.exists()) {
        const pokedexData = userPokedexDoc.data() as UserPokedex;

        // Calculate rarity distribution
        const byRarity: Record<string, number> = {
          common: 0,
          uncommon: 0,
          rare: 0,
          legendary: 0,
          mythical: 0,
        };

        // This would need getPokemonRarity imported from pokemonData
        // For now, returning empty rarity stats

        return {
          totalCaught: caughtPokemon.length,
          lastCaught: pokedexData.lastCaught,
          byRarity,
        };
      }
    } catch (error) {
      console.error('[PokemonManager] Failed to get Pokedex stats from cloud:', error);
    }

    return {
      totalCaught: caughtPokemon.length,
    };
  }

  // Clear local storage (for logout)
  async clearLocalStorage(userId?: string): Promise<void> {
    if (userId) {
      await pokemonStorage.clearUserPokemon(userId);
    }
  }

  // Force sync all local Pokemon to cloud (for premium upgrade)
  async forceSyncToCloud(user: User): Promise<void> {
    logger.pokemon('Force sync to cloud started');

    try {
      const userId = user.uid;
      const userEmail = user.email;

      if (!userId || !userEmail) {
        console.error('[PokemonManager] Cannot sync without complete user identification');
        return;
      }

      // Get all local Pokemon
      const localPokemon = await pokemonStorage.getAllCaughtPokemonLocally(userId, userEmail);

      logger.pokemon(`Force sync - ${localPokemon.length} Pokemon to sync`);

      if (localPokemon.length > 0) {
        const userPokedexRef = doc(db, this.COLLECTION_NAME, userId);

        const updateData: UserPokedex = {
          userId,
          caught: localPokemon,
          lastCaught: {
            id: localPokemon[localPokemon.length - 1],
            date: new Date().toISOString(),
          },
          totalCaught: localPokemon.length,
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userPokedexRef, updateData, { merge: true });
        logger.pokemon(`Force sync completed - ${localPokemon.length} Pokemon synced`);
      }
    } catch (error) {
      console.error('[PokemonManager] Force sync failed:', error);
      throw error;
    }
  }

  // Get global Pokemon statistics (for leaderboards, etc.)
  async getGlobalStats(): Promise<{
    mostCaught: number[];
    totalUsers: number;
  }> {
    try {
      const pokemonCollection = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(pokemonCollection);

      const pokemonCounts = new Map<number, number>();
      let totalUsers = 0;

      snapshot.forEach((doc) => {
        totalUsers++;
        const data = doc.data() as UserPokedex;
        (data.caught || []).forEach((pokemonId) => {
          pokemonCounts.set(pokemonId, (pokemonCounts.get(pokemonId) || 0) + 1);
        });
      });

      // Get top 10 most caught Pokemon
      const mostCaught = Array.from(pokemonCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pokemonId]) => pokemonId);

      return {
        mostCaught,
        totalUsers,
      };
    } catch (error) {
      console.error('[PokemonManager] Failed to get global stats:', error);
      return {
        mostCaught: [],
        totalUsers: 0,
      };
    }
  }

  // Event emitter for Pokemon catch events (for UI updates)
  private catchListeners: Array<(pokemonId: number) => void> = [];

  onPokemonCaught(callback: (pokemonId: number) => void): () => void {
    this.catchListeners.push(callback);
    return () => {
      this.catchListeners = this.catchListeners.filter(cb => cb !== callback);
    };
  }

  private emitCatchEvent(pokemonId: number): void {
    this.catchListeners.forEach(callback => callback(pokemonId));
  }

  // Wrapper for catching Pokemon with event emission
  async catchPokemon(
    pokemonId: number,
    user: User | null,
    isPremium: boolean,
    source: 'game' | 'reward' | 'achievement' = 'game',
    jlptLevel?: number,
    kanjiIds?: string[]
  ): Promise<void> {
    await this.saveCaughtPokemon(pokemonId, user, isPremium, source, jlptLevel, kanjiIds);
    this.emitCatchEvent(pokemonId);
  }
}

// Export singleton instance
export const pokemonManager = new PokemonManager();