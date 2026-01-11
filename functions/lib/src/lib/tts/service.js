"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ttsService = exports.TTSService = void 0;
const admin_1 = require("@/lib/firebase/admin");
const elevenlabs_1 = require("./providers/elevenlabs");
const voicevox_1 = require("./providers/voicevox");
const cache_1 = require("./cache");
const utils_1 = require("./utils");
const config_1 = require("./config");
class TTSService {
    constructor() {
        this.uploadPromises = new Map();
        // Initialize providers lazily
    }
    /**
     * Main synthesis method - checks cache first, then synthesizes if needed
     */
    async synthesize(text, options) {
        // Validate text
        const validation = (0, utils_1.validateText)(text);
        if (!validation.valid) {
            throw {
                code: config_1.TTS_ERROR_CODES.INVALID_TEXT,
                message: validation.error,
                retryable: false,
            };
        }
        // Parse options with defaults
        const parsedOptions = (0, utils_1.parseTTSOptions)(options);
        // Determine provider
        const provider = parsedOptions.provider === 'auto'
            ? (0, utils_1.selectProvider)(text)
            : parsedOptions.provider;
        // Get voice for provider
        const voice = this.getVoiceForProvider(provider, 'voice' in parsedOptions ? parsedOptions.voice : undefined);
        // Check cache first
        const cached = await cache_1.ttsCache.get(text, provider, voice, {
            speed: parsedOptions.speed,
            pitch: parsedOptions.pitch,
            volume: parsedOptions.volume,
        });
        if (cached) {
            console.log(`TTS cache hit for: ${text.substring(0, 50)}...`);
            return {
                audioUrl: cached.audioUrl,
                cached: true,
                duration: cached.duration,
                provider: cached.provider,
                cacheKey: cached.id,
            };
        }
        console.log(`TTS cache miss for: ${text.substring(0, 50)}... - synthesizing with ${provider}`);
        // Synthesize new audio
        try {
            const audioData = await this.synthesizeWithProvider(text, provider, {
                voice,
                speed: parsedOptions.speed,
                pitch: parsedOptions.pitch,
                volume: parsedOptions.volume,
            });
            // Upload to Firebase Storage with deduplication
            const cacheKey = (0, utils_1.generateCacheKey)(text, provider, voice, {
                speed: parsedOptions.speed,
                pitch: parsedOptions.pitch,
                volume: parsedOptions.volume,
            });
            const { url, path, size } = await this.uploadAudioWithDedup(audioData, provider, cacheKey);
            // Estimate duration
            const duration = (0, utils_1.estimateDuration)(text, parsedOptions.speed);
            // Save to cache
            await cache_1.ttsCache.set(text, provider, voice, url, path, {
                duration,
                size,
                speed: parsedOptions.speed,
                pitch: parsedOptions.pitch,
                volume: parsedOptions.volume,
            });
            return {
                audioUrl: url,
                cached: false,
                duration,
                provider,
                cacheKey: (0, utils_1.generateCacheKey)(text, provider, voice, {
                    speed: parsedOptions.speed,
                    pitch: parsedOptions.pitch,
                    volume: parsedOptions.volume,
                }),
            };
        }
        catch (error) {
            console.error('TTS synthesis error:', error);
            // If it's already a TTSError, rethrow it
            if (error.code && error.message) {
                throw error;
            }
            // Otherwise, wrap it
            throw {
                code: config_1.TTS_ERROR_CODES.PROVIDER_ERROR,
                message: `Synthesis failed: ${error.message}`,
                provider,
                retryable: true,
            };
        }
    }
    /**
     * Batch synthesize multiple texts
     */
    async batchSynthesize(items) {
        const results = await Promise.allSettled(items.map(item => this.synthesize(item.text, item.options)));
        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return {
                    text: items[index].text,
                    result: result.value,
                };
            }
            else {
                return {
                    text: items[index].text,
                    error: result.reason,
                };
            }
        });
    }
    /**
     * Preload texts into cache
     */
    async preload(texts, options) {
        const stats = {
            cached: 0,
            synthesized: 0,
            failed: 0,
        };
        for (const text of texts) {
            try {
                const result = await this.synthesize(text, options);
                if (result.cached) {
                    stats.cached++;
                }
                else {
                    stats.synthesized++;
                }
            }
            catch (error) {
                stats.failed++;
                console.error(`Failed to preload: ${text}`, error);
            }
        }
        return stats;
    }
    /**
     * Synthesize with specific provider
     * Priority: VOICEVOX → ElevenLabs (fallback)
     */
    async synthesizeWithProvider(text, provider, options) {
        var _a;
        let lastError = null;
        const config = (0, config_1.getTtsConfig)();
        // PRIORITY 1: VOICEVOX TTS via Modal API (highest quality for Japanese)
        if (provider === 'voicevox' || provider === 'auto') {
            try {
                if (!this.voicevoxProvider) {
                    this.voicevoxProvider = new voicevox_1.VoicevoxProvider();
                }
                // Use configured defaults
                const voicevoxOptions = Object.assign(Object.assign({}, options), { voice: options.voice || config.voicevox.defaultVoice, speed: (_a = options.speed) !== null && _a !== void 0 ? _a : config.voicevox.defaultSpeed });
                const result = await this.voicevoxProvider.synthesize(text, voicevoxOptions);
                const audioBuffer = Buffer.from(result.audioContent);
                if (audioBuffer.length < 100) {
                    throw new Error('VOICEVOX TTS returned empty or invalid audio data');
                }
                console.log('\x1b[42m\x1b[37m ▶️ TTS PROVIDER: VOICEVOX \x1b[0m');
                return audioBuffer;
            }
            catch (error) {
                console.error('[TTS Service] VOICEVOX provider error:', error);
                lastError = error;
                console.log('\x1b[43m\x1b[30m ⚠️ VOICEVOX failed, falling back to ElevenLabs... \x1b[0m', error.message);
                provider = 'elevenlabs';
            }
        }
        // FALLBACK: ElevenLabs (commercial quality backup)
        if (provider === 'elevenlabs') {
            try {
                if (!this.elevenLabsProvider) {
                    this.elevenLabsProvider = new elevenlabs_1.ElevenLabsProvider();
                }
                const elevenLabsVoice = this.getVoiceForProvider('elevenlabs');
                const elevenLabsOptions = Object.assign(Object.assign({}, options), { voice: elevenLabsVoice });
                const result = await this.elevenLabsProvider.synthesize(text, elevenLabsOptions);
                const audioBuffer = Buffer.from(result.audioContent);
                if (audioBuffer.length < 100) {
                    throw new Error('ElevenLabs TTS returned empty or invalid audio data');
                }
                console.log('\x1b[45m\x1b[37m ▶️ TTS PROVIDER: ElevenLabs (Fallback) \x1b[0m');
                return audioBuffer;
            }
            catch (error) {
                console.error('[TTS Service] ElevenLabs provider error:', error);
                lastError = error;
            }
        }
        // If all providers fail, throw comprehensive error
        throw {
            code: config_1.TTS_ERROR_CODES.PROVIDER_ERROR,
            message: `All TTS providers failed. Last error: ${(lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error'}. Providers tried: VOICEVOX → ElevenLabs`,
            provider: undefined,
            retryable: false,
        };
    }
    /**
     * Upload audio with deduplication to prevent concurrent upload conflicts
     */
    async uploadAudioWithDedup(audioData, provider, cacheKey) {
        const uploadKey = `${provider}-${cacheKey}`;
        // Check if an upload is already in progress for this key
        const existingUpload = this.uploadPromises.get(uploadKey);
        if (existingUpload) {
            console.log(`Upload already in progress for ${uploadKey}, waiting...`);
            return existingUpload;
        }
        // Create and store the upload promise
        const uploadPromise = this.uploadAudio(audioData, provider, cacheKey);
        this.uploadPromises.set(uploadKey, uploadPromise);
        try {
            const result = await uploadPromise;
            // Clean up after successful upload
            this.uploadPromises.delete(uploadKey);
            return result;
        }
        catch (error) {
            // Clean up after failed upload
            this.uploadPromises.delete(uploadKey);
            throw error;
        }
    }
    /**
     * Upload audio to Firebase Storage
     */
    async uploadAudio(audioData, provider, cacheKey) {
        try {
            if (!admin_1.storage) {
                console.error('Firebase Storage is not initialized, using data URL fallback');
                // Fallback to data URL if Firebase Storage is not available
                const base64 = audioData.toString('base64');
                const dataUrl = `data:audio/mpeg;base64,${base64}`;
                return {
                    url: dataUrl,
                    path: 'local',
                    size: audioData.length,
                };
            }
            const path = (0, utils_1.generateStoragePath)(provider, cacheKey);
            const bucket = admin_1.storage.bucket();
            const file = bucket.file(path);
            // Try to check if file already exists
            try {
                const [exists] = await file.exists();
                if (exists) {
                    console.log(`File already exists at ${path}, using existing file`);
                    // File already exists, just return the URL
                    const url = `https://storage.googleapis.com/${bucket.name}/${path}`;
                    return {
                        url,
                        path,
                        size: audioData.length,
                    };
                }
            }
            catch (checkError) {
                // Ignore exists check error and proceed with upload
                console.log('Could not check if file exists, proceeding with upload');
            }
            // Upload the audio file, handling conflicts gracefully
            try {
                await file.save(audioData, {
                    metadata: {
                        contentType: 'audio/mpeg',
                        cacheControl: 'public, max-age=31536000', // 1 year cache
                        metadata: {
                            provider,
                            synthesizedAt: new Date().toISOString(),
                        },
                    },
                });
            }
            catch (uploadError) {
                // If we get a 409 conflict, the file was uploaded by another request
                if (uploadError.code === 409) {
                    console.log(`File upload conflict at ${path}, using existing file`);
                    // File exists now, return the URL
                    const url = `https://storage.googleapis.com/${bucket.name}/${path}`;
                    return {
                        url,
                        path,
                        size: audioData.length,
                    };
                }
                // Re-throw other errors
                throw uploadError;
            }
            // Make the file publicly accessible
            await file.makePublic();
            // Get the public URL
            const url = `https://storage.googleapis.com/${bucket.name}/${path}`;
            return {
                url,
                path,
                size: audioData.length,
            };
        }
        catch (error) {
            console.error('Failed to upload audio to Firebase Storage:', error);
            // Fallback to data URL on any upload error
            const base64 = audioData.toString('base64');
            const dataUrl = `data:audio/mpeg;base64,${base64}`;
            return {
                url: dataUrl,
                path: 'local',
                size: audioData.length,
            };
        }
    }
    /**
     * Get appropriate voice for provider
     */
    getVoiceForProvider(provider, requestedVoice) {
        if (requestedVoice) {
            return requestedVoice;
        }
        const config = (0, config_1.getTtsConfig)();
        if (provider === 'voicevox') {
            return config.voicevox.defaultVoice;
        }
        else {
            return config.elevenlabs.voiceId;
        }
    }
    /**
     * Check if text is in cache
     */
    async isCached(text, options) {
        const parsedOptions = (0, utils_1.parseTTSOptions)(options);
        const provider = parsedOptions.provider === 'auto'
            ? (0, utils_1.selectProvider)(text)
            : parsedOptions.provider;
        const voice = this.getVoiceForProvider(provider, 'voice' in parsedOptions ? parsedOptions.voice : undefined);
        return cache_1.ttsCache.has(text, provider, voice, {
            speed: parsedOptions.speed,
            pitch: parsedOptions.pitch,
            volume: parsedOptions.volume,
        });
    }
    /**
     * Get cache statistics
     */
    async getCacheStats() {
        return cache_1.ttsCache.getStats();
    }
    /**
     * Clear cache (admin only)
     */
    async clearCache(filter) {
        return cache_1.ttsCache.clear(filter);
    }
}
exports.TTSService = TTSService;
// Export singleton instance
exports.ttsService = new TTSService();
//# sourceMappingURL=service.js.map