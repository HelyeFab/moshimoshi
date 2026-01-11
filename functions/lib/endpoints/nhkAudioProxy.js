"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nhkAudioProxy = void 0;
const logger = __importStar(require("firebase-functions/logger"));
const firebase_functions_1 = require("firebase-functions");
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * NHK Audio Proxy - Converts old vod-stream.nhk.jp URLs to working media.vd.st.nhk URLs
 * and handles authentication/CORS issues
 */
exports.nhkAudioProxy = firebase_functions_1.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const originalUrl = req.query.url;
        if (!originalUrl) {
            res.status(400).json({ error: 'Missing url parameter' });
            return;
        }
        logger.info('[NHK Audio Proxy] Processing URL:', { originalUrl });
        // Convert old URL pattern to new pattern
        const convertedUrl = convertNhkUrl(originalUrl);
        if (!convertedUrl) {
            res.status(400).json({ error: 'Invalid NHK URL format' });
            return;
        }
        logger.info('[NHK Audio Proxy] Converted URL:', { convertedUrl });
        // Method 1: Try direct request with proper headers
        const audioContent = await fetchWithAuth(convertedUrl);
        if (audioContent.success) {
            // Set proper headers for m3u8 streaming
            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            res.set('Cache-Control', 'public, max-age=300'); // 5 min cache
            res.status(200).send(audioContent.data);
            return;
        }
        // Method 2: If direct fails, try session-based approach
        logger.info('[NHK Audio Proxy] Direct request failed, trying session approach');
        const sessionAudio = await fetchWithSession(convertedUrl);
        if (sessionAudio.success) {
            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            res.set('Cache-Control', 'public, max-age=300');
            res.status(200).send(sessionAudio.data);
            return;
        }
        // Method 3: If all fails, return original URL (fallback to TTS)
        logger.warn('[NHK Audio Proxy] All methods failed, returning error');
        res.status(404).json({
            error: 'NHK audio not available',
            originalUrl,
            convertedUrl,
            fallbackRequired: true
        });
    }
    catch (error) {
        logger.error('[NHK Audio Proxy] Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * Convert old NHK URL format to new format
 * Old: https://vod-stream.nhk.jp/news/easy_audio/ne2025111141515_VKpUR6BG09ug1BVthgG_GRa3kENgcgB5eTbhK4248aka_m/index.m3u8
 * New: https://media.vd.st.nhk/news/easy_audio/ne2025111141515_VKpUR6BG09ug1BVthgG_GRa3kENgcgB5eTbhK4248aka_m/index.m3u8
 */
function convertNhkUrl(originalUrl) {
    try {
        if (!originalUrl.includes('vod-stream.nhk.jp') && !originalUrl.includes('media.vd.st.nhk')) {
            return null;
        }
        // If already the new format, return as-is
        if (originalUrl.includes('media.vd.st.nhk')) {
            return originalUrl;
        }
        // Convert from old to new format
        return originalUrl.replace('vod-stream.nhk.jp', 'media.vd.st.nhk');
    }
    catch (error) {
        logger.error('[NHK Audio Proxy] URL conversion error:', error);
        return null;
    }
}
/**
 * Fetch audio with proper authentication headers
 */
async function fetchWithAuth(url) {
    try {
        const response = await (0, node_fetch_1.default)(url, {
            method: 'GET',
            headers: {
                'Referer': 'https://www3.nhk.or.jp/news/easy/',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Origin': 'https://www3.nhk.or.jp'
            },
            timeout: 10000
        });
        if (response.ok) {
            const text = await response.text();
            return { success: true, data: text };
        }
        logger.warn('[NHK Audio Proxy] Direct request failed:', {
            status: response.status,
            statusText: response.statusText
        });
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    catch (error) {
        logger.error('[NHK Audio Proxy] Fetch error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
/**
 * Fetch audio with session-based approach (visit NHK page first to get cookies)
 */
async function fetchWithSession(url) {
    try {
        // Step 1: Visit NHK Easy page to establish session
        const sessionResponse = await (0, node_fetch_1.default)('https://www3.nhk.or.jp/news/easy/', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        if (!sessionResponse.ok) {
            return { success: false, error: 'Failed to establish session' };
        }
        // Extract cookies from session
        const cookies = sessionResponse.headers.get('set-cookie') || '';
        // Step 2: Use session cookies for audio request
        const audioResponse = await (0, node_fetch_1.default)(url, {
            method: 'GET',
            headers: {
                'Referer': 'https://www3.nhk.or.jp/news/easy/',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
                'Origin': 'https://www3.nhk.or.jp',
                'Cookie': cookies
            },
            timeout: 10000
        });
        if (audioResponse.ok) {
            const text = await audioResponse.text();
            return { success: true, data: text };
        }
        logger.warn('[NHK Audio Proxy] Session request failed:', {
            status: audioResponse.status,
            statusText: audioResponse.statusText
        });
        return { success: false, error: `HTTP ${audioResponse.status}: ${audioResponse.statusText}` };
    }
    catch (error) {
        logger.error('[NHK Audio Proxy] Session fetch error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
//# sourceMappingURL=nhkAudioProxy.js.map