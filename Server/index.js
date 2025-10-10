"use strict";
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts (TypeScript)
require('dotenv').config();
var express_1 = require("express");
var cors_1 = require("cors");
var admin = require("firebase-admin");
var genai_1 = require("@google/genai");
var app = (0, express_1.default)();
var port = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 8000);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '100mb' }));
app.use(express_1.default.urlencoded({ limit: '100mb', extended: true }));
// Firebase init (optional)
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    var serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized.');
}
catch (err) {
    console.warn('Firebase Admin init skipped (serviceAccountKey.json missing or invalid).');
}
// init Gemini client safely
var ai;
try {
    if (process.env.GEMINI_API_KEY) {
        ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        console.log('GoogleGenAI client initialized.');
    }
    else {
        console.warn('GEMINI_API_KEY missing from .env; Gemini client not initialized.');
    }
}
catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
}
// Home / health
app.get('/api', function (req, res) { return res.json({ ok: true }); });
/**
 * POST /api/auth/google
 * body: { idToken: string }
 * Verify Google ID token and create/sign in user
 */
app.post('/api/auth/google', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var idToken, decodedToken, uid, email, name_1, picture, userRecord, error_1, customToken, userData, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 8, , 9]);
                idToken = req.body.idToken;
                if (!idToken || typeof idToken !== 'string') {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            error: 'idToken is required'
                        })];
                }
                return [4 /*yield*/, admin.auth().verifyIdToken(idToken)];
            case 1:
                decodedToken = _a.sent();
                uid = decodedToken.uid, email = decodedToken.email, name_1 = decodedToken.name, picture = decodedToken.picture;
                userRecord = void 0;
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 6]);
                return [4 /*yield*/, admin.auth().getUser(uid)];
            case 3:
                userRecord = _a.sent();
                return [3 /*break*/, 6];
            case 4:
                error_1 = _a.sent();
                return [4 /*yield*/, admin.auth().createUser({
                        uid: uid,
                        email: email,
                        displayName: name_1,
                        photoURL: picture,
                    })];
            case 5:
                // User doesn't exist, create them
                userRecord = _a.sent();
                return [3 /*break*/, 6];
            case 6: return [4 /*yield*/, admin.auth().createCustomToken(uid)];
            case 7:
                customToken = _a.sent();
                userData = {
                    uid: userRecord.uid,
                    email: userRecord.email,
                    firstName: (name_1 === null || name_1 === void 0 ? void 0 : name_1.split(' ')[0]) || '',
                    lastName: (name_1 === null || name_1 === void 0 ? void 0 : name_1.split(' ').slice(1).join(' ')) || '',
                    profilePicture: picture || '',
                    isAuthenticated: true,
                };
                return [2 /*return*/, res.json({
                        success: true,
                        message: 'Authentication successful',
                        data: {
                            user: userData,
                            token: customToken,
                        },
                    })];
            case 8:
                error_2 = _a.sent();
                console.error('Google authentication error:', error_2);
                return [2 /*return*/, res.status(500).json({
                        success: false,
                        error: (error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || 'Authentication failed',
                    })];
            case 9: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/auth/signout
 * headers: { Authorization: 'Bearer <token>' }
 * Sign out user and revoke tokens
 */
app.post('/api/auth/signout', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var authHeader, token, decodedToken, uid, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return [2 /*return*/, res.status(401).json({
                            success: false,
                            error: 'Authorization token required',
                        })];
                }
                token = authHeader.substring(7);
                return [4 /*yield*/, admin.auth().verifyIdToken(token)];
            case 1:
                decodedToken = _a.sent();
                uid = decodedToken.uid;
                // Revoke all refresh tokens for the user
                return [4 /*yield*/, admin.auth().revokeRefreshTokens(uid)];
            case 2:
                // Revoke all refresh tokens for the user
                _a.sent();
                return [2 /*return*/, res.json({
                        success: true,
                        message: 'Sign out successful',
                        data: null,
                    })];
            case 3:
                error_3 = _a.sent();
                console.error('Sign out error:', error_3);
                return [2 /*return*/, res.status(500).json({
                        success: false,
                        error: (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || 'Sign out failed',
                    })];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/auth/verify
 * headers: { Authorization: 'Bearer <token>' }
 * Verify user token and return user data
 */
app.get('/api/auth/verify', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var authHeader, token, decodedToken, uid, userRecord, userData, error_4;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return [2 /*return*/, res.status(401).json({
                            success: false,
                            error: 'Authorization token required',
                        })];
                }
                token = authHeader.substring(7);
                return [4 /*yield*/, admin.auth().verifyIdToken(token)];
            case 1:
                decodedToken = _c.sent();
                uid = decodedToken.uid;
                return [4 /*yield*/, admin.auth().getUser(uid)];
            case 2:
                userRecord = _c.sent();
                userData = {
                    uid: userRecord.uid,
                    email: userRecord.email,
                    firstName: ((_a = userRecord.displayName) === null || _a === void 0 ? void 0 : _a.split(' ')[0]) || '',
                    lastName: ((_b = userRecord.displayName) === null || _b === void 0 ? void 0 : _b.split(' ').slice(1).join(' ')) || '',
                    profilePicture: userRecord.photoURL || '',
                    isAuthenticated: true,
                };
                return [2 /*return*/, res.json({
                        success: true,
                        message: 'Token verified',
                        data: { user: userData },
                    })];
            case 3:
                error_4 = _c.sent();
                console.error('Token verification error:', error_4);
                return [2 /*return*/, res.status(401).json({
                        success: false,
                        error: 'Invalid or expired token',
                    })];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * Middleware to verify authentication for protected routes
 */
function verifyAuth(req, res, next) {
    return __awaiter(this, void 0, void 0, function () {
        var authHeader, token, decodedToken, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    authHeader = req.headers.authorization;
                    if (!authHeader || !authHeader.startsWith('Bearer ')) {
                        return [2 /*return*/, res.status(401).json({
                                success: false,
                                error: 'Authorization token required',
                            })];
                    }
                    token = authHeader.substring(7);
                    return [4 /*yield*/, admin.auth().verifyIdToken(token)];
                case 1:
                    decodedToken = _a.sent();
                    // Add user info to request object
                    req.user = decodedToken;
                    next();
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    return [2 /*return*/, res.status(401).json({
                            success: false,
                            error: 'Invalid or expired token',
                        })];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * POST /api/ask-ai
 * body: { prompt: string, type?: 'text' | 'image', model?: string }
 * Protected route - requires authentication
 */
app.post('/api/ask-ai', verifyAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, prompt_1, _b, type, model, textModel, imageModel, response_1, parts_2, imageBase64, imageUri, altText, _i, parts_1, part, response, parts, text, err_1;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
            case 0:
                if (!ai)
                    return [2 /*return*/, res.status(500).json({ error: 'Gemini client not initialized' })];
                _q.label = 1;
            case 1:
                _q.trys.push([1, 5, , 6]);
                _a = req.body, prompt_1 = _a.prompt, _b = _a.type, type = _b === void 0 ? 'text' : _b, model = _a.model;
                if (!prompt_1 || typeof prompt_1 !== 'string')
                    return [2 /*return*/, res.status(400).json({ error: 'prompt (string) is required' })];
                textModel = model !== null && model !== void 0 ? model : 'gemini-2.5-flash';
                imageModel = model !== null && model !== void 0 ? model : 'gemini-2.5-flash-image-preview';
                if (!(type === 'image')) return [3 /*break*/, 3];
                return [4 /*yield*/, ai.models.generateContent({
                        model: imageModel,
                        contents: [prompt_1],
                    })];
            case 2:
                response_1 = _q.sent();
                parts_2 = (_f = (_e = (_d = (_c = response_1 === null || response_1 === void 0 ? void 0 : response_1.candidates) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.parts) !== null && _f !== void 0 ? _f : [];
                imageBase64 = null;
                imageUri = null;
                altText = null;
                for (_i = 0, parts_1 = parts_2; _i < parts_1.length; _i++) {
                    part = parts_1[_i];
                    if ((_g = part.inlineData) === null || _g === void 0 ? void 0 : _g.data)
                        imageBase64 = part.inlineData.data;
                    if ((_h = part.fileData) === null || _h === void 0 ? void 0 : _h.fileUri)
                        imageUri = part.fileData.fileUri;
                    if (part.text)
                        altText = (_j = part.text) !== null && _j !== void 0 ? _j : altText;
                }
                return [2 /*return*/, res.json({ success: true, imageBase64: imageBase64, imageUri: imageUri, altText: altText, raw: response_1 })];
            case 3: return [4 /*yield*/, ai.models.generateContent({ model: textModel, contents: [prompt_1] })];
            case 4:
                response = _q.sent();
                parts = (_o = (_m = (_l = (_k = response === null || response === void 0 ? void 0 : response.candidates) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.content) === null || _m === void 0 ? void 0 : _m.parts) !== null && _o !== void 0 ? _o : [];
                text = parts.map(function (p) { var _a; return (_a = p.text) !== null && _a !== void 0 ? _a : ''; }).join('');
                return [2 /*return*/, res.json({ success: true, text: text, raw: response })];
            case 5:
                err_1 = _q.sent();
                console.error('ask-ai error:', err_1);
                return [2 /*return*/, res.status(500).json({ success: false, error: (_p = err_1 === null || err_1 === void 0 ? void 0 : err_1.message) !== null && _p !== void 0 ? _p : String(err_1) })];
            case 6: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/process-document
 * body: { fileBase64?: string, filePath?: string, mimeType?: string, prompt?: string }
 * Protected route - requires authentication
 */
app.post('/api/process-document', verifyAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, fileBase64, filePath, clientMime, prompt_2, base64Data, mimeType, fs, buffer, estimatedSizeMB, defaultPrompt, userPrompt, response, extractedText, err_2, errorMessage;
    var _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                if (!ai)
                    return [2 /*return*/, res.status(500).json({ error: 'Gemini process-document client not initialized' })];
                _j.label = 1;
            case 1:
                _j.trys.push([1, 7, , 8]);
                _a = req.body, fileBase64 = _a.fileBase64, filePath = _a.filePath, clientMime = _a.mimeType, prompt_2 = _a.prompt;
                base64Data = '';
                mimeType = clientMime || 'application/pdf';
                if (!(fileBase64 && typeof fileBase64 === 'string')) return [3 /*break*/, 2];
                base64Data = fileBase64;
                return [3 /*break*/, 5];
            case 2:
                if (!(filePath && typeof filePath === 'string')) return [3 /*break*/, 4];
                return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
            case 3:
                fs = _j.sent();
                buffer = fs.readFileSync(filePath);
                base64Data = buffer.toString('base64');
                if (!clientMime) {
                    if (filePath.endsWith('.pdf'))
                        mimeType = 'application/pdf';
                    else if (filePath.endsWith('.docx'))
                        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    else if (filePath.endsWith('.txt'))
                        mimeType = 'text/plain';
                }
                return [3 /*break*/, 5];
            case 4: return [2 /*return*/, res.status(400).json({ error: 'fileBase64 or filePath is required' })];
            case 5:
                estimatedSizeMB = (base64Data.length * 0.75) / (1024 * 1024);
                console.log("Processing document: ~".concat(estimatedSizeMB.toFixed(1), "MB"));
                if (estimatedSizeMB > 20) {
                    console.warn("Large file detected: ".concat(estimatedSizeMB.toFixed(1), "MB - processing may be slow"));
                }
                defaultPrompt = 'Extract all text content from this document. Provide a clean, well-formatted extraction of the text.';
                userPrompt = prompt_2 && typeof prompt_2 === 'string' && prompt_2.trim()
                    ? prompt_2.trim()
                    : defaultPrompt;
                return [4 /*yield*/, ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: [
                            {
                                parts: [
                                    { text: userPrompt },
                                    {
                                        inlineData: {
                                            data: base64Data,
                                            mimeType: mimeType,
                                        },
                                    },
                                ],
                            },
                        ],
                    })];
            case 6:
                response = _j.sent();
                extractedText = (_g = (_f = (_e = (_d = (_c = (_b = response === null || response === void 0 ? void 0 : response.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) !== null && _g !== void 0 ? _g : '';
                return [2 /*return*/, res.json({ success: true, extractedText: extractedText, raw: response })];
            case 7:
                err_2 = _j.sent();
                console.error('process-document error:', err_2);
                errorMessage = (_h = err_2 === null || err_2 === void 0 ? void 0 : err_2.message) !== null && _h !== void 0 ? _h : String(err_2);
                if (errorMessage.includes('payload') || errorMessage.includes('too large')) {
                    errorMessage = 'File too large. Please try a smaller file (under 20MB).';
                }
                else if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
                    errorMessage = 'Processing timeout. Large files may take too long to process.';
                }
                else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
                    errorMessage = 'API quota exceeded. Please try again later or use a smaller file.';
                }
                return [2 /*return*/, res.status(500).json({ success: false, error: errorMessage })];
            case 8: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/edit-image
 * body: { imageBase64: string, editPrompt: string, model?: string }
 * Protected route - requires authentication
 */
app.post('/api/edit-image', verifyAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, imageBase64, editPrompt, model, imageModel, combinedPrompt, response, parts, newImageBase64, imageUri, altText, _i, parts_3, part, err_3;
    var _b, _c, _d, _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                if (!ai)
                    return [2 /*return*/, res.status(500).json({ error: 'Gemini client not initialized' })];
                _k.label = 1;
            case 1:
                _k.trys.push([1, 3, , 4]);
                _a = req.body, imageBase64 = _a.imageBase64, editPrompt = _a.editPrompt, model = _a.model;
                if (!imageBase64 || typeof imageBase64 !== 'string') {
                    return [2 /*return*/, res.status(400).json({ error: 'imageBase64 (string) is required' })];
                }
                if (!editPrompt || typeof editPrompt !== 'string') {
                    return [2 /*return*/, res.status(400).json({ error: 'editPrompt (string) is required' })];
                }
                imageModel = model !== null && model !== void 0 ? model : 'gemini-2.5-flash-image-preview';
                combinedPrompt = "Edit this image based on the following instruction: ".concat(editPrompt, ". Generate a new version of the image with the requested modifications.");
                return [4 /*yield*/, ai.models.generateContent({
                        model: imageModel,
                        contents: [
                            {
                                parts: [
                                    { text: combinedPrompt },
                                    {
                                        inlineData: {
                                            data: imageBase64,
                                            mimeType: 'image/png',
                                        },
                                    },
                                ],
                            },
                        ],
                    })];
            case 2:
                response = _k.sent();
                parts = (_e = (_d = (_c = (_b = response === null || response === void 0 ? void 0 : response.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) !== null && _e !== void 0 ? _e : [];
                newImageBase64 = null;
                imageUri = null;
                altText = null;
                for (_i = 0, parts_3 = parts; _i < parts_3.length; _i++) {
                    part = parts_3[_i];
                    if ((_f = part.inlineData) === null || _f === void 0 ? void 0 : _f.data)
                        newImageBase64 = part.inlineData.data;
                    if ((_g = part.fileData) === null || _g === void 0 ? void 0 : _g.fileUri)
                        imageUri = part.fileData.fileUri;
                    if (part.text)
                        altText = (_h = part.text) !== null && _h !== void 0 ? _h : altText;
                }
                return [2 /*return*/, res.json({ success: true, imageBase64: newImageBase64, imageUri: imageUri, altText: altText, raw: response })];
            case 3:
                err_3 = _k.sent();
                console.error('edit-image error:', err_3);
                return [2 /*return*/, res.status(500).json({ success: false, error: (_j = err_3 === null || err_3 === void 0 ? void 0 : err_3.message) !== null && _j !== void 0 ? _j : String(err_3) })];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/edit-image-with-mask
 * body: { imageBase64: string, maskBase64: string, editPrompt: string, model?: string }
 * Protected route - requires authentication
 */
app.post('/api/edit-image-with-mask', verifyAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, imageBase64, maskBase64, editPrompt, model, imageModel, combinedPrompt, response, parts, newImageBase64, imageUri, altText, _i, parts_4, part, err_4;
    var _b, _c, _d, _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                if (!ai)
                    return [2 /*return*/, res.status(500).json({ error: 'Gemini client not initialized' })];
                _k.label = 1;
            case 1:
                _k.trys.push([1, 3, , 4]);
                _a = req.body, imageBase64 = _a.imageBase64, maskBase64 = _a.maskBase64, editPrompt = _a.editPrompt, model = _a.model;
                if (!imageBase64 || typeof imageBase64 !== 'string') {
                    return [2 /*return*/, res.status(400).json({ error: 'imageBase64 (string) is required' })];
                }
                if (!maskBase64 || typeof maskBase64 !== 'string') {
                    return [2 /*return*/, res.status(400).json({ error: 'maskBase64 (string) is required' })];
                }
                if (!editPrompt || typeof editPrompt !== 'string') {
                    return [2 /*return*/, res.status(400).json({ error: 'editPrompt (string) is required' })];
                }
                imageModel = model !== null && model !== void 0 ? model : 'gemini-2.5-flash-image';
                combinedPrompt = "You are editing an image with marked areas. The first image is the original, and the second image shows the marked areas (colored markings) that need to be edited.\n\nInstructions:\n- Focus your edits ONLY on the marked/colored areas in the mask image\n- Leave unmarked areas unchanged\n- Apply this edit to the marked areas: ".concat(editPrompt, "\n- Generate a new version of the original image with only the marked areas modified\n\nOriginal image and marking mask are provided below.");
                return [4 /*yield*/, ai.models.generateContent({
                        model: imageModel,
                        contents: [
                            {
                                parts: [
                                    { text: combinedPrompt },
                                    {
                                        inlineData: {
                                            data: imageBase64,
                                            mimeType: 'image/png',
                                        },
                                    },
                                    {
                                        inlineData: {
                                            data: maskBase64,
                                            mimeType: 'image/png',
                                        },
                                    },
                                ],
                            },
                        ],
                    })];
            case 2:
                response = _k.sent();
                parts = (_e = (_d = (_c = (_b = response === null || response === void 0 ? void 0 : response.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) !== null && _e !== void 0 ? _e : [];
                newImageBase64 = null;
                imageUri = null;
                altText = null;
                for (_i = 0, parts_4 = parts; _i < parts_4.length; _i++) {
                    part = parts_4[_i];
                    if ((_f = part.inlineData) === null || _f === void 0 ? void 0 : _f.data)
                        newImageBase64 = part.inlineData.data;
                    if ((_g = part.fileData) === null || _g === void 0 ? void 0 : _g.fileUri)
                        imageUri = part.fileData.fileUri;
                    if (part.text)
                        altText = (_h = part.text) !== null && _h !== void 0 ? _h : altText;
                }
                return [2 /*return*/, res.json({ success: true, imageBase64: newImageBase64, imageUri: imageUri, altText: altText, raw: response })];
            case 3:
                err_4 = _k.sent();
                console.error('edit-image-with-mask error:', err_4);
                return [2 /*return*/, res.status(500).json({ success: false, error: (_j = err_4 === null || err_4 === void 0 ? void 0 : err_4.message) !== null && _j !== void 0 ? _j : String(err_4) })];
            case 4: return [2 /*return*/];
        }
    });
}); });
app.listen(port, function () {
    console.log("Server listening on http://localhost:".concat(port));
});
