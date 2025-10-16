// server.ts (TypeScript)
require('dotenv').config();
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import type { Part } from '@google/genai';
import { getEmbeddingService, MemoryItem, SearchResult } from './services/embeddingService';
import { getHybridMemoryService } from './services/hybridMemoryService';
import { extractDocumentTopics } from './services/conversationService';
import * as userProfileService from './services/userProfileService';

// Import performance optimizations with error handling
let profileCache: any;
let recentContextCache: any;
let needsMemorySearch: any;
let determineMemoryStrategy: any;
let preloadMemoryForNextQuery: any;
let getPerformanceStats: any;

try {
  const perfOptimizations = require('./services/performanceOptimizations');
  profileCache = perfOptimizations.profileCache;
  recentContextCache = perfOptimizations.recentContextCache;
  needsMemorySearch = perfOptimizations.needsMemorySearch;
  determineMemoryStrategy = perfOptimizations.determineMemoryStrategy;
  preloadMemoryForNextQuery = perfOptimizations.preloadMemoryForNextQuery;
  getPerformanceStats = perfOptimizations.getPerformanceStats;
  console.log('✅ Performance optimizations loaded successfully');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load performance optimizations:', error);
  console.error('Stack:', (error as Error).stack);
  // Provide fallbacks
  profileCache = { get: () => undefined, set: () => {}, clear: () => {}, getStats: () => ({}) };
  recentContextCache = { get: () => undefined, set: () => {}, clear: () => {}, getStats: () => ({}) };
  needsMemorySearch = () => true;
  determineMemoryStrategy = () => 'profile-only';
  preloadMemoryForNextQuery = async () => {};
  getPerformanceStats = () => ({});
  console.log('⚠️ Using fallback implementations for performance optimizations');
}

const app = express();
const port = Number(process.env.PORT ?? 8000);

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// init Gemini client safely
let ai: GoogleGenAI | undefined;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('GoogleGenAI client initialized.');
  } else {
    console.warn('GEMINI_API_KEY missing from .env; Gemini client not initialized.');
  }
} catch (err) {
  console.error('Failed to initialize GoogleGenAI client:', err);
}

// Home / health
app.get('/api', (req, res) => res.json({ ok: true }));

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // Don't exit - keep server running
});

/**
 * POST /api/ask-ai
 * body: { prompt: string, type?: 'text' | 'image', model?: string, useMemory?: boolean, userId?: string }
 */
app.post('/api/ask-ai', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini client not initialized' });

  try {
    console.log('📥 Request received at /api/ask-ai');
    const { prompt, type = 'text', model, useMemory = true, userId, chatId, messageCount, userName, conversationHistory } = req.body;
    console.log('📦 Request body parsed successfully');
    
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt (string) is required' });

    // For testing purposes, use anoop123 if no userId provided
    const effectiveUserId = userId || 'anoop123';
    const effectiveChatId = chatId; // 🎯 NEW! Get chatId from request
    const effectiveMessageCount = messageCount !== undefined ? messageCount : undefined; // 🎯 NEW! Track message count
    
    // 🎯 AUTO-CREATE PROFILE: If user doesn't have a profile yet, create one with their name
    if (effectiveUserId && userName) {
      const existingProfile = userProfileService.getUserProfile(effectiveUserId);
      if (!existingProfile) {
        userProfileService.upsertUserProfile(effectiveUserId, {
          name: userName
        });
        console.log(`✅ Auto-created profile for ${effectiveUserId} (name: ${userName})`);
      }
    }
    
    console.log(`💬 Chat request - User: ${effectiveUserId}, Chat: ${effectiveChatId || 'none'}, Message#: ${effectiveMessageCount !== undefined ? effectiveMessageCount + 1 : '?'}, History: ${conversationHistory?.length || 0} msgs, Memory: ${useMemory}, Prompt: "${prompt.substring(0, 50)}..."`);

    let enhancedPrompt = prompt;

    // Smart memory search decision - determine search depth based on query complexity
    const determineSearchStrategy = (query: string, messageCount: number): 'full' | 'profile-only' | 'skip' => {
      const queryLower = query.toLowerCase().trim();
      
      // 1. For greetings, use profile-only (so AI can greet by name!)
      const greetingPatterns = [
        /^(hi|hello|hey|sup|yo|greetings|morning|afternoon|evening)$/i,
        /^(hi|hello|hey|sup|yo|greetings|morning|afternoon|evening)\s/i, // With extra text
      ];
      if (greetingPatterns.some(pattern => pattern.test(queryLower))) {
        // Use profile for first few messages (greeting) - messageCount can be 0, 1, or 2
        if (messageCount <= 2) {
          return 'profile-only';
        }
        // Skip for subsequent greetings
        return 'skip';
      }
      
      // 2. Skip simple acknowledgments
      const skipPatterns = [
        /^(thanks|thank you|thx|ty)$/i,
        /^(yes|no|yep|nope|yeah|nah)$/i
      ];
      if (skipPatterns.some(pattern => pattern.test(queryLower))) {
        return 'skip';
      }
      
      // 3. ALWAYS do full search if user explicitly references memory/past
      const memoryKeywords = [
        'remember', 'recall', 'earlier', 'before', 'previous',
        'last time', 'we discussed', 'you said', 'you told',
        'conversation', 'history', 'ago', 'yesterday'
      ];
      if (memoryKeywords.some(kw => queryLower.includes(kw))) {
        return 'full';
      }
      
      // 4. For short personal questions (name, preferences, etc), use profile only
      const personalKeywords = [
        'my name', 'who am i', 'what\'s my', 'whats my',
        'do you know me', 'about me', 'i work', 'i like',
        'my preference', 'my favorite', 'my role'
      ];
      if (query.length < 30 && personalKeywords.some(kw => queryLower.includes(kw))) {
        return 'profile-only';
      }
      
      // 5. For longer queries or complex questions, do full search
      if (query.length >= 30) {
        return 'full';
      }
      
      // 6. Medium queries - use profile only (lightweight)
      return 'profile-only';
    };

    // Use memory system based on search strategy
    if (useMemory && type === 'text') {
      // ⚡ OPTIMIZATION: Use smart strategy determination
      const memoryStrategy = determineMemoryStrategy(prompt, effectiveMessageCount || 0);
      console.log(`🎯 Memory strategy selected: ${memoryStrategy}`);
      
      let strategy: 'full' | 'profile-only' | 'skip' = 'profile-only';
      
      if (memoryStrategy === 'none') {
        strategy = 'skip';
      } else if (memoryStrategy === 'search') {
        strategy = 'full';
      } else if (memoryStrategy === 'cache' && effectiveChatId) {
        // Try to use cached context first
        const cachedTurns = recentContextCache.get(effectiveUserId, effectiveChatId);
        if (cachedTurns && Array.isArray(cachedTurns) && cachedTurns.length > 0) {
          console.log(`⚡ Using cached context (${cachedTurns.length} turns) - instant retrieval!`);
          // Build prompt from cached turns
          const contextText = cachedTurns.map((turn: any) => 
            `User: ${turn.userMessage}\nAssistant: ${turn.aiResponse}`
          ).join('\n\n');
          
          enhancedPrompt = `SYSTEM: You are NubiqAI ✨

RECENT CONVERSATION:
${contextText}

USER QUESTION:
${prompt}

Respond naturally.`;
          
          strategy = 'skip'; // Skip full memory search
        } else {
          strategy = 'profile-only'; // Fall back to profile
        }
      }
      
      const originalStrategy = determineSearchStrategy(prompt, effectiveMessageCount || 0);
      
      if (strategy === 'skip') {
        console.log('⏭️ Skipping memory - simple greeting/acknowledgment');
      } else if (strategy === 'profile-only') {
        // Lightweight: Only use user profile (no expensive searches)
        console.log('👤 Using profile-only memory (lightweight) for user:', effectiveUserId);
        try {
          // ⚡ OPTIMIZATION: Check cache first
          let profileContextCached = profileCache.get(effectiveUserId);
          let profileContext: string | null = null;
          
          if (profileContextCached === undefined) {
            // Cache miss - fetch from service
            console.log('📥 Profile cache miss - fetching from service');
            profileContext = userProfileService.generateProfileContext(effectiveUserId);
            // Cache the profile object for future use
            const profile = userProfileService.getUserProfile(effectiveUserId);
            profileCache.set(effectiveUserId, profile);
          } else {
            console.log('⚡ Profile cache hit - instant retrieval!');
            // Generate context from cached profile
            profileContext = profileContextCached ? userProfileService.generateProfileContext(effectiveUserId) : null;
          }
          
          if (profileContext) {
            enhancedPrompt = `SYSTEM: You are NubiqAI ✨ - an intelligent assistant with persistent memory.

⚠️ CRITICAL: NEVER use # ## ### or * symbols in your response!

🎯 CORRECT FORMAT:
Write naturally with emojis at the start of sections
Use 1️⃣ 2️⃣ 3️⃣ for numbered lists
Use ✅ for list items, NOT asterisks
Add blank lines between topics

${'='.repeat(60)}
👤 USER PROFILE:
${profileContext}
${'='.repeat(60)}

💬 CURRENT USER QUESTION:
${prompt}

🎨 Respond using ONLY emojis and natural text. NO markdown symbols!`;
            
            console.log('✅ Enhanced prompt with user profile context');
          } else {
            console.log('❌ No user profile found for', effectiveUserId);
          }
        } catch (error) {
          console.warn('⚠️ Profile lookup failed:', error);
        }
      } else {
        // Full search: Use hybrid memory (local + Pinecone + profile)
        try {
          const hybridMemoryService = getHybridMemoryService();
          console.log(`🧠 Using full hybrid memory search for user: ${effectiveUserId}${effectiveChatId ? `, chat: ${effectiveChatId}` : ''}`);
          
          const memoryResult = await hybridMemoryService.searchMemory(
            effectiveUserId, 
            prompt,
            effectiveChatId,
            effectiveMessageCount,
            {
              maxLocalResults: 3,
              maxLongTermResults: 1, // ⚡ OPTIMIZED: Reduced from 2 to 1 (saves 100-200ms)
              localWeight: 0.8,
              threshold: 0.35, // ⚡ OPTIMIZED: Slightly higher threshold (faster, more relevant)
              skipPineconeIfLocalFound: true,
              minLocalResultsForSkip: 2
            }
          );

          console.log(`🧠 Memory search results - Type: ${memoryResult.type}, Local: ${memoryResult.resultCount.local}, Long-term: ${memoryResult.resultCount.longTerm}`);
          
          if (memoryResult.optimization?.skippedPinecone) {
            console.log(`💰 Cost optimization: ${memoryResult.optimization.reason}`);
          }
          
          if (memoryResult.combinedContext && memoryResult.combinedContext !== 'No relevant conversation history found.') {
            enhancedPrompt = `SYSTEM: You are NubiqAI ✨ - an intelligent, helpful assistant with persistent memory and excellent communication skills.

⚠️ CRITICAL FORMATTING RULES - READ CAREFULLY:

🚫 NEVER EVER USE THESE SYMBOLS:
DO NOT use # or ## or ### for headers
DO NOT use * or ** for bold or bullets  
DO NOT use - for lists
DO NOT use markdown syntax at all
These symbols make responses look technical and ugly!

✅ INSTEAD USE THIS FORMAT:

For lists, write like this:
"🎯 Main Topic

✅ First point - explanation here
✅ Second point - explanation here  
✅ Third point - explanation here"

For sections, write like this:
"💡 Important Information

Here is the explanation in natural sentences. Use emojis to mark important points ✅ or warnings ⚠️ within the text itself.

🚀 Next Section

More content here with emojis naturally integrated into the text flow."

For steps, write like this:
"🎯 How to Do Something

1️⃣ First do this - clear explanation
2️⃣ Then do this - more details
3️⃣ Finally do this - wrap up"

🎯 YOUR CORE CAPABILITIES:
🧠 Access to conversation history and user profile information
💭 Remember past conversations and reference them naturally
📝 Provide well-structured, visually appealing responses
🤝 Confident, friendly, and professional communication
🎨 Creative use of emojis for better readability

💬 WRITING STYLE:
Write in natural, flowing sentences
Use emojis at the START of new ideas, not as bullets
Add blank lines between different topics
Keep paragraphs short (2-3 sentences)
Be warm, friendly, and conversational 😊

🎭 EMOJI USAGE (use strategically):
Sections: �, �, ⚡, �, �, �, 🌟
Lists: ✅, ▶️, �, ⭐
Steps: 1️⃣, 2️⃣, 3️⃣, 4️⃣, 5️⃣
Important: ⚠️, 🔥, �, 🎯
Tips: 💡, 🎓, ⭐
Positive: ✅, 🎉, �, �
Questions: ❓, 🤔, �

🚫 ABSOLUTELY FORBIDDEN:
### Headers like this
** Bold like this **
* Bullet points like this
- List items like this
Any markdown syntax

✅ CORRECT EXAMPLES:

Example 1:
"Hey there! 👋

🎯 Coffee Making Guide

Making great coffee is easy! Let me show you three popular methods.

☕ Drip Coffee Machine

1️⃣ Add filter to the basket
2️⃣ Add 2 tablespoons of ground coffee per 6 ounces of water
3️⃣ Pour cold water into the reservoir
4️⃣ Turn it on and wait for the magic! ✨

🇫🇷 French Press

1️⃣ Add coarse-ground coffee to the press
2️⃣ Pour hot water (around 200°F)
3️⃣ Let it steep for 4 minutes
4️⃣ Press down slowly and pour

💡 Pro Tip: Always use fresh, cold filtered water for the best taste!

Which method sounds good to you? 😊"

Example 2:
"🎯 Five Productivity Tips

Here are some game-changing strategies:

1️⃣ Time Blocking
Schedule specific tasks in your calendar. This keeps you focused and prevents multitasking chaos!

2️⃣ Pomodoro Technique  
Work for 25 minutes, then take a 5-minute break. Your brain will thank you! ⏰

3️⃣ Single-Tasking
Focus on ONE thing at a time. Studies show multitasking kills productivity by 40%!

4️⃣ Morning Routine
Tackle your hardest task first thing. Your willpower is strongest in the AM! 🌅

5️⃣ Regular Breaks
Step away every hour. Movement and fresh air reset your mind.

Which tip will you try first? 🚀"

❌ WRONG EXAMPLES (NEVER DO THIS):

### This is wrong - no hashtags!
** This is wrong - no asterisks! **
* This is wrong - no bullet symbols!
- This is wrong - no dashes!

${'='.repeat(60)}
🧠 CONVERSATION HISTORY & USER PROFILE:
${memoryResult.combinedContext}
${'='.repeat(60)}

💬 CURRENT USER QUESTION:
${prompt}

🎨 NOW RESPOND: Use the correct format shown above. Natural language with emojis. NO # or * symbols. Make it visually beautiful and easy to read!`;
            
            console.log(`✅ Enhanced prompt with ${memoryResult.type} memory context + structured response instructions`);
          } else {
            console.log(`❌ No relevant memory context found for user ${effectiveUserId}`);
          }
        } catch (memoryError) {
          console.warn('⚠️ Hybrid memory search failed, proceeding without memory context:', memoryError);
        }
      }
    }

    // 💬 Add conversation history from current chat for context continuity
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory.map((msg: any) => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n\n');
      
      enhancedPrompt = `CONVERSATION SO FAR IN THIS CHAT:
${'='.repeat(60)}
${historyText}
${'='.repeat(60)}

${enhancedPrompt}

Remember: The conversation above is from the CURRENT chat session. Use it to maintain context and continuity in your responses.`;
      
      console.log(`💬 Added ${conversationHistory.length} messages from current conversation for context`);
    } else if (!enhancedPrompt.includes('SYSTEM:')) {
      // If no memory context and no conversation history, add base structured prompt
      enhancedPrompt = `SYSTEM: You are NubiqAI ✨ - an intelligent, helpful assistant.

⚠️ CRITICAL FORMATTING RULE:
NEVER use # ## ### or * - symbols in your responses!
These are forbidden markdown symbols.

✅ CORRECT FORMAT EXAMPLES:

For sections:
"🎯 Topic Name

Explanation in natural sentences here.

💡 Another Topic

More content here."

For lists:
"✅ First point - details
✅ Second point - details
✅ Third point - details"

For steps:
"1️⃣ Do this first
2️⃣ Then do this
3️⃣ Finally this"

USER QUESTION:
${prompt}

� Respond using ONLY emojis and natural language. NO # or * symbols!`;
      console.log(`📋 Using base structured response prompt`);
    }

    const textModel = model ?? 'gemini-2.5-flash';
    const imageModel = model ?? 'gemini-2.5-flash-image';

    if (type === 'image') {
      // For image generation, use the ORIGINAL prompt, not the enhanced text prompt
      // Image models don't need system instructions or memory context
      console.log(`🎨 Generating image with prompt: "${prompt.substring(0, 100)}..."`);
      
      const response = await ai.models.generateContent({
        model: imageModel,
        contents: [prompt], // Use original prompt, not enhancedPrompt
      });

      const parts: Part[] = response?.candidates?.[0]?.content?.parts ?? [];
      let imageBase64: string | null = null;
      let imageUri: string | null = null;
      let altText: string | null = null;

      console.log(`📦 Received ${parts.length} parts from Gemini`);
      
      for (const part of parts) {
        // Log what we find in each part
        if ((part as any).inlineData) {
          console.log(`📸 Found inlineData - mimeType: ${(part as any).inlineData.mimeType}, data length: ${(part as any).inlineData.data?.length || 0}`);
          imageBase64 = (part as any).inlineData.data;
        }
        if ((part as any).fileData) {
          console.log(`📁 Found fileData - URI: ${(part as any).fileData.fileUri}`);
          imageUri = (part as any).fileData.fileUri;
        }
        if ((part as any).text) {
          console.log(`📝 Found text: ${(part as any).text.substring(0, 100)}`);
          altText = (part as any).text ?? altText;
        }
      }

      if (imageBase64) {
        console.log(`✅ Image generated successfully - base64 data (${imageBase64.length} chars)`);
      } else if (imageUri) {
        console.log(`✅ Image generated successfully - URI: ${imageUri}`);
      } else {
        console.error(`❌ No image data found in response!`);
      }
      
      return res.json({ success: true, imageBase64, imageUri, altText, raw: response });
    }

    // TEXT
    const response = await ai.models.generateContent({ 
      model: textModel, 
      contents: [enhancedPrompt] 
    });
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => p.text ?? '').join('');

    console.log(`✅ AI response generated (${text.length} chars) - sending to user immediately...`);

    // ═══════════════════════════════════════════════════════════════════════
    // 🚀 CRITICAL: Send response to user FIRST (don't make them wait!)
    // ═══════════════════════════════════════════════════════════════════════
    const jsonResponse = { success: true, text, raw: response };
    res.json(jsonResponse);
    console.log(`📤 Response sent to user!`);

    // ═══════════════════════════════════════════════════════════════════════
    // 💾 LIGHTWEIGHT: Store in local memory only (no Pinecone, super fast!)
    // Pinecone upload happens only when user switches chats (see /api/end-chat endpoint)
    // ═══════════════════════════════════════════════════════════════════════
    if (useMemory && text && effectiveUserId) {
      setImmediate(() => {
        try {
          const hybridMemoryService = getHybridMemoryService();
          
          // Store in local memory only (in-memory, instant)
          const conversationTurn = hybridMemoryService.storeConversationTurn(
            effectiveUserId,
            prompt,
            text,
            effectiveChatId
          );
          
          console.log(`💬 [BACKGROUND] Stored turn in session (chat: ${effectiveChatId}): "${prompt.substring(0, 50)}..."`);
          
          // ⚡ OPTIMIZATION: Preload memory for next query
          if (effectiveChatId) {
            preloadMemoryForNextQuery(effectiveUserId, effectiveChatId, hybridMemoryService)
              .catch((err: any) => console.warn('Preload failed:', err));
          }
        } catch (memoryError) {
          console.error('❌ [BACKGROUND] Failed to store conversation turn:', memoryError);
        }
      });
    }

    // Return is not needed as response already sent
    return;

  } catch (err: any) {
    console.error('❌ FATAL ERROR in /api/ask-ai:', err);
    console.error('❌ Error stack:', err?.stack);
    console.error('❌ Error name:', err?.name);
    console.error('❌ Error message:', err?.message);
    
    // Don't let the server crash - always return a response
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false, 
        error: err?.message ?? String(err),
        details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      });
    }
  }
});

/**
 * POST /api/process-document
 * body: { fileBase64?: string, filePath?: string, mimeType?: string, prompt?: string }
 */
app.post('/api/process-document', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini process-document client not initialized' });

  try {
    const { fileBase64, filePath, mimeType: clientMime, prompt } = req.body;

    let base64Data = '';
    let mimeType = clientMime || 'application/pdf';

    if (fileBase64 && typeof fileBase64 === 'string') {
      base64Data = fileBase64;
    } else if (filePath && typeof filePath === 'string') {
      const fs = await import('fs');
      const buffer = fs.readFileSync(filePath);
      base64Data = buffer.toString('base64');
      if (!clientMime) {
        if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (filePath.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (filePath.endsWith('.txt')) mimeType = 'text/plain';
      }
    } else {
      return res.status(400).json({ error: 'fileBase64 or filePath is required' });
    }

    // Check file size (base64 encoded size estimation)
    const estimatedSizeMB = (base64Data.length * 0.75) / (1024 * 1024); // Convert from base64 to actual size
    console.log(`Processing document: ~${estimatedSizeMB.toFixed(1)}MB`);
    
    if (estimatedSizeMB > 20) {
      console.warn(`Large file detected: ${estimatedSizeMB.toFixed(1)}MB - processing may be slow`);
    }

    // Use Gemini for document processing
    const defaultPrompt = 'Extract all text content from this document. Provide a clean, well-formatted extraction of the text.';
    const userPrompt = prompt && typeof prompt === 'string' && prompt.trim() 
      ? prompt.trim() 
      : defaultPrompt;

    const response = await ai.models.generateContent({
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
    });

    const extractedText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Optionally store the processed document in memory
    const { storeInMemory = false, userId } = req.body;
    if (storeInMemory && extractedText && userId) {
      try {
        // Extract topics from document content using AI
        const documentTopics = await extractDocumentTopics(extractedText);
        console.log(`📊 Extracted document topics: ${documentTopics.join(', ')}`);
        
        const embeddingService = getEmbeddingService();
        const documentMemory: MemoryItem = {
          id: `document_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: extractedText,
          metadata: {
            timestamp: Date.now(),
            type: 'document',
            source: filePath || 'uploaded-file',
            userId,
            tags: ['processed-document', mimeType, ...documentTopics]
          }
        };
        
        // Store asynchronously without blocking the response
        embeddingService.storeMemory(documentMemory).catch(err => 
          console.error('Failed to store document memory:', err)
        );
        
        console.log('Document content stored in memory for future reference');
      } catch (memoryError) {
        console.warn('Failed to store document in memory:', memoryError);
      }
    }

    return res.json({ success: true, extractedText, raw: response });

  } catch (err: any) {
    console.error('process-document error:', err);

    // Provide more specific error messages for common large file issues
    let errorMessage = err?.message ?? String(err);
    if (errorMessage.includes('payload') || errorMessage.includes('too large')) {
      errorMessage = 'File too large. Please try a smaller file (under 20MB).';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
      errorMessage = 'Processing timeout. Large files may take too long to process.';
    } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      errorMessage = 'API quota exceeded. Please try again later or use a smaller file.';
    }

    return res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * POST /api/edit-image
 * body: { imageBase64: string, editPrompt: string, model?: string }
 */
app.post('/api/edit-image', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini client not initialized' });

  try {
    const { imageBase64, editPrompt, model } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 (string) is required' });
    }
    if (!editPrompt || typeof editPrompt !== 'string') {
      return res.status(400).json({ error: 'editPrompt (string) is required' });
    }

    // NOTE: Gemini's image models (gemini-2.5-flash-image) only GENERATE new images, they don't edit existing ones
    // For "editing", we'll use the vision model to analyze the image and generate a new one based on the edit instruction
    
    // Step 1: Use vision model to describe the image
    const visionModel = 'gemini-2.5-flash';
    const descriptionResponse = await ai.models.generateContent({
      model: visionModel,
      contents: [
        {
          parts: [
            { text: 'Describe this image in detail, focusing on all visual elements, style, colors, composition, and mood.' },
            {
              inlineData: {
                data: imageBase64,
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });

    const imageDescription = descriptionResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 'an image';

    // Step 2: Generate a new image based on the description + edit instruction
    const imageModel = model ?? 'gemini-2.5-flash-image';
    const combinedPrompt = `Based on this description: "${imageDescription}"

Apply this edit: ${editPrompt}

Generate a new image that matches the original description but with the requested edits applied.`;

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: [combinedPrompt],
    });

    const parts: Part[] = response?.candidates?.[0]?.content?.parts ?? [];
    let newImageBase64: string | null = null;
    let imageUri: string | null = null;
    let altText: string | null = null;

    for (const part of parts) {
      if ((part as any).inlineData?.data) newImageBase64 = (part as any).inlineData.data;
      if ((part as any).fileData?.fileUri) imageUri = (part as any).fileData.fileUri;
      if ((part as any).text) altText = (part as any).text ?? altText;
    }

    return res.json({ success: true, imageBase64: newImageBase64, imageUri, altText, raw: response });

  } catch (err: any) {
    console.error('edit-image error:', err);
    return res.status(500).json({ success: false, error: err?.message ?? String(err) });
  }
});

/**
 * POST /api/edit-image-with-mask
 * body: { imageBase64: string, maskBase64: string, editPrompt: string, model?: string }
 */
app.post('/api/edit-image-with-mask', async (req, res) => {
  if (!ai) return res.status(500).json({ error: 'Gemini client not initialized' });

  try {
    const { imageBase64, maskBase64, editPrompt, model } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 (string) is required' });
    }
    if (!maskBase64 || typeof maskBase64 !== 'string') {
      return res.status(400).json({ error: 'maskBase64 (string) is required' });
    }
    if (!editPrompt || typeof editPrompt !== 'string') {
      return res.status(400).json({ error: 'editPrompt (string) is required' });
    }

    // NOTE: Gemini doesn't support true mask-based editing like Stable Diffusion inpainting
    // For mask-based editing, we'll use vision model to analyze BOTH images and generate a new one
    
    // Step 1: Describe the original image
    const visionModel = 'gemini-2.5-flash';
    const descriptionResponse = await ai.models.generateContent({
      model: visionModel,
      contents: [
        {
          parts: [
            { text: 'Describe this image in detail.' },
            {
              inlineData: {
                data: imageBase64,
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });

    const imageDescription = descriptionResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 'an image';

    // Step 2: Analyze the mask to understand what areas to edit
    const maskResponse = await ai.models.generateContent({
      model: visionModel,
      contents: [
        {
          parts: [
            { text: 'Describe the colored/marked areas in this mask image. Where are they located and what parts of the image do they cover?' },
            {
              inlineData: {
                data: maskBase64,
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });

    const maskDescription = maskResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 'marked areas';

    // Step 3: Generate new image with edits applied to masked areas
    const imageModel = model ?? 'gemini-2.5-flash-image';
    const combinedPrompt = `Original image: ${imageDescription}

Masked areas to edit: ${maskDescription}

Edit instruction for the masked areas ONLY: ${editPrompt}

Generate a new version of the image with the edit applied ONLY to the masked areas. Keep everything else the same as the original.`;

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: [combinedPrompt],
    });

    const parts: Part[] = response?.candidates?.[0]?.content?.parts ?? [];
    let newImageBase64: string | null = null;
    let imageUri: string | null = null;
    let altText: string | null = null;

    for (const part of parts) {
      if ((part as any).inlineData?.data) newImageBase64 = (part as any).inlineData.data;
      if ((part as any).fileData?.fileUri) imageUri = (part as any).fileData.fileUri;
      if ((part as any).text) altText = (part as any).text ?? altText;
    }

    return res.json({ success: true, imageBase64: newImageBase64, imageUri, altText, raw: response });

  } catch (err: any) {
    console.error('edit-image-with-mask error:', err);
    return res.status(500).json({ success: false, error: err?.message ?? String(err) });
  }
});

/**
 * POST /api/store-memory
 * body: { content: string, type?: 'conversation' | 'document' | 'note', source?: string, userId?: string, tags?: string[] }
 */
app.post('/api/store-memory', async (req, res) => {
  try {
    const { content, type = 'note', source, userId, tags } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content (string) is required' });
    }

    const embeddingService = getEmbeddingService();
    
    const memoryItem: MemoryItem = {
      id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      metadata: {
        timestamp: Date.now(),
        type,
        source,
        userId,
        tags
      }
    };

    await embeddingService.storeMemory(memoryItem);

    return res.json({ 
      success: true, 
      message: 'Memory stored successfully',
      memoryId: memoryItem.id 
    });

  } catch (err: any) {
    console.error('store-memory error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * POST /api/store-memories
 * body: { memories: Array<{ content: string, type?: string, source?: string, userId?: string, tags?: string[] }> }
 */
app.post('/api/store-memories', async (req, res) => {
  try {
    const { memories } = req.body;

    if (!Array.isArray(memories) || memories.length === 0) {
      return res.status(400).json({ error: 'memories (array) is required and cannot be empty' });
    }

    const embeddingService = getEmbeddingService();
    
    const memoryItems: MemoryItem[] = memories.map((memory, index) => ({
      id: `batch_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      content: memory.content,
      metadata: {
        timestamp: Date.now(),
        type: memory.type || 'note',
        source: memory.source,
        userId: memory.userId,
        tags: memory.tags
      }
    }));

    await embeddingService.storeMemories(memoryItems);

    return res.json({ 
      success: true, 
      message: `${memoryItems.length} memories stored successfully`,
      memoryIds: memoryItems.map(item => item.id)
    });

  } catch (err: any) {
    console.error('store-memories error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * POST /api/search-memory
 * body: { query: string, topK?: number, threshold?: number, userId?: string, type?: string }
 */
app.post('/api/search-memory', async (req, res) => {
  try {
    const { query, topK = 5, threshold = 0.7, userId, type } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query (string) is required' });
    }

    const embeddingService = getEmbeddingService();
    
    // Build filter based on optional parameters
    const filter: Record<string, any> = {};
    if (type) filter.type = type;

    const results = await embeddingService.searchMemories(query, {
      topK,
      threshold,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      userId
    });

    return res.json({ 
      success: true, 
      query,
      results,
      count: results.length
    });

  } catch (err: any) {
    console.error('search-memory error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * DELETE /api/memory/:id
 * Delete a specific memory by ID
 */
app.delete('/api/memory/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Memory ID is required' });
    }

    const embeddingService = getEmbeddingService();
    await embeddingService.deleteMemory(id);

    return res.json({ 
      success: true, 
      message: 'Memory deleted successfully' 
    });

  } catch (err: any) {
    console.error('delete-memory error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * GET /api/memory-stats
 * Get memory statistics
 */
app.get('/api/memory-stats', async (req, res) => {
  try {
    const embeddingService = getEmbeddingService();
    const stats = await embeddingService.getMemoryStats();

    return res.json({ 
      success: true, 
      stats 
    });

  } catch (err: any) {
    console.error('memory-stats error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * GET /api/debug-memories/:userId
 * Debug endpoint to list all memories for a user
 */
app.get('/api/debug-memories/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const embeddingService = getEmbeddingService();
    
    // Search with very broad query and low threshold to get all memories
    const results = await embeddingService.searchMemories('user conversation memory', {
      topK: 50,
      threshold: 0.0, // Get everything
      userId
    });

    return res.json({ 
      success: true, 
      userId,
      totalMemories: results.length,
      memories: results.map(memory => ({
        id: memory.id,
        type: memory.metadata.type,
        timestamp: new Date(memory.metadata.timestamp).toISOString(),
        content: memory.content.substring(0, 200) + (memory.content.length > 200 ? '...' : ''),
        score: memory.score,
        tags: memory.metadata.tags
      }))
    });

  } catch (err: any) {
    console.error('debug-memories error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * GET /api/hybrid-memory-debug/:userId
 * Debug endpoint for hybrid memory system
 */
app.get('/api/hybrid-memory-debug/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const hybridMemoryService = getHybridMemoryService();
    const debugInfo = hybridMemoryService.getMemoryDebugInfo(userId);

    return res.json({ 
      success: true, 
      debugInfo
    });

  } catch (err: any) {
    console.error('hybrid-memory-debug error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * GET /api/recent-context/:userId
 * Get recent conversation context for a user
 */
app.get('/api/recent-context/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxTurns = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const hybridMemoryService = getHybridMemoryService();
    const recentContext = hybridMemoryService.getRecentContext(userId, Number(maxTurns));

    return res.json({ 
      success: true, 
      userId,
      recentContext
    });

  } catch (err: any) {
    console.error('recent-context error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * POST /api/hybrid-memory-search
 * Search using hybrid memory system
 */
app.post('/api/hybrid-memory-search', async (req, res) => {
  try {
    const { userId, query, maxLocalResults = 5, maxLongTermResults = 3, threshold = 0.3 } = req.body;

    if (!userId || !query) {
      return res.status(400).json({ error: 'userId and query are required' });
    }

    const hybridMemoryService = getHybridMemoryService();
    
    // 🎯 For debug endpoint, search all chats (isNewChat = true)
    const memoryResult = await hybridMemoryService.searchMemory(
      userId, 
      query,
      undefined,  // chatId = undefined (search all chats)
      0,          // messageCount = 0 (treat as new chat for comprehensive search)
      {
        maxLocalResults,
        maxLongTermResults,
        threshold
      }
    );

    return res.json({ 
      success: true, 
      memoryResult
    });

  } catch (err: any) {
    console.error('hybrid-memory-search error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err?.message ?? String(err) 
    });
  }
});

/**
 * POST /api/set-user-profile
 * Manually set user profile for testing
 */
app.post('/api/set-user-profile', async (req, res) => {
  try {
    const { userId, name, role, interests, preferences, background } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const profileData: any = {};
    if (name) profileData.name = name;
    if (role) profileData.role = role;
    if (interests) profileData.interests = interests;
    if (preferences) profileData.preferences = preferences;
    if (background) profileData.background = background;

    const profile = userProfileService.upsertUserProfile(userId, profileData);

    return res.json({
      success: true,
      profile
    });

  } catch (err: any) {
    console.error('set-user-profile error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err)
    });
  }
});

/**
 * GET /api/get-user-profile/:userId
 * Get user profile
 */
app.get('/api/get-user-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = userProfileService.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    return res.json({
      success: true,
      profile
    });

  } catch (err: any) {
    console.error('get-user-profile error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err)
    });
  }
});

/**
 * GET /api/performance-stats
 * Get performance optimization statistics
 */
app.get('/api/performance-stats', (req, res) => {
  try {
    const stats = getPerformanceStats();
    return res.json({
      success: true,
      stats,
      info: {
        profileCacheEnabled: true,
        contextCacheEnabled: true,
        smartMemoryStrategy: true,
        preloadingEnabled: true,
        optimizations: [
          'Profile caching (5min TTL)',
          'Recent context caching (2min TTL)',
          'Smart memory strategy selection',
          'Reduced Pinecone results (1 instead of 2)',
          'Background memory preloading',
          'Skip memory for simple queries'
        ]
      }
    });
  } catch (err: any) {
    console.error('performance-stats error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err)
    });
  }
});

/**
 * POST /api/end-chat
 * Called when user switches chats - persists current chat to Pinecone
 * This is where we do the heavy lifting (embeddings, vector storage)
 */
app.post('/api/end-chat', async (req, res) => {
  try {
    const { userId, chatId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    if (!chatId) {
      return res.status(400).json({ success: false, error: 'chatId is required' });
    }

    console.log(`\n🔚 End chat request - User: ${userId}, Chat: ${chatId}`);

    // Persist this chat session to Pinecone in the background
    setImmediate(async () => {
      try {
        console.log(`💾 [BACKGROUND] Persisting chat ${chatId} to Pinecone...`);
        const hybridMemoryService = getHybridMemoryService();
        
        // This will summarize and upload to Pinecone
        await hybridMemoryService.persistChatSession(userId, chatId);
        
        console.log(`✅ [BACKGROUND] Chat ${chatId} persisted to Pinecone successfully\n`);
      } catch (error) {
        console.error(`❌ [BACKGROUND] Failed to persist chat ${chatId}:`, error);
      }
    });

    // Respond immediately (don't make user wait for Pinecone upload)
    return res.json({
      success: true,
      message: 'Chat session will be persisted in background'
    });

  } catch (err: any) {
    console.error('end-chat error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err)
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`✅ User profiles will be created dynamically from user data`);
});