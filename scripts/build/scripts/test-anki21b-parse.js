"use strict";
/**
 * Test script for anki21b import - Direct parser test
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var parser_1 = require("../src/lib/anki/parser");
var fs = __importStar(require("fs"));
function testAnki21bParse() {
    return __awaiter(this, void 0, void 0, function () {
        var filePath, stats, fileBuffer, deck, firstNote, err_1, error;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    console.log('=== Testing anki21b Parse ===\n');
                    filePath = '/home/beano/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg';
                    // Check if file exists
                    if (!fs.existsSync(filePath)) {
                        console.error('❌ File not found:', filePath);
                        process.exit(1);
                    }
                    stats = fs.statSync(filePath);
                    console.log('📁 File: Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg');
                    console.log('📊 Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
                    console.log('');
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 3, , 4]);
                    fileBuffer = fs.readFileSync(filePath);
                    console.log('✅ File read successfully');
                    console.log('📦 Buffer size:', fileBuffer.length, 'bytes');
                    console.log('');
                    console.log('🔍 Attempting to parse anki21b file...');
                    console.log('');
                    return [4 /*yield*/, parser_1.AnkiParser.parseInMemory(fileBuffer)];
                case 2:
                    deck = _f.sent();
                    console.log('✅ SUCCESS! File parsed successfully!');
                    console.log('');
                    console.log('📊 Parse Results:');
                    console.log('  - Deck name:', ((_a = deck.meta) === null || _a === void 0 ? void 0 : _a.name) || 'N/A');
                    console.log('  - Total notes:', ((_b = deck.notes) === null || _b === void 0 ? void 0 : _b.length) || 0);
                    console.log('  - Media files:', ((_c = deck.mediaFiles) === null || _c === void 0 ? void 0 : _c.length) || 0);
                    console.log('');
                    if (deck.notes && deck.notes.length > 0) {
                        console.log('📇 Sample note (first note):');
                        firstNote = deck.notes[0];
                        console.log('  - ID:', firstNote.id);
                        console.log('  - Fields count:', ((_d = firstNote.fields) === null || _d === void 0 ? void 0 : _d.length) || 0);
                        console.log('  - Tags:', ((_e = firstNote.tags) === null || _e === void 0 ? void 0 : _e.join(', ')) || 'none');
                        console.log('');
                        if (firstNote.fields && firstNote.fields.length > 0) {
                            console.log('  Field samples:');
                            firstNote.fields.slice(0, 3).forEach(function (field, i) {
                                var preview = field.substring(0, 80).replace(/\n/g, ' ');
                                console.log("    [".concat(i, "]:"), preview + (field.length > 80 ? '...' : ''));
                            });
                            console.log('');
                        }
                    }
                    console.log('🎉 anki21b format is now supported!');
                    console.log('✨ The simple fix worked - no protobuf parsing needed!');
                    console.log('');
                    process.exit(0);
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _f.sent();
                    error = err_1;
                    console.error('❌ FAILED to parse file');
                    console.error('');
                    console.error('Error:', error.message);
                    console.error('');
                    if (error.stack) {
                        console.error('Stack trace:');
                        console.error(error.stack);
                        console.error('');
                    }
                    console.log('ℹ️  This means we need to implement protobuf parsing for this file.');
                    console.log('');
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
testAnki21bParse();
