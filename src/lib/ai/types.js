"use strict";
/**
 * Unified AI Service Types
 * Central type definitions for all AI-powered features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_PRICING = exports.AIServiceError = exports.BaseProcessor = void 0;
class BaseProcessor {
    constructor(context) {
        this.context = context;
    }
}
exports.BaseProcessor = BaseProcessor;
// ============================================
// Error Types
// ============================================
class AIServiceError extends Error {
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AIServiceError';
    }
}
exports.AIServiceError = AIServiceError;
exports.MODEL_PRICING = {
    'gpt-4': {
        model: 'gpt-4',
        inputCostPer1k: 0.03,
        outputCostPer1k: 0.06,
    },
    'gpt-4o-mini': {
        model: 'gpt-4o-mini',
        inputCostPer1k: 0.00015,
        outputCostPer1k: 0.0006,
    },
    'gpt-4o': {
        model: 'gpt-4o',
        inputCostPer1k: 0.0025,
        outputCostPer1k: 0.01,
    },
    'gpt-3.5-turbo': {
        model: 'gpt-3.5-turbo',
        inputCostPer1k: 0.0005,
        outputCostPer1k: 0.0015,
    },
    'gemini-2.5-flash-image': {
        model: 'gemini-2.5-flash-image',
        inputCostPer1k: 0, // Free tier
        outputCostPer1k: 0.02, // ~$0.02 per image
    },
    'gemini-3-pro-image': {
        model: 'gemini-3-pro-image',
        inputCostPer1k: 0,
        outputCostPer1k: 0.04, // ~$0.04 per image (higher quality)
    },
    'dall-e-3': {
        model: 'dall-e-3',
        inputCostPer1k: 0,
        outputCostPer1k: 0.04, // ~$0.04 per image (standard quality 1024x1024)
    },
};
//# sourceMappingURL=types.js.map