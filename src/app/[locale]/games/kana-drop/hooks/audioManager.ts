export class GameAudioManager {
  private audioContext: AudioContext | null = null;
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private backgroundMusic: HTMLAudioElement | null = null;
  private enabled: boolean = true;
  private currentCountdownSound: HTMLAudioElement | null = null; // Track countdown sound
  private currentlyPlayingSounds: Set<HTMLAudioElement> = new Set(); // Track all playing sounds

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.loadSounds();
    }
  }

  private loadSounds() {
    // Create separate instances for countdown and start sounds
    const soundPaths = {
      countdown: '/sounds/game-countdown-62-199828.mp3',
      start: '/sounds/game-countdown-62-199828.mp3', // Separate instance for start
      gameOver: '/sounds/game-over-38511.mp3',
      victory: '/sounds/game-over-38511.mp3', // Reuse game over for victory for now
      error: '/sounds/game-over-38511.mp3', // Reuse game over for errors for now
      thud: '/sounds/game-over-38511.mp3' // Reuse game over for thuds for now
    };

    // Create audio elements with service worker bypass
    Object.entries(soundPaths).forEach(([key, path]) => {
      const audio = new Audio();
      // Add cache-buster to bypass service worker issues
      audio.src = `${path}?t=${Date.now()}`;
      audio.crossOrigin = 'anonymous';
      audio.volume = 0.5;
      this.sounds[key] = audio;
    });

    // Load background music
    this.backgroundMusic = new Audio();
    this.backgroundMusic.src = `/sounds/game-music-loop-7-145285.mp3?t=${Date.now()}`;
    this.backgroundMusic.crossOrigin = 'anonymous';
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.3; // Lower volume for background music
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAllSounds();
      this.stopBackgroundMusic();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Stop all currently playing sounds
  // Fallback method to play audio via fetch
  private async playViaFetch(audioPath: string, originalAudio: HTMLAudioElement): Promise<void> {
    try {
      const response = await fetch(audioPath, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      // Update the original audio element's source
      originalAudio.src = audioUrl;
      await originalAudio.play();
      
      // Clean up blob URL when done
      originalAudio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
      }, { once: true });
    } catch (error) {
      console.error('[KanaDrop Audio] Fetch method failed:', error);
      throw error;
    }
  }

  stopAllSounds() {

    this.currentlyPlayingSounds.forEach(sound => {
      sound.pause();
      sound.currentTime = 0;
    });
    this.currentlyPlayingSounds.clear();
    this.currentCountdownSound = null;
  }

  // Stop the countdown sound specifically
  stopCountdownSound() {
    if (this.currentCountdownSound) {

      this.currentCountdownSound.pause();
      this.currentCountdownSound.currentTime = 0;
      this.currentlyPlayingSounds.delete(this.currentCountdownSound);
      this.currentCountdownSound = null;
    }
  }

  // Stop a specific sound type
  stopSound(soundType: 'error' | 'thud' | 'victory' | 'gameOver' | 'countdown' | 'start') {
    if (!this.sounds[soundType]) return;

    const sound = this.sounds[soundType];
    sound.pause();
    sound.currentTime = 0;
    this.currentlyPlayingSounds.delete(sound);

    // Clear countdown tracking if stopping countdown
    if (soundType === 'countdown') {
      this.currentCountdownSound = null;
    }
  }

  async playSound(soundType: 'error' | 'thud' | 'victory' | 'gameOver' | 'countdown' | 'start') {
    if (!this.enabled) return;
    if (!this.sounds[soundType]) return;

    try {

      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const sound = this.sounds[soundType];
      sound.currentTime = 0;
      
      // Try to play with error handling
      try {
        await sound.play();
      } catch (playError: any) {
        // If play fails due to service worker/network issue, try fetch method
        if (playError.name === 'NotAllowedError' || playError.name === 'AbortError') {

          await this.playViaFetch(sound.src.split('?')[0], sound);
        } else {
          throw playError;
        }
      }

      // Track this sound
      this.currentlyPlayingSounds.add(sound);

      // Track countdown sound specifically for stopping later
      if (soundType === 'countdown') {
        this.currentCountdownSound = sound;
      }

      // Auto-remove from tracking when sound ends
      sound.addEventListener('ended', () => {
        this.currentlyPlayingSounds.delete(sound);
        if (soundType === 'countdown') {
          this.currentCountdownSound = null;
        }
      }, { once: true });

    } catch (error) {
      console.error(`[KanaDrop Audio] Error playing ${soundType} sound:`, error);
    }
  }

  async playBackgroundMusic() {
    if (!this.enabled || !this.backgroundMusic) return;

    // Stop ALL sounds before starting background music
    this.stopAllSounds();

    try {

      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Try to play background music with fallback
      this.backgroundMusic.play().catch(async (error) => {
        if (error.name === 'NotAllowedError' || error.name === 'AbortError') {

          try {
            if (this.backgroundMusic) {
              await this.playViaFetch(this.backgroundMusic.src.split('?')[0], this.backgroundMusic);
            }
          } catch (fetchError) {
            console.error('[KanaDrop Audio] Failed to play background music:', fetchError);
          }
        } else {
          console.error('[KanaDrop Audio] Error playing background music:', error);
        }
      });
    } catch (error) {
      console.error('[KanaDrop Audio] Error playing background music:', error);
    }
  }

  stopBackgroundMusic() {
    if (this.backgroundMusic) {

      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
    }
  }

  dispose() {
    this.stopAllSounds();
    this.stopBackgroundMusic();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Singleton instance
let audioManagerInstance: GameAudioManager | null = null;

export function getGameAudioManager(): GameAudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new GameAudioManager();
  }
  return audioManagerInstance;
}