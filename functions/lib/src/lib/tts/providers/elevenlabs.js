"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElevenLabsProvider = void 0;
const config_1 = require("../config");
const config_2 = require("../config");
class ElevenLabsProvider {
    constructor() {
        this.endpoint = 'https://api.elevenlabs.io/v1';
        const config = (0, config_1.getTtsConfig)();
        if (!config.elevenlabs.apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }
        if (!config.elevenlabs.voiceId) {
            throw new Error('ElevenLabs voice ID not configured');
        }
        this.apiKey = config.elevenlabs.apiKey;
        this.voiceId = config.elevenlabs.voiceId;
    }
    async synthesize(text, options) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            // Ignore language codes and Edge-TTS/Google voice names, use the configured voice ID
            let voiceId = this.voiceId;
            if ((options === null || options === void 0 ? void 0 : options.voice) &&
                options.voice !== 'ja-JP' &&
                options.voice !== 'en-US' &&
                !options.voice.includes('-') && // Ignore Edge-TTS/Google format voices (e.g., 'ja-JP-NanamiNeural')
                !options.voice.includes('Neural') &&
                !options.voice.includes('Standard')) {
                // Only use the voice if it looks like an ElevenLabs voice ID
                voiceId = options.voice;
            }
            const url = `${this.endpoint}/text-to-speech/${voiceId}`;
            const config = (0, config_1.getTtsConfig)();
            const requestBody = {
                text: text,
                model_id: config.elevenlabs.modelId || 'eleven_multilingual_v2',
                voice_settings: {
                    stability: ((_a = config.elevenlabs.voiceSettings) === null || _a === void 0 ? void 0 : _a.stability) || 0.5,
                    similarity_boost: ((_b = config.elevenlabs.voiceSettings) === null || _b === void 0 ? void 0 : _b.similarityBoost) || 0.75,
                    style: ((_c = config.elevenlabs.voiceSettings) === null || _c === void 0 ? void 0 : _c.style) || 0,
                    use_speaker_boost: ((_d = config.elevenlabs.voiceSettings) === null || _d === void 0 ? void 0 : _d.useSpeakerBoost) || true,
                },
            };
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || 'ElevenLabs API error');
            }
            const audioContent = await response.arrayBuffer();
            return { audioContent };
        }
        catch (error) {
            console.error('ElevenLabs TTS error:', error);
            // Determine if error is retryable
            const retryable = ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('rate limit')) ||
                ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('timeout')) ||
                ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('network'));
            throw {
                code: config_2.TTS_ERROR_CODES.PROVIDER_ERROR,
                message: `ElevenLabs TTS failed: ${error.message}`,
                provider: 'elevenlabs',
                retryable,
            };
        }
    }
    /**
     * Get available voices
     */
    async getVoices() {
        try {
            const response = await fetch(`${this.endpoint}/voices`, {
                headers: {
                    'xi-api-key': this.apiKey,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch voices');
            }
            const data = await response.json();
            return data.voices;
        }
        catch (error) {
            console.error('Error fetching ElevenLabs voices:', error);
            return [];
        }
    }
    /**
     * Get subscription info (for quota checking)
     */
    async getSubscriptionInfo() {
        try {
            const response = await fetch(`${this.endpoint}/user/subscription`, {
                headers: {
                    'xi-api-key': this.apiKey,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch subscription info');
            }
            const data = await response.json();
            return {
                character_count: data.character_count,
                character_limit: data.character_limit,
            };
        }
        catch (error) {
            console.error('Error fetching subscription info:', error);
            return {
                character_count: 0,
                character_limit: 0,
            };
        }
    }
    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}
exports.ElevenLabsProvider = ElevenLabsProvider;
//# sourceMappingURL=elevenlabs.js.map