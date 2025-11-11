import { useEffect, useRef, useState } from 'react';

export interface GameSounds {
  countdown: string;
  start: string;
  correct: string;
  wrong: string;
  distractor: string;
  gameOver: string;
  victory: string;
  background: string;
}

const SOUND_PATHS: GameSounds = {
  countdown: '/sounds/countdown.mp3',
  start: '/sounds/start.mp3',
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  distractor: '/sounds/thud.mp3',
  gameOver: '/sounds/game-over.mp3',
  victory: '/sounds/victory.mp3',
  background: '/sounds/background-music.mp3',
};

export function useAudioManager() {
  const [enabled, setEnabled] = useState(true);
  const soundsRef = useRef<{ [key: string]: HTMLAudioElement }>({});
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    // Create sound effects
    Object.entries(SOUND_PATHS).forEach(([key, path]) => {
      if (key !== 'background') {
        const audio = new Audio(path);
        audio.volume = 0.5;
        soundsRef.current[key] = audio;
      }
    });

    // Create background music
    const bgMusic = new Audio(SOUND_PATHS.background);
    bgMusic.loop = true;
    bgMusic.volume = 0.3;
    backgroundMusicRef.current = bgMusic;

    // Cleanup on unmount
    return () => {
      stopAllSounds();
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
    };
  }, []);

  const playSound = async (soundName: keyof GameSounds) => {
    if (!enabled || soundName === 'background') return;

    try {
      const sound = soundsRef.current[soundName];
      if (sound) {
        sound.currentTime = 0;
        await sound.play();
      }
    } catch (error) {
      // Silently fail if audio playback is blocked
      console.warn(`Could not play sound: ${soundName}`, error);
    }
  };

  const playBackgroundMusic = async () => {
    if (!enabled || !backgroundMusicRef.current) return;

    try {
      await backgroundMusicRef.current.play();
    } catch (error) {
      console.warn('Could not play background music', error);
    }
  };

  const stopBackgroundMusic = () => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
  };

  const stopAllSounds = () => {
    Object.values(soundsRef.current).forEach(sound => {
      sound.pause();
      sound.currentTime = 0;
    });
  };

  const toggleSound = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);

    if (!newEnabled) {
      stopAllSounds();
      stopBackgroundMusic();
    }

    return newEnabled;
  };

  return {
    enabled,
    playSound,
    playBackgroundMusic,
    stopBackgroundMusic,
    stopAllSounds,
    toggleSound,
    setEnabled,
  };
}