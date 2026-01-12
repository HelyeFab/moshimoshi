"use strict";
/**
 * Ollama API Client
 * Provides interface to Ollama LLM service (Modal-hosted Qwen 2.5 32B)
 *
 * Features:
 * - OpenAI-compatible /v1/chat/completions endpoint
 * - Native Ollama /generate endpoint (Modal uses /generate, not /api/generate)
 * - Streaming and non-streaming responses
 * - Connection pooling for performance
 * - Automatic retries with exponential backoff
 * - Health checking via /health endpoint
 *
 * Default endpoint: https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run
 * Default model: qwen2.5:32b
 *
 * Available endpoints on Modal:
 * - /v1/chat/completions (OpenAI-compatible)
 * - /generate (native Ollama)
 * - /models
 * - /health
 */
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaClient = void 0;
const https = __importStar(require("https"));
class OllamaClient {
    constructor(config) {
        this.config = Object.assign({ timeout: 60000, maxRetries: 2 }, config);
        // Connection pooling for better performance
        this.agent = new https.Agent({
            keepAlive: true,
            maxSockets: 10,
            keepAliveMsecs: 30000,
        });
    }
    /**
     * Generate text from a prompt (non-streaming)
     */
    async generate(request) {
        const fullRequest = Object.assign({ model: this.config.model, stream: false }, request);
        const response = await this.fetchWithRetry('/generate', {
            method: 'POST',
            headers: {
                'X-API-Key': this.config.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fullRequest),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Generate text with streaming (yields chunks as they arrive)
     */
    generateStream(request) {
        return __asyncGenerator(this, arguments, function* generateStream_1() {
            var _a;
            const fullRequest = Object.assign({ model: this.config.model, stream: true }, request);
            const response = yield __await(fetch(`${this.config.baseUrl}/generate`, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.config.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(fullRequest),
                // @ts-expect-error - agent is supported in Node.js fetch
                agent: this.agent,
            }));
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }
            const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
            if (!reader) {
                throw new Error('No response body');
            }
            const decoder = new TextDecoder();
            try {
                while (true) {
                    const { done, value } = yield __await(reader.read());
                    if (done)
                        break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (data.response) {
                                yield yield __await(data.response);
                            }
                        }
                        catch (e) {
                            // Skip malformed JSON
                            console.warn('Failed to parse streaming chunk:', line);
                        }
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
        });
    }
    /**
     * Chat with conversation context
     */
    async chat(request) {
        var _a;
        const fullRequest = Object.assign({ model: this.config.model, stream: false }, request);
        const response = await this.fetchWithRetry('/api/chat', {
            method: 'POST',
            headers: {
                'X-API-Key': this.config.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fullRequest),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }
        const data = await response.json();
        return {
            content: ((_a = data.message) === null || _a === void 0 ? void 0 : _a.content) || '',
            context: data.context,
        };
    }
    /**
     * Check if Ollama service is healthy
     * Uses the /health endpoint (no model invocation required)
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.config.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(10000), // 10 second timeout for cold start
            });
            if (response.ok) {
                const data = await response.json();
                return data.status === 'healthy';
            }
            return false;
        }
        catch (error) {
            console.warn('Ollama health check failed:', error);
            return false;
        }
    }
    /**
     * OpenAI-compatible chat completions
     * Uses /v1/chat/completions endpoint for better compatibility
     */
    async chatCompletions(request) {
        var _a, _b, _c, _d, _e, _f, _g;
        const payload = {
            model: this.config.model,
            messages: request.messages,
            temperature: (_b = (_a = request.options) === null || _a === void 0 ? void 0 : _a.temperature) !== null && _b !== void 0 ? _b : 0.7,
            max_tokens: (_d = (_c = request.options) === null || _c === void 0 ? void 0 : _c.num_predict) !== null && _d !== void 0 ? _d : 4096,
            stream: false,
        };
        const response = await this.fetchWithRetry('/v1/chat/completions', {
            method: 'POST',
            headers: {
                'X-API-Key': this.config.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return {
            content: ((_g = (_f = (_e = data.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content) || '',
            usage: data.usage,
        };
    }
    /**
     * Fetch with automatic retries and exponential backoff
     */
    async fetchWithRetry(endpoint, options, retries = 0) {
        try {
            const response = await fetch(`${this.config.baseUrl}${endpoint}`, Object.assign(Object.assign({}, options), { signal: AbortSignal.timeout(this.config.timeout), 
                // @ts-expect-error - agent is supported in Node.js fetch
                agent: this.agent }));
            // Retry on server errors (5xx)
            if (response.status >= 500 && retries < this.config.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                console.warn(`Ollama server error ${response.status}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchWithRetry(endpoint, options, retries + 1);
            }
            return response;
        }
        catch (error) {
            // Retry on network errors
            if (retries < this.config.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                console.warn(`Ollama request failed, retrying in ${delay}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchWithRetry(endpoint, options, retries + 1);
            }
            throw error;
        }
    }
    /**
     * Calculate estimated tokens from text (rough approximation)
     */
    static estimateTokens(text) {
        // Rough estimate: ~4 characters per token for English
        // ~2 characters per token for Japanese/Chinese
        const hasAsian = /[\u3000-\u9fff\uac00-\ud7af]/.test(text);
        return Math.ceil(text.length / (hasAsian ? 2 : 4));
    }
}
exports.OllamaClient = OllamaClient;
//# sourceMappingURL=OllamaClient.js.map