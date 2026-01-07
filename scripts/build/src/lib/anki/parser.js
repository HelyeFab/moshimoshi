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
exports.AnkiParser = void 0;
var buffer_1 = require("buffer");
// Ensure Buffer is available globally in browser
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
    window.Buffer = buffer_1.Buffer;
}
var AnkiParser = /** @class */ (function () {
    function AnkiParser() {
    }
    AnkiParser.parseApkg = function (file) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer, deckBuffer, deck_1, mappedNotes, processedCards, media_1, decks, error_1;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, file.arrayBuffer()];
                    case 1:
                        buffer = _b.sent();
                        deckBuffer = buffer_1.Buffer.from(buffer);
                        return [4 /*yield*/, this.parseInMemory(deckBuffer)];
                    case 2:
                        deck_1 = _b.sent();
                        mappedNotes = deck_1.notes.map(function (note) {
                            var _a;
                            return ({
                                id: note.id,
                                fields: note.fields,
                                tags: note.tags,
                                deckName: ((_a = deck_1.meta) === null || _a === void 0 ? void 0 : _a.name) || 'Imported Deck'
                            });
                        });
                        processedCards = mappedNotes.map(function (note, index) {
                            var _a, _b, _c;
                            var fields = note.fields || [];
                            // Extract all media references from ALL fields BEFORE cleaning
                            var allFieldsRaw = fields.join(' ');
                            var media = _this.extractMediaReferences(allFieldsRaw);
                            // Extract audio and image filenames specifically
                            var audioFilename = _this.extractAudioFilename(allFieldsRaw);
                            var imageFilename = _this.extractImageFilename(allFieldsRaw);
                            // Detect note type and extract fields accordingly
                            var extracted = _this.extractFieldsByType(fields);
                            // Extract furigana from raw HTML BEFORE cleaning
                            var furiganaFront = _this.extractFurigana(extracted.front);
                            var furiganaBack = _this.extractFurigana(extracted.back);
                            var hasNativeFurigana = !!(furiganaFront || furiganaBack);
                            // Log first card for debugging
                            if (index === 0) {
                                console.log('[AnkiParser] First card extraction:', {
                                    fieldsCount: fields.length,
                                    field0: (_a = fields[0]) === null || _a === void 0 ? void 0 : _a.substring(0, 30),
                                    field1: (_b = fields[1]) === null || _b === void 0 ? void 0 : _b.substring(0, 30),
                                    field2: (_c = fields[2]) === null || _c === void 0 ? void 0 : _c.substring(0, 30),
                                    allFieldsRaw: allFieldsRaw.substring(0, 200),
                                    audioFilename: audioFilename,
                                    imageFilename: imageFilename,
                                    extractedReading: extracted.reading,
                                    extractedExpression: extracted.expression,
                                    noteType: extracted.noteType,
                                    hasNativeFurigana: hasNativeFurigana,
                                    furiganaFront: furiganaFront === null || furiganaFront === void 0 ? void 0 : furiganaFront.substring(0, 50),
                                });
                            }
                            return {
                                id: note.id,
                                noteId: note.id,
                                deckId: '1',
                                front: _this.cleanHtml(extracted.front),
                                back: _this.cleanHtml(extracted.back),
                                tags: note.tags || [],
                                fields: note.fields,
                                media: media,
                                // Rich content
                                reading: extracted.reading ? _this.cleanHtml(extracted.reading) : undefined,
                                audioFilename: audioFilename,
                                imageFilename: imageFilename,
                                expression: extracted.expression ? _this.cleanHtml(extracted.expression) : undefined,
                                meaning: extracted.meaning ? _this.cleanHtml(extracted.meaning) : undefined,
                                sentence: extracted.sentence ? _this.cleanHtml(extracted.sentence) : undefined,
                                sentenceReading: extracted.sentenceReading ? _this.cleanHtml(extracted.sentenceReading) : undefined,
                                sentenceMeaning: extracted.sentenceMeaning ? _this.cleanHtml(extracted.sentenceMeaning) : undefined,
                                noteType: extracted.noteType,
                                // Furigana
                                furiganaFront: furiganaFront || undefined,
                                furiganaBack: furiganaBack || undefined,
                                hasNativeFurigana: hasNativeFurigana,
                            };
                        });
                        media_1 = new Map();
                        if (deck_1.mediaFiles && Array.isArray(deck_1.mediaFiles)) {
                            deck_1.mediaFiles.forEach(function (mediaFile) {
                                if (mediaFile.data) {
                                    // Detect MIME type from filename extension
                                    var mimeType = _this.getMimeType(mediaFile.filename);
                                    media_1.set(mediaFile.filename, new Blob([mediaFile.data], { type: mimeType }));
                                }
                            });
                        }
                        decks = [{
                                id: '1',
                                name: ((_a = deck_1.meta) === null || _a === void 0 ? void 0 : _a.name) || 'Imported Deck',
                                desc: '',
                                cards: processedCards
                            }];
                        return [2 /*return*/, {
                                cards: processedCards,
                                decks: decks,
                                media: media_1
                            }];
                    case 3:
                        error_1 = _b.sent();
                        console.error('Error parsing Anki package:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Parse in memory without filesystem
    AnkiParser.parseInMemory = function (buffer) {
        return __awaiter(this, void 0, void 0, function () {
            var JSZip, zip, zipContent, collectionFile, isModernFormat, collectionData, rawBytes, ZSTDDecoder, decoder, compressed, decompressed, sqliteHeader, newBuffer, newView, error_2, SQL, db, finalData, finalHeader, errorMsg, tablesResult, tables, colResult, decksJson, modelsJson, decks, models, offset, allNotes, hasMore, _loop_1, state_1, notes, deckEntries, mainDeck, mediaFiles, mediaFile, mediaJson, mediaMap, _i, _a, _b, idx, filename, mediaFileInZip, data, e_1;
            var _c, _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('jszip')); })];
                    case 1:
                        JSZip = (_k.sent()).default;
                        zip = new JSZip();
                        return [4 /*yield*/, zip.loadAsync(buffer)];
                    case 2:
                        zipContent = _k.sent();
                        // Log all files in the zip
                        console.log('[AnkiParser] Files in .apkg:', Object.keys(zipContent.files));
                        collectionFile = zipContent.files['collection.anki21'];
                        isModernFormat = false;
                        if (collectionFile) {
                            isModernFormat = true;
                            console.log('[AnkiParser] Detected modern Anki format (collection.anki21)');
                        }
                        else {
                            collectionFile = zipContent.files['collection.anki2'];
                            if (!collectionFile) {
                                throw new Error('No collection.anki2 or collection.anki21 file found in the Anki package');
                            }
                            console.log('[AnkiParser] Detected legacy Anki format (collection.anki2)');
                        }
                        return [4 /*yield*/, collectionFile.async('arraybuffer')];
                    case 3:
                        collectionData = _k.sent();
                        console.log('[AnkiParser] Raw collection data size:', collectionData.byteLength);
                        rawBytes = new Uint8Array(collectionData);
                        console.log('[AnkiParser] First 16 bytes (hex):', Array.from(rawBytes.slice(0, 16)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(' '));
                        console.log('[AnkiParser] First 16 bytes (text):', new TextDecoder().decode(rawBytes.slice(0, 16)));
                        if (!isModernFormat) return [3 /*break*/, 8];
                        _k.label = 4;
                    case 4:
                        _k.trys.push([4, 7, , 8]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('zstddec')); })];
                    case 5:
                        ZSTDDecoder = (_k.sent()).ZSTDDecoder;
                        decoder = new ZSTDDecoder();
                        return [4 /*yield*/, decoder.init()];
                    case 6:
                        _k.sent();
                        compressed = new Uint8Array(collectionData);
                        console.log('[AnkiParser] Compressed data size:', compressed.length);
                        console.log('[AnkiParser] First 16 bytes (hex):', Array.from(compressed.slice(0, 16)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(' '));
                        decompressed = decoder.decode(compressed);
                        if (!decompressed) {
                            throw new Error('Failed to decompress collection.anki21 file');
                        }
                        console.log('[AnkiParser] Decompressed data size:', decompressed.length);
                        console.log('[AnkiParser] First 16 bytes of decompressed (hex):', Array.from(decompressed.slice(0, 16)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(' '));
                        sqliteHeader = new TextDecoder().decode(decompressed.slice(0, 16));
                        console.log('[AnkiParser] Decompressed header:', sqliteHeader);
                        if (!sqliteHeader.startsWith('SQLite format 3')) {
                            console.warn('[AnkiParser] Non-standard SQLite header detected (possibly anki21b format)');
                            console.warn('[AnkiParser] Header:', sqliteHeader);
                            console.warn('[AnkiParser] Attempting to parse anyway - anki21b files are still SQLite databases');
                            // Don't throw - many anki21b files are valid SQLite with non-standard headers
                            // We'll attempt to parse and let sql.js handle any actual incompatibilities
                        }
                        newBuffer = new ArrayBuffer(decompressed.length);
                        newView = new Uint8Array(newBuffer);
                        newView.set(decompressed);
                        collectionData = newBuffer;
                        console.log('[AnkiParser] Successfully decompressed collection.anki21 (' +
                            "".concat(compressed.length, " bytes -> ").concat(decompressed.length, " bytes)"));
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _k.sent();
                        console.error('[AnkiParser] Failed to decompress collection.anki21:', error_2);
                        // Re-throw our specific error messages
                        if (error_2 instanceof Error && error_2.message.includes('Protocol Buffers')) {
                            throw error_2;
                        }
                        throw new Error('Failed to decompress modern Anki file. This may be a corrupted or encrypted deck. ' +
                            'Please try exporting the deck again from Anki.');
                    case 8: return [4 /*yield*/, this.initSQL()];
                    case 9:
                        SQL = _k.sent();
                        finalData = new Uint8Array(collectionData);
                        console.log('[AnkiParser] Final data size before SQL.js:', finalData.length);
                        console.log('[AnkiParser] Final data first 16 bytes (hex):', Array.from(finalData.slice(0, 16)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(' '));
                        finalHeader = new TextDecoder().decode(finalData.slice(0, 16));
                        console.log('[AnkiParser] Final data header:', JSON.stringify(finalHeader));
                        if (!finalHeader.startsWith('SQLite format 3')) {
                            throw new Error("Invalid data format. Expected SQLite database but got: \"".concat(finalHeader.replace(/\0/g, '\\0'), "\". ") +
                                "This file may be using an unsupported Anki format (anki21b/protobuf). " +
                                "Please export from Anki using legacy format: File \u2192 Export \u2192 Legacy support: \"Anki 2.1.50+\"");
                        }
                        try {
                            db = new SQL.Database(finalData);
                        }
                        catch (error) {
                            console.error('[AnkiParser] Failed to open SQLite database:', error);
                            errorMsg = error instanceof Error ? error.message : String(error);
                            if (errorMsg.includes('encrypted')) {
                                throw new Error('This Anki deck is password-protected. Please remove the password in Anki and export again.');
                            }
                            if (errorMsg.includes('not a database')) {
                                throw new Error('Invalid Anki file format. The file may be corrupted or not a valid .apkg file.');
                            }
                            throw new Error("Failed to read Anki database: ".concat(errorMsg));
                        }
                        _k.label = 10;
                    case 10:
                        _k.trys.push([10, , 19, 20]);
                        tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
                        tables = ((_c = tablesResult[0]) === null || _c === void 0 ? void 0 : _c.values.flat()) || [];
                        console.log('[AnkiParser] Available tables:', tables);
                        // Check if the 'col' table exists
                        if (!tables.includes('col')) {
                            throw new Error("Invalid Anki database schema. Expected 'col' table but found: ".concat(tables.join(', '), ". ") +
                                'This may be an unsupported Anki version or corrupted file.');
                        }
                        colResult = db.exec('SELECT decks, models FROM col');
                        decksJson = (_e = (_d = colResult[0]) === null || _d === void 0 ? void 0 : _d.values[0]) === null || _e === void 0 ? void 0 : _e[0];
                        modelsJson = (_g = (_f = colResult[0]) === null || _f === void 0 ? void 0 : _f.values[0]) === null || _g === void 0 ? void 0 : _g[1];
                        decks = JSON.parse(decksJson || '{}');
                        models = JSON.parse(modelsJson || '{}');
                        offset = 0;
                        allNotes = [];
                        hasMore = true;
                        _loop_1 = function () {
                            var pageQuery = db.exec("SELECT * FROM notes LIMIT 100 OFFSET ".concat(offset));
                            var pageData = ((_h = pageQuery[0]) === null || _h === void 0 ? void 0 : _h.values) || [];
                            if (pageData.length === 0) {
                                hasMore = false;
                            }
                            else {
                                // Map raw SQL result to objects
                                var columns_1 = ((_j = pageQuery[0]) === null || _j === void 0 ? void 0 : _j.columns) || [];
                                var mappedPage = pageData.map(function (row) {
                                    var obj = {};
                                    columns_1.forEach(function (col, idx) {
                                        obj[col] = row[idx];
                                    });
                                    return obj;
                                });
                                allNotes = allNotes.concat(mappedPage);
                                offset += pageData.length;
                            }
                            // Safety limit
                            if (offset > 10000)
                                return "break";
                        };
                        while (hasMore) {
                            state_1 = _loop_1();
                            if (state_1 === "break")
                                break;
                        }
                        notes = allNotes.map(function (noteRow) {
                            var fields = noteRow.flds ? noteRow.flds.split('\x1f') : [];
                            var tags = noteRow.tags ? noteRow.tags.split(' ').filter(Boolean) : [];
                            return {
                                id: String(noteRow.id),
                                guid: noteRow.guid,
                                modelId: noteRow.mid,
                                fields: fields,
                                tags: tags
                            };
                        });
                        deckEntries = Object.entries(decks);
                        mainDeck = deckEntries.length > 0 ? deckEntries[0][1] : { name: 'Imported Deck' };
                        mediaFiles = [];
                        mediaFile = zipContent.files['media'];
                        if (!mediaFile) return [3 /*break*/, 18];
                        _k.label = 11;
                    case 11:
                        _k.trys.push([11, 17, , 18]);
                        return [4 /*yield*/, mediaFile.async('string')];
                    case 12:
                        mediaJson = _k.sent();
                        mediaMap = JSON.parse(mediaJson);
                        _i = 0, _a = Object.entries(mediaMap);
                        _k.label = 13;
                    case 13:
                        if (!(_i < _a.length)) return [3 /*break*/, 16];
                        _b = _a[_i], idx = _b[0], filename = _b[1];
                        mediaFileInZip = zipContent.files[idx];
                        if (!mediaFileInZip) return [3 /*break*/, 15];
                        return [4 /*yield*/, mediaFileInZip.async('uint8array')];
                    case 14:
                        data = _k.sent();
                        mediaFiles.push({ filename: filename, data: data });
                        _k.label = 15;
                    case 15:
                        _i++;
                        return [3 /*break*/, 13];
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        e_1 = _k.sent();
                        console.warn('Failed to process media files:', e_1);
                        return [3 /*break*/, 18];
                    case 18: return [2 /*return*/, {
                            meta: {
                                name: mainDeck.name || 'Imported Deck'
                            },
                            notes: notes,
                            mediaFiles: mediaFiles
                        }];
                    case 19:
                        db.close();
                        return [7 /*endfinally*/];
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    AnkiParser.initSQL = function () {
        return __awaiter(this, void 0, void 0, function () {
            var initSqlJs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('sql.js')); })];
                    case 1:
                        initSqlJs = (_a.sent()).default;
                        return [4 /*yield*/, initSqlJs({
                                locateFile: function (file) {
                                    if (file.endsWith('.wasm')) {
                                        return '/sql-wasm.wasm';
                                    }
                                    return "/".concat(file);
                                }
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Extract furigana HTML from raw field content
     * Returns null if no furigana exists, otherwise returns the HTML with ruby tags
     */
    AnkiParser.extractFurigana = function (html) {
        if (!html)
            return null;
        // Check if the HTML contains ruby tags
        var hasRubyTags = /<ruby>.*?<rt>.*?<\/rt><\/ruby>/gi.test(html);
        if (!hasRubyTags) {
            return null;
        }
        // Return the HTML with ruby tags preserved
        // Clean up entities and normalize spacing
        var furiganaHtml = html
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        // Remove audio/image references
        furiganaHtml = furiganaHtml.replace(/\[sound:[^\]]+\]/g, '');
        furiganaHtml = furiganaHtml.replace(/<img[^>]+>/g, '');
        // Remove non-ruby formatting tags but preserve content
        furiganaHtml = furiganaHtml.replace(/<\/?(?!ruby|rt|rp)(div|p|span|b|i|u|strong|em|font)[^>]*>/gi, '');
        return furiganaHtml.trim();
    };
    AnkiParser.cleanHtml = function (html) {
        if (!html)
            return '';
        var cleaned = html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        // Extract furigana
        cleaned = cleaned.replace(/<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/gi, '$1($2)');
        // Clean audio/image references but keep markers
        cleaned = cleaned.replace(/\[sound:[^\]]+\]/g, '[audio]');
        cleaned = cleaned.replace(/<img[^>]+>/g, '[image]');
        // Remove HTML tags but preserve content
        cleaned = cleaned.replace(/<\/?(div|p|span|b|i|u|strong|em|font)[^>]*>/gi, '');
        return cleaned.trim();
    };
    AnkiParser.extractMediaReferences = function (content) {
        var _a;
        var mediaRefs = [];
        // Match [sound:filename.mp3] format
        var soundMatches = content.match(/\[sound:([^\]]+)\]/g) || [];
        for (var _i = 0, soundMatches_1 = soundMatches; _i < soundMatches_1.length; _i++) {
            var match = soundMatches_1[_i];
            var filename = match.replace(/\[sound:|]/g, '');
            mediaRefs.push(filename);
        }
        // Match <img src="filename.jpg"> format
        var imgMatches = content.match(/<img[^>]+src="([^"]+)"/g) || [];
        for (var _b = 0, imgMatches_1 = imgMatches; _b < imgMatches_1.length; _b++) {
            var match = imgMatches_1[_b];
            var filename = (_a = match.match(/src="([^"]+)"/)) === null || _a === void 0 ? void 0 : _a[1];
            if (filename && !filename.startsWith('http')) {
                mediaRefs.push(filename);
            }
        }
        return mediaRefs;
    };
    /**
     * Extract audio filename from content
     */
    AnkiParser.extractAudioFilename = function (content) {
        var match = content.match(/\[sound:([^\]]+)\]/);
        return match ? match[1] : undefined;
    };
    /**
     * Extract image filename from content
     */
    AnkiParser.extractImageFilename = function (content) {
        var match = content.match(/<img[^>]+src="([^"]+)"/);
        if (match && match[1] && !match[1].startsWith('http')) {
            return match[1];
        }
        return undefined;
    };
    /**
     * Smart field extraction based on note type detection
     */
    AnkiParser.extractFieldsByType = function (fields) {
        var _a, _b;
        // Default result
        var result = {
            front: fields[0] || '',
            back: fields[1] || '',
            noteType: 'unknown',
        };
        if (fields.length === 0)
            return result;
        // iKnow! format detection (7 fields: Expression, Meaning, Reading, Audio, Image_URI, iKnowID, iKnowType)
        if (fields.length >= 7) {
            var lastField = ((_a = fields[6]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
            if (lastField === 'item' || lastField === 'sentence') {
                // This is iKnow! format
                var isVocab = lastField === 'item';
                result.noteType = isVocab ? 'vocabulary' : 'sentence';
                result.expression = fields[0];
                result.meaning = fields[1];
                result.reading = fields[2];
                // fields[3] = Audio, fields[4] = Image_URI - handled separately
                // fields[5] = iKnowID, fields[6] = iKnowType
                if (isVocab) {
                    result.front = fields[0]; // Expression
                    result.back = fields[1]; // Meaning
                }
                else {
                    // Sentence type - expression contains the sentence
                    result.sentence = fields[0];
                    result.sentenceReading = fields[2];
                    result.sentenceMeaning = fields[1];
                    result.front = fields[0];
                    result.back = fields[1];
                }
                return result;
            }
        }
        // Core 2000 format detection (first field is numeric index)
        if (fields.length >= 4 && /^\d+$/.test((_b = fields[0]) === null || _b === void 0 ? void 0 : _b.trim())) {
            // Core 2000: [index, expression, reading, meaning, ...]
            result.noteType = 'vocabulary';
            result.expression = fields[1];
            result.reading = fields[2];
            result.meaning = fields[3];
            result.front = fields[1];
            result.back = fields[3];
            return result;
        }
        // Generic Japanese vocab format (Expression, Reading, Meaning or similar)
        if (fields.length >= 3) {
            var field0 = fields[0] || '';
            var field1 = fields[1] || '';
            var field2 = fields[2] || '';
            // Check if field1 looks like a reading (all hiragana/katakana)
            var isReadingField = /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(field1.replace(/<[^>]+>/g, ''));
            if (isReadingField) {
                // Format: Expression, Reading, Meaning
                result.noteType = 'vocabulary';
                result.expression = field0;
                result.reading = field1;
                result.meaning = field2;
                result.front = field0;
                result.back = field2;
                return result;
            }
            // Check if it's Expression, Meaning, Reading order
            var isField2Reading = /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(field2.replace(/<[^>]+>/g, ''));
            if (isField2Reading) {
                result.noteType = 'vocabulary';
                result.expression = field0;
                result.meaning = field1;
                result.reading = field2;
                result.front = field0;
                result.back = field1;
                return result;
            }
        }
        // Standard 2-field format
        if (fields.length >= 2) {
            result.front = fields[0];
            result.back = fields[1];
            result.noteType = 'vocabulary';
        }
        else if (fields.length === 1) {
            result.front = fields[0];
            result.back = fields[0];
        }
        return result;
    };
    /**
     * Detect MIME type from filename extension
     * @param filename - Original Anki filename
     * @returns MIME type string
     */
    AnkiParser.getMimeType = function (filename) {
        var ext = filename.toLowerCase().split('.').pop() || '';
        // Audio formats
        if (ext === 'mp3')
            return 'audio/mpeg';
        if (ext === 'wav')
            return 'audio/wav';
        if (ext === 'ogg')
            return 'audio/ogg';
        if (ext === 'm4a')
            return 'audio/mp4';
        if (ext === 'aac')
            return 'audio/aac';
        if (ext === 'flac')
            return 'audio/flac';
        // Image formats
        if (ext === 'jpg' || ext === 'jpeg')
            return 'image/jpeg';
        if (ext === 'png')
            return 'image/png';
        if (ext === 'gif')
            return 'image/gif';
        if (ext === 'webp')
            return 'image/webp';
        if (ext === 'svg')
            return 'image/svg+xml';
        if (ext === 'bmp')
            return 'image/bmp';
        // Video formats
        if (ext === 'mp4')
            return 'video/mp4';
        if (ext === 'webm')
            return 'video/webm';
        if (ext === 'ogv')
            return 'video/ogg';
        if (ext === 'avi')
            return 'video/x-msvideo';
        if (ext === 'mov')
            return 'video/quicktime';
        // Default to application/octet-stream for unknown types
        console.warn("[AnkiParser] Unknown file extension: ".concat(ext, ", defaulting to application/octet-stream"));
        return 'application/octet-stream';
    };
    return AnkiParser;
}());
exports.AnkiParser = AnkiParser;
