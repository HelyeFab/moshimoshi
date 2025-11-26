/**
 * News Audio Generator - TTS utility for news article scraping
 * Generates audio using Kokoro TTS API and stores in Firebase Storage
 */

import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { defineSecret } from 'firebase-functions/params';

// TTS API configuration
const KOKORO_TTS_ENDPOINT = 'https://api.selfmind.dev/kokoro/v1/audio/speech';
const EDGE_TTS_ENDPOINT = 'https://tts.selfmind.dev/speak';
const KOKORO_API_KEY = defineSecret('KOKORO_API_KEY');

// Kokoro voices (10-30x faster, higher quality)
const DEFAULT_KOKORO_VOICE = 'jf_alpha'; // Female Japanese voice
const DEFAULT_EDGE_VOICE = 'ja-JP-NanamiNeural'; // Fallback voice

const MAX_TEXT_LENGTH = 5000; // TTS limit

export type AudioType = 'title' | 'summary' | 'content';
export type TTSProvider = 'edge-tts' | 'kokoro';

export interface AudioGenerationOptions {
  voice?: string;
  provider?: TTSProvider;
  rate?: string; // e.g., "+0%", "+10%", "-10%"
  volume?: string; // e.g., "+0%", "+10%"
  pitch?: string; // e.g., "+0Hz", "+50Hz"
}

export interface AudioGenerationResult {
  url: string;
  provider: TTSProvider;
  voice: string;
  generatedAt: Date;
  textLength: number;
  audioType: AudioType;
}

/**
 * Generate audio for news article using Edge-TTS
 *
 * @param text - Text to convert to speech (max 5000 chars)
 * @param articleId - Unique article identifier
 * @param source - News source (e.g., 'nhk-easy', 'watanoc')
 * @param audioType - Type of audio (title, summary, content)
 * @param options - Optional TTS configuration
 * @returns Public URL of generated audio file
 */
export async function generateNewsAudio(
  text: string,
  articleId: string,
  source: string,
  audioType: AudioType,
  options: AudioGenerationOptions = {}
): Promise<AudioGenerationResult> {
  // Validate text length
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  if (text.length > MAX_TEXT_LENGTH) {
    logger.warn('Text exceeds max length, truncating', {
      originalLength: text.length,
      maxLength: MAX_TEXT_LENGTH,
      articleId
    });
    text = text.substring(0, MAX_TEXT_LENGTH);
  }

  const provider = options.provider || 'kokoro';
  const voice = options.voice || (provider === 'kokoro' ? DEFAULT_KOKORO_VOICE : DEFAULT_EDGE_VOICE);

  logger.info('Generating audio', {
    articleId,
    source,
    audioType,
    textLength: text.length,
    voice,
    provider
  });

  try {
    // Step 1: Generate audio with selected TTS provider
    const audioBuffer = provider === 'kokoro'
      ? await callKokoroTTS(text, voice)
      : await callEdgeTTS(text, {
          voice,
          rate: options.rate || '+0%',
          volume: options.volume || '+0%',
          pitch: options.pitch || '+0Hz'
        });

    // Step 2: Upload to Firebase Storage
    const storagePath = `news-audio/${source}/${articleId}/${audioType}.mp3`;
    const publicUrl = await uploadToFirebaseStorage(
      audioBuffer,
      storagePath,
      {
        articleId,
        source,
        provider,
        voice,
        textLength: text.length,
        audioType
      }
    );

    logger.info('Audio generated successfully', {
      articleId,
      audioType,
      url: publicUrl
    });

    return {
      url: publicUrl,
      provider,
      voice,
      generatedAt: new Date(),
      textLength: text.length,
      audioType
    };

  } catch (error) {
    logger.error('Failed to generate audio', {
      articleId,
      audioType,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Call Kokoro TTS API to generate audio (10-30x faster than Edge-TTS)
 */
async function callKokoroTTS(
  text: string,
  voice: string
): Promise<Buffer> {
  const startTime = Date.now();

  try {
    const response = await fetch(KOKORO_TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': KOKORO_API_KEY.value().trim()
      },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 1.0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kokoro TTS API error (${response.status}): ${errorText}`);
    }

    const audioBuffer = await response.buffer();
    const duration = Date.now() - startTime;

    logger.debug('Kokoro TTS API call successful', {
      textLength: text.length,
      audioSize: audioBuffer.length,
      durationMs: duration
    });

    return audioBuffer;

  } catch (error) {
    logger.error('Kokoro TTS API call failed', {
      endpoint: KOKORO_TTS_ENDPOINT,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call Edge-TTS API to generate audio (fallback option)
 */
async function callEdgeTTS(
  text: string,
  options: {
    voice: string;
    rate: string;
    volume: string;
    pitch: string;
  }
): Promise<Buffer> {
  const startTime = Date.now();

  try {
    const response = await fetch(EDGE_TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice: options.voice,
        rate: options.rate,
        volume: options.volume,
        pitch: options.pitch
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge-TTS API error (${response.status}): ${errorText}`);
    }

    const audioBuffer = await response.buffer();
    const duration = Date.now() - startTime;

    logger.debug('Edge-TTS API call successful', {
      textLength: text.length,
      audioSize: audioBuffer.length,
      durationMs: duration
    });

    return audioBuffer;

  } catch (error) {
    logger.error('Edge-TTS API call failed', {
      endpoint: EDGE_TTS_ENDPOINT,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload audio buffer to Firebase Storage
 */
async function uploadToFirebaseStorage(
  audioBuffer: Buffer,
  storagePath: string,
  metadata: {
    articleId: string;
    source: string;
    provider: TTSProvider;
    voice: string;
    textLength: number;
    audioType: AudioType;
  }
): Promise<string> {
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    // Upload file with metadata
    await file.save(audioBuffer, {
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000', // 1 year
        metadata: {
          articleId: metadata.articleId,
          source: metadata.source,
          provider: metadata.provider,
          voice: metadata.voice,
          textLength: metadata.textLength.toString(),
          audioType: metadata.audioType,
          generatedAt: new Date().toISOString()
        }
      }
    });

    // Make file publicly accessible
    await file.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    logger.debug('File uploaded to Firebase Storage', {
      path: storagePath,
      size: audioBuffer.length,
      url: publicUrl
    });

    return publicUrl;

  } catch (error) {
    logger.error('Firebase Storage upload failed', {
      path: storagePath,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if audio already exists for an article
 * Returns the public URL if exists, null otherwise
 */
export async function checkExistingAudio(
  articleId: string,
  source: string,
  audioType: AudioType
): Promise<string | null> {
  try {
    const bucket = admin.storage().bucket();
    const storagePath = `news-audio/${source}/${articleId}/${audioType}.mp3`;
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();

    if (exists) {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      logger.debug('Existing audio found', { articleId, audioType, url: publicUrl });
      return publicUrl;
    }

    return null;

  } catch (error) {
    logger.warn('Error checking existing audio', {
      articleId,
      audioType,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Generate audio for title, summary, and full content
 * Continues even if one generation fails
 */
export interface BatchAudioResult {
  titleAudio?: AudioGenerationResult;
  summaryAudio?: AudioGenerationResult;
  contentAudio?: AudioGenerationResult;
  errors: string[];
}

export async function generateBatchAudio(
  article: {
    id: string;
    title: string;
    summary: string;
    content: string;
    source: string;
  },
  options: AudioGenerationOptions = {}
): Promise<BatchAudioResult> {
  const result: BatchAudioResult = {
    errors: []
  };

  const provider = options.provider || 'kokoro';
  const voice = options.voice || (provider === 'kokoro' ? DEFAULT_KOKORO_VOICE : DEFAULT_EDGE_VOICE);

  // Generate title audio
  try {
    const existingTitleUrl = await checkExistingAudio(article.id, article.source, 'title');
    if (existingTitleUrl) {
      logger.info('Using existing title audio', { articleId: article.id });
      result.titleAudio = {
        url: existingTitleUrl,
        provider,
        voice,
        generatedAt: new Date(),
        textLength: article.title.length,
        audioType: 'title'
      };
    } else {
      result.titleAudio = await generateNewsAudio(
        article.title,
        article.id,
        article.source,
        'title',
        options
      );
    }
  } catch (error) {
    const errorMsg = `Title audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    logger.error(errorMsg, { articleId: article.id });
  }

  // Generate summary audio
  try {
    const existingSummaryUrl = await checkExistingAudio(article.id, article.source, 'summary');
    if (existingSummaryUrl) {
      logger.info('Using existing summary audio', { articleId: article.id });
      result.summaryAudio = {
        url: existingSummaryUrl,
        provider,
        voice,
        generatedAt: new Date(),
        textLength: article.summary.length,
        audioType: 'summary'
      };
    } else {
      result.summaryAudio = await generateNewsAudio(
        article.summary,
        article.id,
        article.source,
        'summary',
        options
      );
    }
  } catch (error) {
    const errorMsg = `Summary audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    logger.error(errorMsg, { articleId: article.id });
  }

  // Generate content audio (full article)
  try {
    const existingContentUrl = await checkExistingAudio(article.id, article.source, 'content');
    if (existingContentUrl) {
      logger.info('Using existing content audio', { articleId: article.id });
      result.contentAudio = {
        url: existingContentUrl,
        provider,
        voice,
        generatedAt: new Date(),
        textLength: article.content.length,
        audioType: 'content'
      };
    } else {
      result.contentAudio = await generateNewsAudio(
        article.content,
        article.id,
        article.source,
        'content',
        options
      );
    }
  } catch (error) {
    const errorMsg = `Content audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    logger.error(errorMsg, { articleId: article.id });
  }

  return result;
}
