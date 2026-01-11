"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicevoxProvider = void 0;
const config_1 = require("../config");
/**
 * VOICEVOX TTS Provider (via Modal)
 * High quality Japanese text-to-speech using VOICEVOX engine
 */
class VoicevoxProvider {
    constructor() {
        const config = (0, config_1.getTtsConfig)();
        this.apiKey = config.voicevox.apiKey || '';
        this.baseUrl = config.voicevox.baseUrl;
        if (!this.apiKey) {
            console.warn('MODAL_API_KEY not found - VOICEVOX TTS will fail');
        }
    }
    async synthesize(text, options) {
        var _a, _b, _c;
        if (!this.apiKey) {
            throw new Error('MODAL_API_KEY is required for VOICEVOX TTS');
        }
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }
        const config = (0, config_1.getTtsConfig)();
        // VOICEVOX uses numeric speaker IDs - default to '23' (energetic female)
        const voice = this.mapVoiceToVoicevox(options.voice || config.voicevox.defaultVoice);
        // Default speed 0.85 for optimal Japanese speech
        const speed = Math.max(0.5, Math.min(2.0, (_a = options.speed) !== null && _a !== void 0 ? _a : config.voicevox.defaultSpeed));
        console.log('[VOICEVOX TTS] Generating audio', {
            textLength: text.length,
            voice,
            speed,
            textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        });
        try {
            const response = await fetch(`${this.baseUrl}/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                    'User-Agent': 'Moshimoshi/TTS-Service',
                },
                body: JSON.stringify({
                    model: 'voicevox',
                    input: text,
                    voice: voice,
                    speed: speed,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[VOICEVOX TTS] API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                });
                if (response.status === 401) {
                    throw new Error('VOICEVOX API authentication failed - check MODAL_API_KEY');
                }
                else if (response.status === 429) {
                    throw new Error('VOICEVOX API rate limit exceeded');
                }
                else if (response.status >= 500) {
                    throw new Error(`VOICEVOX API server error (${response.status}): ${errorText}`);
                }
                else {
                    throw new Error(`VOICEVOX API error (${response.status}): ${errorText}`);
                }
            }
            const audioBuffer = await response.arrayBuffer();
            if (audioBuffer.byteLength === 0) {
                throw new Error('VOICEVOX API returned empty audio data');
            }
            console.log('[VOICEVOX TTS] Audio generated successfully', {
                size: (audioBuffer.byteLength / 1024).toFixed(2) + ' KB',
                voice,
                speed,
            });
            return {
                audioContent: audioBuffer,
                duration: this.estimateDuration(text, speed),
            };
        }
        catch (error) {
            console.error('[VOICEVOX TTS] Request failed:', error);
            if (error.name === 'AbortError' || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('timeout'))) {
                throw new Error('VOICEVOX API request timeout - Modal server may be cold starting');
            }
            // Re-throw our custom errors as-is
            if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.startsWith('VOICEVOX API')) {
                throw error;
            }
            // Network errors
            throw new Error(`VOICEVOX TTS network error: ${error.message}`);
        }
    }
    /**
     * Map generic voice names to VOICEVOX speaker IDs
     * VOICEVOX speakers: https://voicevox.hiroshiba.jp/
     * Default: 23 (energetic female)
     */
    mapVoiceToVoicevox(voice) {
        const voiceMapping = {
            // Map generic voice names to VOICEVOX speaker IDs
            jf_alpha: '23',
            'ja-JP-Standard-A': '23', // Female
            'ja-JP-Standard-B': '13', // Male -> 青山龍星
            'ja-JP-Standard-C': '23',
            'ja-JP-Standard-D': '13',
            'ja-JP-Wavenet-A': '23',
            'ja-JP-Wavenet-B': '13',
            'japanese-female': '23',
            'japanese-male': '13',
            'ja-JP': '23', // Common locale code
            default: '23',
            // Direct VOICEVOX speaker IDs
            '1': '1', // 四国めたん
            '3': '3', // ずんだもん
            '11': '11', // 玄野武宏 (Nemo)
            '13': '13', // 青山龍星
            '23': '23', // Energetic female (default)
        };
        // If it's already a numeric ID, return as-is
        if (/^\d+$/.test(voice)) {
            return voice;
        }
        return voiceMapping[voice] || '23'; // Default to energetic female
    }
    /**
     * Estimate audio duration based on text length and speed
     * Japanese text: ~4 characters per second at normal speed
     */
    estimateDuration(text, speed = 1.0) {
        const charactersPerSecond = 4 * speed;
        const duration = text.length / charactersPerSecond;
        return Math.max(0.5, duration); // Minimum 0.5 seconds
    }
    /**
     * Check if the VOICEVOX API is available
     */
    async healthCheck() {
        try {
            const response = await fetch(`https://emmanuelfabiani23--voicevox-tts-serve.modal.run/health`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Moshimoshi/Health-Check',
                },
            });
            return response.ok;
        }
        catch (error) {
            console.warn('[VOICEVOX TTS] Health check failed:', error);
            return false;
        }
    }
    /**
     * Get supported voices (VOICEVOX speaker IDs)
     */
    getSupportedVoices() {
        return ['23', '11', '13', '1', '3']; // Popular VOICEVOX speakers (23 is default)
    }
    /**
     * Get provider info
     */
    getProviderInfo() {
        return {
            name: 'VOICEVOX TTS (Modal)',
            provider: 'voicevox',
            baseUrl: this.baseUrl,
            hasApiKey: !!this.apiKey,
            supportedLanguages: ['ja-JP'],
            supportedFormats: ['wav', 'mp3'],
            maxTextLength: 5000,
        };
    }
}
exports.VoicevoxProvider = VoicevoxProvider;
//# sourceMappingURL=voicevox.js.map