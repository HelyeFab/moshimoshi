import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { TranscriptLine } from '@/app/tools/youtube-shadowing/YouTubeShadowing';

interface UserEditedTranscript {
  id: string; // {userId}_{contentId}
  userId: string;
  contentId: string; // Same as in transcriptCache
  contentType: 'youtube' | 'audio' | 'video';
  videoUrl?: string;
  transcript: TranscriptLine[];
  originalTranscriptId?: string; // Reference to cached transcript
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: {
    videoTitle?: string;
    editsCount: number; // Track how many edits were made
  };
}

export class UserEditedTranscriptsManager {
  private static COLLECTION_NAME = 'userEditedTranscripts';

  /**
   * Generate a unique ID for user-edited transcript
   */
  static generateId(userId: string, contentId: string): string {
    return `${userId}_${contentId}`;
  }

  /**
   * Get user's edited transcript
   */
  static async getUserEditedTranscript(
    userId: string, 
    contentId: string
  ): Promise<UserEditedTranscript | null> {
    try {
      const docId = this.generateId(userId, contentId);
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docSnap.data() as UserEditedTranscript;
    } catch (error) {
      console.error('Error getting user edited transcript:', error);
      return null;
    }
  }

  /**
   * Save user's edited transcript
   */
  static async saveUserEditedTranscript(params: {
    userId: string;
    contentId: string;
    contentType: 'youtube' | 'audio' | 'video';
    videoUrl?: string;
    transcript: TranscriptLine[];
    originalTranscriptId?: string;
    videoTitle?: string;
  }): Promise<void> {
    try {
      const docId = this.generateId(params.userId, params.contentId);
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      
      // Check if document exists to determine if this is an update
      const existing = await getDoc(docRef);
      const isUpdate = existing.exists();
      const currentEditsCount = existing.data()?.metadata?.editsCount || 0;

      const data: Partial<UserEditedTranscript> = {
        id: docId,
        userId: params.userId,
        contentId: params.contentId,
        contentType: params.contentType,
        videoUrl: params.videoUrl,
        transcript: params.transcript,
        originalTranscriptId: params.originalTranscriptId,
        updatedAt: serverTimestamp() as Timestamp,
        metadata: {
          videoTitle: params.videoTitle,
          editsCount: currentEditsCount + 1
        }
      };

      if (!isUpdate) {
        data.createdAt = serverTimestamp() as Timestamp;
        await setDoc(docRef, data);
      } else {
        await updateDoc(docRef, data);
      }

    } catch (error) {
      console.error('Error saving user edited transcript:', error);
      throw error;
    }
  }

  /**
   * Delete user's edited transcript (reset to original)
   */
  static async deleteUserEditedTranscript(
    userId: string, 
    contentId: string
  ): Promise<void> {
    try {
      const docId = this.generateId(userId, contentId);
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      await deleteDoc(docRef);

    } catch (error) {
      console.error('Error deleting user edited transcript:', error);
      throw error;
    }
  }

  /**
   * Check if user has edited a transcript
   */
  static async hasUserEditedTranscript(
    userId: string, 
    contentId: string
  ): Promise<boolean> {
    try {
      const docId = this.generateId(userId, contentId);
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('Error checking user edited transcript:', error);
      return false;
    }
  }
}