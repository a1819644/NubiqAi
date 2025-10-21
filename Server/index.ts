// server.ts (TypeScript)
require("dotenv").config();
import express from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenAI } from "@google/genai";
import {
  getEmbeddingService,
  MemoryItem,
  SearchResult,
} from "./services/embeddingService";
import { getHybridMemoryService } from "./services/hybridMemoryService";
import { extractDocumentTopics } from "./services/conversationService";
import * as userProfileService from "./services/userProfileService";
import { firebaseStorageService } from "./services/firebaseStorageService";
import { extractTextFromDocument } from "./services/documentExtractionService";
import {
  rateLimitMiddleware,
  validateUserIdMiddleware,
  sanitizeBodyMiddleware,
  securityHeadersMiddleware,
  SecurityValidator,
  logSecurityEvent,
} from "./services/securityMiddleware";
import { firestoreChatService } from "./services/firestoreChatService";
import { getJobQueue } from "./services/jobQueue";

// Import performance optimizations with error handling
let profileCache: any;
let recentContextCache: any;
let needsMemorySearch: any;
let determineMemoryStrategy: any;
let preloadMemoryForNextQuery: any;
let getPerformanceStats: any;

try {
  const perfOptimizations = require("./services/performanceOptimizations");
  profileCache = perfOptimizations.profileCache;
  recentContextCache = perfOptimizations.recentContextCache;
  needsMemorySearch = perfOptimizations.needsMemorySearch;
  determineMemoryStrategy = perfOptimizations.determineMemoryStrategy;
  preloadMemoryForNextQuery = perfOptimizations.preloadMemoryForNextQuery;
  getPerformanceStats = perfOptimizations.getPerformanceStats;
  console.log("✅ Performance optimizations loaded successfully");
} catch (error) {
  console.error(
    "❌ CRITICAL: Failed to load performance optimizations:",
    error
  );
  console.error("Stack:", (error as Error).stack);
  // Provide fallbacks
  profileCache = {
    get: () => undefined,
    set: () => {},
    clear: () => {},
    getStats: () => ({}),
  };
  recentContextCache = {
    get: () => undefined,
    set: () => {},
    clear: () => {},
    getStats: () => ({}),
  };
  needsMemorySearch = () => true;
  determineMemoryStrategy = () => "profile-only";
  preloadMemoryForNextQuery = async () => {};
  getPerformanceStats = () => ({});
  console.log(
    "⚠️ Using fallback implementations for performance optimizations"
  );
}

const app = express();
const port = Number(process.env.PORT ?? 8000);

// Helper function to check if origin is localhost or private LAN
function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    // Allow localhost and 127.0.0.1
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }
    
    // Allow private IP ranges: 10.x.x.x, 192.168.x.x, 172.16-31.x.x
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    
    return false;
  } catch {
    return false;
  }
}

// CORS with origin validation function - wrapping callback in try-catch to prevent crashes
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    try {
      // Allow requests with no origin like mobile apps or curl
      if (!origin) {
        console.log(`[CORS] No origin header present -> allowed`);
        return callback(null, true);
      }
      if (isAllowedOrigin(origin)) {
        console.log(`[CORS] Origin allowed: ${origin}`);
        return callback(null, true);
      }
      // Optionally allow additional origins via env (comma-separated)
      const extra = (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (extra.includes(origin)) {
        console.log(`[CORS] Origin allowed via env CORS_ORIGINS: ${origin}`);
        return callback(null, true);
      }
      console.warn(`[CORS] Origin blocked: ${origin}`);
      // Don't throw Error, just return false
      return callback(null, false);
    } catch (err) {
      console.error(`[CORS] Exception in origin check:`, err);
      return callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Generic OPTIONS handler to satisfy preflight without wildcard path
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// 🔒 Security middleware
app.use(securityHeadersMiddleware);
app.use(sanitizeBodyMiddleware);

// Add request logging
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || "none"}`
  );
  next();
});

// Initialize Vertex AI client (preferred for scalability)
let vertex: VertexAI | undefined;
try {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT;
  const location =
    process.env.VERTEX_LOCATION ||
    process.env.GOOGLE_CLOUD_REGION ||
    process.env.GOOGLE_CLOUD_LOCATION ||
    "us-central1";

  if (projectId) {
    vertex = new VertexAI({ project: projectId, location });
    console.log(
      `Vertex AI client initialized. project=${projectId}, location=${location}`
    );
  } else {
    console.warn(
      "GOOGLE_CLOUD_PROJECT not set; Vertex AI client not initialized. Set GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS to use Vertex AI."
    );
  }
} catch (err) {
  console.error("Failed to initialize Vertex AI client:", err);
}

// Initialize Google AI Studio client as a fallback (optional)
let ai: GoogleGenAI | undefined;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("GoogleGenAI client initialized (fallback).");
  } else {
    console.warn("GEMINI_API_KEY not set; Google client disabled.");
  }
} catch (err) {
  console.error("Failed to initialize GoogleGenAI client:", err);
}

// Unified generation helper using Vertex first, then Google as fallback
type GenResult = { parts: any[]; raw: any; usage?: any };
async function generateContent(args: { model: string; contents: any[] }): Promise<GenResult> {
  const { model, contents } = args;
  // Try Vertex first
  if (vertex) {
    try {
      const gm = vertex.getGenerativeModel({ model });
      // Normalize contents to Vertex format
      let vContents: any[];
      if (typeof contents[0] === "string") {
        vContents = [
          {
            role: "user",
            parts: contents.map((t) => ({ text: String(t) })),
          },
        ];
      } else if (contents[0] && typeof contents[0] === "object" && "parts" in contents[0]) {
        vContents = [
          {
            role: "user",
            parts: (contents[0] as any).parts,
          },
        ];
      } else {
        vContents = contents as any[];
      }
      const resp: any = await gm.generateContent({ contents: vContents });
      const parts: any[] = resp?.response?.candidates?.[0]?.content?.parts ?? [];
      const usage = resp?.response?.usageMetadata;
      return { parts, raw: resp, usage };
    } catch (err) {
      console.warn("Vertex generateContent failed, will try Google fallback:", err);
    }
  }

  // Fallback: Google AI Studio client
  if (ai) {
    const resp: any = await (ai as any).models.generateContent({ model, contents });
    const parts: any[] = resp?.candidates?.[0]?.content?.parts ?? [];
    const usage = resp?.usageMetadata;
    return { parts, raw: resp, usage };
  }

  throw new Error("No AI client initialized");
}

// In-flight request locks per user/chat to prevent concurrent generations
const inFlightChatRequests: Map<string, NodeJS.Timeout> = new Map();

// Home / health
app.get("/api", (req, res) => res.json({ ok: true }));

// Global error handlers to prevent server crashes
process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  console.error("Stack:", error.stack);
  // Don't exit - keep server running
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION at:", promise);
  console.error("Reason:", reason);
  // Don't exit - keep server running
});

/**
 * POST /api/ask-ai
 * body: { prompt: string, type?: 'text' | 'image', model?: string, useMemory?: boolean, userId?: string }
 * 🔒 SECURITY: Rate limited, input validated
 */
app.post("/api/ask-ai", rateLimitMiddleware("general"), async (req, res) => {
  if (!vertex && !ai)
    return res.status(500).json({ error: "AI client not initialized" });

  try {
    console.log("📥 Request received at /api/ask-ai");
    const {
      prompt,
      type = "text",
      model,
      useMemory = true,
      userId,
      chatId,
      messageCount,
      userName,
      conversationHistory,
      conversationSummary,
    } = req.body;
    console.log("📦 Request body parsed successfully");

    // � Concurrency guard per user/chat
    const keyUser = userId || "anonymous";
    const keyChat = chatId || "global";
    const inFlightKey = `${keyUser}:${keyChat}`;
    if (inFlightChatRequests.has(inFlightKey)) {
      return res.status(409).json({
        success: false,
        error: "Another request is already processing for this chat. Please wait for it to finish.",
      });
    }
    // Set a TTL to avoid stale locks (e.g., 2 minutes)
    const ttl = setTimeout(() => {
      inFlightChatRequests.delete(inFlightKey);
      console.warn(`⏱️ Cleared stale lock for ${inFlightKey}`);
    }, 2 * 60 * 1000);
    inFlightChatRequests.set(inFlightKey, ttl);

    // �🔒 Validate prompt
    const promptValidation = SecurityValidator.validatePrompt(prompt);
    if (!promptValidation.valid) {
      logSecurityEvent("Invalid prompt blocked", {
        userId,
        error: promptValidation.error,
      });
      return res.status(400).json({ error: promptValidation.error });
    }

    // 🔒 Validate userId if provided
    if (userId) {
      const userIdValidation = SecurityValidator.validateUserId(userId);
      if (!userIdValidation.valid) {
        logSecurityEvent("Invalid userId blocked", {
          userId,
          error: userIdValidation.error,
        });
        return res.status(400).json({ error: userIdValidation.error });
      }
    }

    // 🔒 Validate chatId if provided
    if (chatId) {
      const chatIdValidation = SecurityValidator.validateChatId(chatId);
      if (!chatIdValidation.valid) {
        logSecurityEvent("Invalid chatId blocked", {
          userId,
          chatId,
          error: chatIdValidation.error,
        });
        return res.status(400).json({ error: chatIdValidation.error });
      }
    }

    // For testing purposes, use anoop123 if no userId provided
    const effectiveUserId = userId || "anoop123";
    const effectiveChatId = chatId; // 🎯 NEW! Get chatId from request
    const effectiveMessageCount =
      messageCount !== undefined ? messageCount : undefined; // 🎯 NEW! Track message count

    // 🎯 AUTO-CREATE PROFILE: If user doesn't have a profile yet, create one with their name
    if (effectiveUserId && userName) {
      const existingProfile =
        userProfileService.getUserProfile(effectiveUserId);
      if (!existingProfile) {
        userProfileService.upsertUserProfile(effectiveUserId, {
          name: userName,
        });
        console.log(
          `✅ Auto-created profile for ${effectiveUserId} (name: ${userName})`
        );
      }
    }

    console.log(
      `💬 Chat request - User: ${effectiveUserId}, Chat: ${effectiveChatId || "none"}, Message#: ${effectiveMessageCount !== undefined ? effectiveMessageCount + 1 : "?"}, History: ${conversationHistory?.length || 0} msgs, Memory: ${useMemory}, Prompt: "${prompt.substring(0, 50)}..."`
    );

    let enhancedPrompt = prompt;

    // Smart memory search decision - determine search depth based on query complexity
    const determineSearchStrategy = (
      query: string,
      messageCount: number
    ): "full" | "profile-only" | "skip" => {
      const queryLower = query.toLowerCase().trim();

      // 1. For greetings, use profile-only (so AI can greet by name!)
      const greetingPatterns = [
        /^(hi|hello|hey|sup|yo|greetings|morning|afternoon|evening)$/i,
        /^(hi|hello|hey|sup|yo|greetings|morning|afternoon|evening)\s/i, // With extra text
      ];
      if (greetingPatterns.some((pattern) => pattern.test(queryLower))) {
        // Use profile for first few messages (greeting) - messageCount can be 0, 1, or 2
        if (messageCount <= 2) {
          return "profile-only";
        }
        // Skip for subsequent greetings
        return "skip";
      }

      // 2. Skip simple acknowledgments
      const skipPatterns = [
        /^(thanks|thank you|thx|ty)$/i,
        /^(yes|no|yep|nope|yeah|nah)$/i,
      ];
      if (skipPatterns.some((pattern) => pattern.test(queryLower))) {
        return "skip";
      }

      // 3. ALWAYS do full search if user explicitly references memory/past
      const memoryKeywords = [
        "remember",
        "recall",
        "earlier",
        "before",
        "previous",
        "last time",
        "we discussed",
        "you said",
        "you told",
        "conversation",
        "history",
        "ago",
        "yesterday",
      ];
      if (memoryKeywords.some((kw) => queryLower.includes(kw))) {
        return "full";
      }

      // 4. For short personal questions (name, preferences, etc), use profile only
      const personalKeywords = [
        "my name",
        "who am i",
        "what's my",
        "whats my",
        "do you know me",
        "about me",
        "i work",
        "i like",
        "my preference",
        "my favorite",
        "my role",
      ];
      if (
        query.length < 30 &&
        personalKeywords.some((kw) => queryLower.includes(kw))
      ) {
        return "profile-only";
      }

      // 5. For longer queries or complex questions, do full search
      if (query.length >= 30) {
        return "full";
      }

      // 6. Medium queries - use profile only (lightweight)
      return "profile-only";
    };

    // Use memory system based on search strategy
    if (useMemory && type === "text") {
      // ⚡ OPTIMIZATION: Use smart strategy determination
      const memoryStrategy = determineMemoryStrategy(
        prompt,
        effectiveMessageCount || 0
      );
      console.log(`🎯 Memory strategy selected: ${memoryStrategy}`);

      let strategy: "full" | "profile-only" | "skip" = "profile-only";

      if (memoryStrategy === "none") {
        strategy = "skip";
      } else if (memoryStrategy === "search") {
        strategy = "full";
      } else if (memoryStrategy === "cache" && effectiveChatId) {
        // Try to use cached context first
        const cachedTurns = recentContextCache.get(
          effectiveUserId,
          effectiveChatId
        );
        if (
          cachedTurns &&
          Array.isArray(cachedTurns) &&
          cachedTurns.length > 0
        ) {
          console.log(
            `⚡ Using cached context (${cachedTurns.length} turns) - instant retrieval!`
          );
          // Build prompt from cached turns
          const contextText = cachedTurns
            .map(
              (turn: any) =>
                `User: ${turn.userMessage}\nAssistant: ${turn.aiResponse}`
            )
            .join("\n\n");

          enhancedPrompt = `SYSTEM: You are NubiqAI ✨

RECENT CONVERSATION:
${contextText}

USER QUESTION:
${prompt}

Respond naturally.`;

          strategy = "skip"; // Skip full memory search
        } else {
          strategy = "profile-only"; // Fall back to profile
        }
      }

      const originalStrategy = determineSearchStrategy(
        prompt,
        effectiveMessageCount || 0
      );

      if (strategy === "skip") {
        console.log("⏭️ Skipping memory - simple greeting/acknowledgment");
      } else if (strategy === "profile-only") {
        // Lightweight: Only use user profile (no expensive searches)
        console.log(
          "👤 Using profile-only memory (lightweight) for user:",
          effectiveUserId
        );
        try {
          // ⚡ OPTIMIZATION: Check cache first
          let profileContextCached = profileCache.get(effectiveUserId);
          let profileContext: string | null = null;

          if (profileContextCached === undefined) {
            // Cache miss - fetch from service
            console.log("📥 Profile cache miss - fetching from service");
            profileContext =
              userProfileService.generateProfileContext(effectiveUserId);
            // Cache the profile object for future use
            const profile = userProfileService.getUserProfile(effectiveUserId);
            profileCache.set(effectiveUserId, profile);
          } else {
            console.log("⚡ Profile cache hit - instant retrieval!");
            // Generate context from cached profile
            profileContext = profileContextCached
              ? userProfileService.generateProfileContext(effectiveUserId)
              : null;
          }

          if (profileContext) {
            enhancedPrompt = `SYSTEM: You are NubiqAI ✨ - an intelligent assistant with persistent memory.

⚠️ CRITICAL: NEVER use # ## ### or * symbols in your response!

🎯 CORRECT FORMAT:
Write naturally with emojis at the start of sections
Use 1️⃣ 2️⃣ 3️⃣ for numbered lists
Use ✅ for list items, NOT asterisks
Add blank lines between topics

${"=".repeat(60)}
👤 USER PROFILE:
${profileContext}
${"=".repeat(60)}

💬 CURRENT USER QUESTION:
${prompt}

🎨 Respond using ONLY emojis and natural text. NO markdown symbols!`;

            console.log("✅ Enhanced prompt with user profile context");
          } else {
            console.log("❌ No user profile found for", effectiveUserId);
          }
        } catch (error) {
          console.warn("⚠️ Profile lookup failed:", error);
        }
      } else {
        // Full search: Use hybrid memory (local + Pinecone + profile)
        try {
          const hybridMemoryService = getHybridMemoryService();
          console.log(
            `🧠 Using full hybrid memory search for user: ${effectiveUserId}${effectiveChatId ? `, chat: ${effectiveChatId}` : ""}`
          );

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
              minLocalResultsForSkip: 2,
            }
          );

          console.log(
            `🧠 Memory search results - Type: ${memoryResult.type}, Local: ${memoryResult.resultCount.local}, Long-term: ${memoryResult.resultCount.longTerm}`
          );

          if (memoryResult.optimization?.skippedPinecone) {
            console.log(
              `💰 Cost optimization: ${memoryResult.optimization.reason}`
            );
          }

          if (
            memoryResult.combinedContext &&
            memoryResult.combinedContext !==
              "No relevant conversation history found."
          ) {
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

${"=".repeat(60)}
🧠 CONVERSATION HISTORY & USER PROFILE:
${memoryResult.combinedContext}
${"=".repeat(60)}

💬 CURRENT USER QUESTION:
${prompt}

🎨 NOW RESPOND: Use the correct format shown above. Natural language with emojis. NO # or * symbols. Make it visually beautiful and easy to read!`;

            console.log(
              `✅ Enhanced prompt with ${memoryResult.type} memory context + structured response instructions`
            );
          } else {
            console.log(
              `❌ No relevant memory context found for user ${effectiveUserId}`
            );
          }
        } catch (memoryError) {
          console.warn(
            "⚠️ Hybrid memory search failed, proceeding without memory context:",
            memoryError
          );
        }
      }
    }

    // 💬 Add conversation history from current chat for context continuity
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map((msg: any) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n");

      // Add summary of older messages if provided
      const summarySection = conversationSummary 
        ? `\n\n📚 OLDER MESSAGES CONTEXT:\n${conversationSummary}\n${"=".repeat(60)}\n\n`
        : '';

      enhancedPrompt = `${summarySection}RECENT CONVERSATION (LAST ${conversationHistory.length} MESSAGES):
${"=".repeat(60)}
${historyText}
${"=".repeat(60)}

${enhancedPrompt}

Remember: The conversation above is from the CURRENT chat session. ${conversationSummary ? 'Earlier messages are summarized above for context. ' : ''}Use it to maintain context and continuity in your responses.`;

      console.log(
        `💬 Added ${conversationHistory.length} recent messages${conversationSummary ? ' + older message summary' : ''} from current conversation for context`
      );
    } else if (!enhancedPrompt.includes("SYSTEM:")) {
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

    const textModel = model ?? "gemini-2.5-flash";
    const imageModel = model ?? "gemini-2.5-flash-image"; // 🎯 UPDATED: Using the latest multimodal flash model for both text and images.

    if (type === "image") {
      // 🔒 Apply image-specific rate limiting
      const { rateLimiter } = require("./services/securityMiddleware");
      if (!rateLimiter.checkRateLimit(effectiveUserId, "image")) {
        logSecurityEvent("Image rate limit exceeded", {
          userId: effectiveUserId,
        });
        return res.status(429).json({
          success: false,
          error:
            "Image generation rate limit exceeded. Please try again later.",
        });
      }

      // 🎨 Smart context-aware image generation
      let imagePrompt = prompt;

      // Check if prompt is generic (e.g., "generate an image", "create image", "show me")
      const genericImageKeywords = [
        "generate an image",
        "create an image",
        "make an image",
        "show me an image",
        "draw",
        "illustrate",
        "visualize",
        "generate image",
        "create image",
        "make image",
        "show me",
        "draw something",
        "illustrate this",
        "visualize this",
        "another image",
        "more image",
        "one more",
        "again",
      ];
      const promptLower = prompt.toLowerCase().trim();

      // More flexible detection: check if prompt CONTAINS keywords (not just starts with)
      // and is relatively short (< 50 chars), indicating it's not a specific description
      // Also detect continuation words like "another", "more", "again" (even with typos like "AAANOTHER")
      const hasContinuationWord = /\b(another|more|again|one more)\b/i.test(
        promptLower
      );
      const hasGenericKeyword = genericImageKeywords.some((kw) =>
        promptLower.includes(kw)
      );
      const hasSpecificDescriptor =
        promptLower.includes(" of a ") ||
        promptLower.includes(" with a ") ||
        promptLower.includes(" that has ");

      const isGenericRequest =
        (hasGenericKeyword || hasContinuationWord) &&
        prompt.length < 50 &&
        !hasSpecificDescriptor;

      // If generic request and we have chat history, add conversation context
      if (isGenericRequest && effectiveUserId) {
        console.log(
          `🧠 Generic image request detected - fetching conversation context...`
        );
        try {
          // Get conversation service (contains local memory)
          const {
            getConversationService,
          } = require("./services/conversationService");
          const conversationService = getConversationService();

          // Get last 5 conversation turns for context
          const recentTurns = conversationService.getRecentConversations(
            effectiveUserId,
            5
          );

          if (recentTurns.length > 0) {
            // Build context from recent conversation (reverse to get chronological order)
            const contextSummary = recentTurns
              .reverse() // Most recent last
              .map(
                (turn: any) =>
                  `User: ${turn.userPrompt}\nAI: ${turn.aiResponse}`
              )
              .join("\n\n");

            // Enhance prompt with conversation context
            imagePrompt = `Based on this recent conversation:

${contextSummary}

Create a detailed, visually compelling image that captures the essence and context of what we've been discussing. Make it relevant to the conversation topic.`;

            console.log(
              `✨ Enhanced image prompt with ${recentTurns.length} conversation turns from memory`
            );
            console.log(
              `📝 Context-aware prompt: "${imagePrompt.substring(0, 150)}..."`
            );
          } else if (conversationHistory && conversationHistory.length > 0) {
            // Fallback: Use conversation history from the request (current chat session)
            console.log(
              `💬 Using ${conversationHistory.length} messages from current chat session`
            );
            const contextSummary = conversationHistory
              .slice(-5) // Last 5 messages
              .map(
                (msg: any) =>
                  `${msg.role === "user" ? "User" : "AI"}: ${msg.content}`
              )
              .join("\n\n");

            imagePrompt = `Based on this recent conversation:

${contextSummary}

Create a detailed, visually compelling image that captures the essence and context of what we've been discussing. Make it relevant to the conversation topic.`;

            console.log(
              `✨ Enhanced image prompt with ${conversationHistory.length} messages from request`
            );
            console.log(
              `📝 Context-aware prompt: "${imagePrompt.substring(0, 150)}..."`
            );
          } else {
            // No conversation history - provide a helpful default prompt
            console.log(
              `⚠️ No conversation history found, creating a beautiful surprise image`
            );
            imagePrompt = `Create a beautiful, high-quality, visually stunning image. Since no specific subject was mentioned, create something inspiring and artistic. Think: nature scenery, abstract art, or a serene landscape. Make it photorealistic and captivating.`;
          }
        } catch (error) {
          console.warn(
            "⚠️ Could not fetch conversation context, using default prompt:",
            error
          );
          imagePrompt = `Create a beautiful, high-quality, visually stunning image. Since no specific subject was mentioned, create something inspiring and artistic. Think: nature scenery, abstract art, or a serene landscape. Make it photorealistic and captivating.`;
        }
      } else if (!isGenericRequest) {
        console.log(
          `🎯 Specific image request detected - using exact prompt: "${prompt}"`
        );
      }

      console.log(`🎨 Generating image...`);

      // Retry logic: Gemini sometimes returns text instead of image
      let retryCount = 0;
      const maxRetries = 2;
      let response;
      let imageGenerated = false;

      while (!imageGenerated && retryCount <= maxRetries) {
        if (retryCount > 0) {
          console.log(
            `🔄 Retry ${retryCount}/${maxRetries} - Gemini returned text instead of image, retrying...`
          );
          // Make prompt more explicit for retry
          imagePrompt =
            imagePrompt +
            `\n\nIMPORTANT: Generate an actual IMAGE, not text. Do not describe the image, CREATE it.`;
        }

        response = await generateContent({
          model: imageModel,
          contents: [imagePrompt],
        });

        const parts: any[] = (response as any)?.parts ?? [];

        // Check if we got an actual image
        const hasImage = parts.some(
          (part) => (part as any).inlineData || (part as any).fileData
        );

        if (hasImage) {
          imageGenerated = true;
          console.log(
            `✅ Image generated successfully on attempt ${retryCount + 1}`
          );
        } else {
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(
              `⚠️ Attempt ${retryCount} returned text only, retrying...`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
          } else {
            console.error(
              `❌ Failed to generate image after ${maxRetries + 1} attempts`
            );
          }
        }
      }

  const parts: any[] = (response as any)?.parts ?? [];
  let imageBase64: string | null = null;
  let imageUri: string | null = null;
      let altText: string | null = null;

      console.log(`📦 Received ${parts.length} parts from Gemini`);

      for (const part of parts) {
        // Log what we find in each part
        if ((part as any).inlineData) {
          console.log(
            `📸 Found inlineData - mimeType: ${(part as any).inlineData.mimeType}, data length: ${(part as any).inlineData.data?.length || 0}`
          );
          imageBase64 = (part as any).inlineData.data;
        }
        if ((part as any).fileData) {
          console.log(
            `📁 Found fileData - URI: ${(part as any).fileData.fileUri}`
          );
          imageUri = (part as any).fileData.fileUri;
        }
        if ((part as any).text) {
          console.log(`📝 Found text: ${(part as any).text.substring(0, 100)}`);
          altText = (part as any).text ?? altText;
        }
      }

      if (imageBase64) {
        console.log(
          `✅ Image generated successfully - base64 data (${imageBase64.length} chars)`
        );
      } else if (imageUri) {
        console.log(`✅ Image generated successfully - URI: ${imageUri}`);
        // Attempt to download the URI to base64 immediately so the client can render it
        try {
          console.log("📥 Downloading image from URI to base64 for immediate display...");
          const resp = await fetch(imageUri);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            imageBase64 = buffer.toString('base64');
            console.log(`✅ Converted URI image to base64 (${imageBase64.length} chars)`);
          } else {
            console.warn(`⚠️ Failed to fetch image URI (status ${resp.status}) - will return URI only`);
          }
        } catch (e) {
          console.warn("⚠️ Could not convert image URI to base64:", e);
        }
      } else {
        console.error(`❌ No image data found in response!`);
      }

      // Upload image to Firebase Storage and store URL
      if (useMemory && effectiveUserId && (imageBase64 || imageUri)) {
        setImmediate(async () => {
          try {
            const hybridMemoryService = getHybridMemoryService();
            let firebaseImageUrl: string;

            // Upload to Firebase Storage
            if (imageBase64) {
              console.log("📤 Uploading base64 image to Firebase Storage...");
              firebaseImageUrl = await firebaseStorageService.uploadImage(
                effectiveUserId,
                effectiveChatId || "default",
                imageBase64,
                prompt
              );
            } else if (imageUri) {
              // Fallback: try downloading the URI and uploading it
              console.log("📤 Attempting to download URI and upload to Firebase Storage...");
              try {
                const resp = await fetch(imageUri);
                if (resp.ok) {
                  const arrayBuf = await resp.arrayBuffer();
                  const buffer = Buffer.from(arrayBuf);
                  const b64 = buffer.toString('base64');
                  firebaseImageUrl = await firebaseStorageService.uploadImage(
                    effectiveUserId,
                    effectiveChatId || "default",
                    b64,
                    prompt
                  );
                } else {
                  console.warn(`⚠️ Failed to fetch image URI for upload (status ${resp.status}). Storing URI as-is.`);
                  firebaseImageUrl = imageUri;
                }
              } catch (err) {
                console.warn("⚠️ Error downloading URI for upload, storing URI as-is:", err);
                firebaseImageUrl = imageUri;
              }
            } else {
              console.error("❌ No image data to upload");
              return;
            }

            console.log(`✅ Image uploaded to Firebase: ${firebaseImageUrl}`);

            // Store Firebase URL in conversation history (NOT base64)
            const conversationTurn = hybridMemoryService.storeConversationTurn(
              effectiveUserId,
              prompt, // User's prompt
              altText || "Image generated", // AI's response (alt text or placeholder)
              effectiveChatId,
              { url: firebaseImageUrl, prompt: prompt } // Store Firebase URL
            );

            await firestoreChatService.saveTurn(conversationTurn);

            console.log(
              `🖼️ [BACKGROUND] Stored image URL in conversation history`
            );
          } catch (memoryError) {
            console.error(
              "❌ [BACKGROUND] Failed to upload/store image:",
              memoryError
            );
          }
        });
      }

      return res.json({
        success: true,
        imageBase64,
        imageUri,
        altText,
        raw: response,
        metadata: {
          tokens: (response as any)?.usage?.totalTokenCount || 0,
          candidatesTokenCount: (response as any)?.usage?.candidatesTokenCount || 0,
          promptTokenCount: (response as any)?.usage?.promptTokenCount || 0,
        },
      });
    }

    // ✅ REMOVED: Automatic image generation detection
    // Frontend now handles image generation explicitly via type='image' parameter
    // This prevents unwanted interception of text messages containing image keywords

    // Normal text response
    const startTime = Date.now();
    const response = await generateContent({ model: textModel, contents: [enhancedPrompt] });
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const parts = (response as any)?.parts ?? [];
    const text = parts.map((p: any) => p.text ?? "").join("");

    console.log(
      `✅ AI response generated (${text.length} chars) in ${duration.toFixed(2)}s - sending to user immediately...`
    );

    // ═══════════════════════════════════════════════════════════════════════
    // 🚀 CRITICAL: Send response to user FIRST (don't make them wait!)
    // ═══════════════════════════════════════════════════════════════════════
    const jsonResponse = { 
      success: true, 
      text, 
      raw: response,
      metadata: {
        tokens: (response as any)?.usage?.totalTokenCount || 0,
        candidatesTokenCount: (response as any)?.usage?.candidatesTokenCount || 0,
        promptTokenCount: (response as any)?.usage?.promptTokenCount || 0,
        duration: parseFloat(duration.toFixed(2)),
      },
    };
    res.json(jsonResponse);
    console.log(`📤 Response sent to user!`);

    // ═══════════════════════════════════════════════════════════════════════
    // 💾 LIGHTWEIGHT: Store in local memory only (no Pinecone, super fast!)
    // Pinecone upload happens only when user switches chats (see /api/end-chat endpoint)
    // ═══════════════════════════════════════════════════════════════════════
    if (useMemory && text && effectiveUserId) {
      setImmediate(async () => {
        try {
          const hybridMemoryService = getHybridMemoryService();

          // Store in local memory only (in-memory, instant)
          const conversationTurn = hybridMemoryService.storeConversationTurn(
            effectiveUserId,
            prompt,
            text,
            effectiveChatId
          );

          await firestoreChatService.saveTurn(conversationTurn);

          console.log(
            `💬 [BACKGROUND] Stored turn in session (chat: ${effectiveChatId}): "${prompt.substring(0, 50)}..."`
          );

          // ⚡ OPTIMIZATION: Preload memory for next query
          if (effectiveChatId) {
            preloadMemoryForNextQuery(
              effectiveUserId,
              effectiveChatId,
              hybridMemoryService
            ).catch((err: any) => console.warn("Preload failed:", err));
          }
        } catch (memoryError) {
          console.error(
            "❌ [BACKGROUND] Failed to store conversation turn:",
            memoryError
          );
        }
      });
    }

    // Return is not needed as response already sent
    return;
  } catch (err: any) {
    console.error("❌ FATAL ERROR in /api/ask-ai:", err);
    console.error("❌ Error stack:", err?.stack);
    console.error("❌ Error name:", err?.name);
    console.error("❌ Error message:", err?.message);

    // Don't let the server crash - always return a response
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
        details:
          process.env.NODE_ENV === "development" ? err?.stack : undefined,
      });
    }
  } finally {
    try {
      const keyUser = req.body?.userId || "anonymous";
      const keyChat = req.body?.chatId || "global";
      const inFlightKey = `${keyUser}:${keyChat}`;
      const existing = inFlightChatRequests.get(inFlightKey);
      if (existing) clearTimeout(existing);
      inFlightChatRequests.delete(inFlightKey);
    } catch {}
  }
});

/**
 * POST /api/process-document
 * body: { fileBase64?: string, filePath?: string, mimeType?: string, prompt?: string }
 */
app.post(
  "/api/process-document",
  rateLimitMiddleware("general"),
  async (req, res) => {
    if (!vertex && !ai)
      return res
        .status(500)
        .json({ error: "AI client not initialized" });

    try {
      const {
        fileBase64,
        filePath,
        mimeType: clientMime,
        prompt,
        userId,
      } = req.body;

      // 🔒 Validate inputs
      if (prompt) {
        const promptValidation = SecurityValidator.validatePrompt(prompt);
        if (!promptValidation.valid) {
          logSecurityEvent("Invalid document processing prompt", { userId, error: promptValidation.error });
          return res.status(400).json({ error: promptValidation.error || "Invalid prompt format" });
        }
      }

      if (userId) {
        const userIdValidation = SecurityValidator.validateUserId(userId);
        if (!userIdValidation.valid) {
          logSecurityEvent("Invalid userId in document processing", { userId, error: userIdValidation.error });
          return res.status(400).json({ error: userIdValidation.error || "Invalid user ID format" });
        }
      }

      // Validate base64 document size if provided (10MB limit)
      if (fileBase64) {
        const base64Validation = SecurityValidator.validateBase64Image(fileBase64);
        if (!base64Validation.valid) {
          logSecurityEvent("Document base64 validation failed", { userId, error: base64Validation.error });
          return res.status(400).json({ error: base64Validation.error || "Document size exceeds 10MB limit" });
        }
      }

      let base64Data = "";
      let mimeType = clientMime || "application/pdf";

      // Define supported file types
      // Note: Gemini API only supports PDF for document uploads via Files API
      // Other formats (DOCX, DOC, XLSX) must be extracted locally first
      const SUPPORTED_MIME_TYPES = [
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
        "application/pdf", // ✅ Gemini supports PDF
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx - local extraction
        "application/msword", // .doc - local extraction
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx - local extraction
      ];

      const GEMINI_SUPPORTED_TYPES = [
        "application/pdf", // Only PDF is supported by Gemini Files API
      ];

      const LOCAL_EXTRACTION_TYPES = [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
        "application/msword", // .doc
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "text/csv",
      ];

      const SUPPORTED_EXTENSIONS: Record<string, string> = {
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv": "text/csv",
        ".json": "application/json",
      };

      if (fileBase64 && typeof fileBase64 === "string") {
        base64Data = fileBase64;
      } else if (filePath && typeof filePath === "string") {
        const fs = await import("fs");
        const buffer = fs.readFileSync(filePath);
        base64Data = buffer.toString("base64");
        if (!clientMime) {
          const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
          mimeType = SUPPORTED_EXTENSIONS[ext] || "application/pdf";
        }
      } else {
        return res
          .status(400)
          .json({ error: "fileBase64 or filePath is required" });
      }

      // Check if file type is supported
      if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
        const fileExtension = Object.keys(SUPPORTED_EXTENSIONS).find(
          ext => SUPPORTED_EXTENSIONS[ext] === mimeType
        ) || "this file type";
        
        console.warn(`Unsupported file type attempted: ${mimeType}`);
        return res.status(400).json({ 
          success: false, 
          error: `We don't have the capability to process ${fileExtension} files yet. Supported formats: PDF, DOCX, DOC, TXT, MD, CSV, JSON, XLSX`,
          unsupportedType: mimeType
        });
      }

      // Check file size (base64 encoded size estimation)
      const estimatedSizeMB = (base64Data.length * 0.75) / (1024 * 1024); // Convert from base64 to actual size
      console.log(`Processing document: ~${estimatedSizeMB.toFixed(1)}MB`);

      if (estimatedSizeMB > 20) {
        console.warn(
          `Large file detected: ${estimatedSizeMB.toFixed(1)}MB - processing may be slow`
        );
      }

      // Use Gemini for document processing
  const DOC_MODEL = "gemini-2.5-flash";
      const defaultPrompt =
        "Extract all text content from this document. Provide a clean, well-formatted extraction of the text.";
      const userPrompt =
        prompt && typeof prompt === "string" && prompt.trim()
          ? prompt.trim()
          : defaultPrompt;

      let extractedText = "";

      // Fast-path 1: Plain text files can be returned directly
      if (mimeType === "text/plain" || mimeType === "text/markdown" || mimeType === "application/json" || mimeType === "text/csv") {
        try {
          // Clean base64 data - remove any whitespace/newlines that might cause decoding issues
          const cleanedBase64 = base64Data.replace(/[\r\n\s]/g, '');
          const textContent = Buffer.from(cleanedBase64, "base64").toString(
            "utf8"
          );
          extractedText = textContent;
          console.log(`✅ Direct text extraction successful (${mimeType}), length: ${extractedText.length}`);
        } catch (decodeErr) {
          console.warn("Failed to decode text base64, falling back to local extraction", decodeErr);
        }
      }

      // Fast-path 2: Use local extraction for DOCX, DOC, XLSX (Gemini doesn't support these)
      if (!extractedText && LOCAL_EXTRACTION_TYPES.includes(mimeType)) {
        try {
          const cleanedBase64 = base64Data.replace(/[\r\n\s]/g, '');
          const buffer = Buffer.from(cleanedBase64, "base64");
          const local = await extractTextFromDocument(buffer, mimeType);
          if (local.text && local.text.trim()) {
            extractedText = local.text;
            console.log(`✅ Local extraction succeeded via ${local.method} for ${mimeType}`);
          }
        } catch (localErr) {
          console.warn(`Local extraction failed for ${mimeType}, will try Gemini:`, localErr);
        }
      }

      // AI-based extraction step removed for scale; use local extractors for PDFs
      if (!extractedText && mimeType === "application/pdf") {
        try {
          const cleanedBase64 = base64Data.replace(/[\r\n\s]/g, '');
          const buffer = Buffer.from(cleanedBase64, "base64");
          const local = await extractTextFromDocument(buffer, mimeType);
          if (local.text && local.text.trim()) {
            extractedText = local.text;
            console.log(`✅ PDF extracted locally via ${local.method}`);
          }
        } catch (pdfErr) {
          console.warn("Local PDF extraction failed:", pdfErr);
        }
      }

      // 🛟 Fallback: local extraction if AI result is empty
      if (!extractedText || !extractedText.trim()) {
        try {
          const cleanedBase64 = base64Data.replace(/[\r\n\s]/g, '');
          const buffer = Buffer.from(cleanedBase64, "base64");
          const local = await extractTextFromDocument(buffer, mimeType);
          if (local.text && local.text.trim()) {
            extractedText = local.text;
            console.log(`✅ Fallback local extraction succeeded via ${local.method}`);
          }
        } catch (fallbackErr) {
          console.warn("Local extraction fallback failed:", fallbackErr);
        }
      }

      // Optionally store the processed document in memory
      const { storeInMemory = false } = req.body;
      if (storeInMemory && extractedText && userId) {
        try {
          // Extract topics from document content using AI
          const documentTopics = await extractDocumentTopics(extractedText);
          console.log(
            `📊 Extracted document topics: ${documentTopics.join(", ")}`
          );

          const embeddingService = getEmbeddingService();
          const documentMemory: MemoryItem = {
            id: `document_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: extractedText,
            metadata: {
              timestamp: Date.now(),
              type: "document",
              source: filePath || "uploaded-file",
              userId,
              tags: ["processed-document", mimeType, ...documentTopics],
            },
          };

          // Store asynchronously without blocking the response
          embeddingService
            .storeMemory(documentMemory)
            .catch((err) =>
              console.error("Failed to store document memory:", err)
            );

          console.log("Document content stored in memory for future reference");
        } catch (memoryError) {
          console.warn("Failed to store document in memory:", memoryError);
        }
      }

  return res.json({ success: true, extractedText });
    } catch (err: any) {
      console.error("process-document error:", err);

      // Provide more specific error messages for common large file issues
      let errorMessage = err?.message ?? String(err);
      if (
        errorMessage.includes("payload") ||
        errorMessage.includes("too large")
      ) {
        errorMessage =
          "File too large. Please try a smaller file (under 10MB).";
      } else if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("deadline")
      ) {
        errorMessage =
          "Processing timeout. Large files may take too long to process.";
      } else if (
        errorMessage.includes("quota") ||
        errorMessage.includes("limit")
      ) {
        errorMessage =
          "API quota exceeded. Please try again later or use a smaller file.";
      }

      return res.status(500).json({ success: false, error: errorMessage });
    }
  }
);

/**
 * POST /api/edit-image
 * body: { imageBase64: string, editPrompt: string, model?: string, userId?: string }
 */
app.post("/api/edit-image", rateLimitMiddleware("image"), async (req, res) => {
  if (!vertex && !ai)
    return res.status(500).json({ error: "AI client not initialized" });

  try {
    const { imageBase64, editPrompt, model, userId } = req.body;

    // 🔒 Validate inputs
    if (
      !editPrompt ||
      typeof editPrompt !== "string" ||
      !SecurityValidator.validatePrompt(editPrompt)
    ) {
      logSecurityEvent("Invalid image edit prompt", { userId });
      return res.status(400).json({ error: "Invalid or missing editPrompt" });
    }

    if (
      !imageBase64 ||
      typeof imageBase64 !== "string" ||
      !SecurityValidator.validateBase64Image(imageBase64)
    ) {
      logSecurityEvent("Invalid image in edit-image", { userId });
      return res
        .status(400)
        .json({ error: "Invalid or oversized imageBase64 (max 10MB)" });
    }

    if (userId && !SecurityValidator.validateUserId(userId)) {
      logSecurityEvent("Invalid userId in edit-image", { userId });
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // NOTE: Gemini's image models (gemini-2.5-flash-image) only GENERATE new images, they don't edit existing ones
    // For "editing", we'll use the vision model to analyze the image and generate a new one based on the edit instruction

    // Step 1: Use vision model to describe the image
    const visionModel = "gemini-2.5-flash"; // vision model for description
    const descriptionResponse = await generateContent({
      model: visionModel,
      contents: [
        "Describe this image in detail, focusing on all visual elements, style, colors, composition, and mood.",
        { inlineData: { data: imageBase64, mimeType: "image/png" } },
      ],
    });
    const imageDescription = ((descriptionResponse as any)?.parts ?? [])
      .map((p: any) => p.text)
      .filter(Boolean)
      .join(" ") || "an image";

    // Step 2: Generate a new image based on the description + edit instruction
    const imageModel = model ?? "gemini-2.5-flash-image"; // image generation model
    const combinedPrompt = `Based on this description: "${imageDescription}"

Apply this edit: ${editPrompt}

Generate a new image that matches the original description but with the requested edits applied.`;

    const response = await generateContent({ model: imageModel, contents: [combinedPrompt] });
    const parts: any[] = (response as any)?.parts ?? [];
    let newImageBase64: string | null = null;
    let imageUri: string | null = null;
    let altText: string | null = null;

    for (const part of parts) {
      if ((part as any).inlineData?.data)
        newImageBase64 = (part as any).inlineData.data;
      if ((part as any).fileData?.fileUri)
        imageUri = (part as any).fileData.fileUri;
      if ((part as any).text) altText = (part as any).text ?? altText;
    }

    return res.json({
      success: true,
      imageBase64: newImageBase64,
      imageUri,
      altText,
      raw: response,
    });
  } catch (err: any) {
    console.error("edit-image error:", err);
    return res
      .status(500)
      .json({ success: false, error: err?.message ?? String(err) });
  }
});

/**
 * POST /api/edit-image-with-mask
 * body: { imageBase64: string, maskBase64: string, editPrompt: string, model?: string, userId?: string }
 */
app.post(
  "/api/edit-image-with-mask",
  rateLimitMiddleware("image"),
  async (req, res) => {
    if (!vertex && !ai)
      return res.status(500).json({ error: "AI client not initialized" });

    try {
      const { imageBase64, maskBase64, editPrompt, model, userId } = req.body;

      // 🔒 Validate inputs
      if (
        !editPrompt ||
        typeof editPrompt !== "string" ||
        !SecurityValidator.validatePrompt(editPrompt)
      ) {
        logSecurityEvent("Invalid mask edit prompt", { userId });
        return res.status(400).json({ error: "Invalid or missing editPrompt" });
      }

      if (
        !imageBase64 ||
        typeof imageBase64 !== "string" ||
        !SecurityValidator.validateBase64Image(imageBase64)
      ) {
        logSecurityEvent("Invalid image in edit-image-with-mask", { userId });
        return res
          .status(400)
          .json({ error: "Invalid or oversized imageBase64 (max 10MB)" });
      }

      if (
        !maskBase64 ||
        typeof maskBase64 !== "string" ||
        !SecurityValidator.validateBase64Image(maskBase64)
      ) {
        logSecurityEvent("Invalid mask in edit-image-with-mask", { userId });
        return res
          .status(400)
          .json({ error: "Invalid or oversized maskBase64 (max 10MB)" });
      }

      if (userId && !SecurityValidator.validateUserId(userId)) {
        logSecurityEvent("Invalid userId in edit-image-with-mask", { userId });
        return res.status(400).json({ error: "Invalid user ID format" });
      }

      // NOTE: Gemini doesn't support true mask-based editing like Stable Diffusion inpainting
      // For mask-based editing, we'll use vision model to analyze BOTH images and generate a new one

      // Step 1: Describe the original image
      const visionModel = "gemini-2.5-flash";
      const descriptionResponse = await generateContent({
        model: visionModel,
        contents: [
          "Describe this image in detail.",
          { inlineData: { data: imageBase64, mimeType: "image/png" } },
        ],
      });
      const imageDescription = ((descriptionResponse as any)?.parts ?? [])
        .map((p: any) => p.text)
        .filter(Boolean)
        .join(" ") || "an image";

      // Step 2: Analyze the mask to understand what areas to edit
      const maskResponse = await generateContent({
        model: visionModel,
        contents: [
          "Describe the colored/marked areas in this mask image. Where are they located and what parts of the image do they cover?",
          { inlineData: { data: maskBase64, mimeType: "image/png" } },
        ],
      });
      const maskDescription = ((maskResponse as any)?.parts ?? [])
        .map((p: any) => p.text)
        .filter(Boolean)
        .join(" ") || "marked areas";

      // Step 3: Generate new image with edits applied to masked areas
    const imageModel = model ?? "gemini-2.5-flash-image";
      const combinedPrompt = `Original image: ${imageDescription}

Masked areas to edit: ${maskDescription}

Edit instruction for the masked areas ONLY: ${editPrompt}

Generate a new version of the image with the edit applied ONLY to the masked areas. Keep everything else the same as the original.`;

  const response = await generateContent({ model: imageModel, contents: [combinedPrompt] });
  const parts: any[] = (response as any)?.parts ?? [];
      let newImageBase64: string | null = null;
      let imageUri: string | null = null;
      let altText: string | null = null;

      for (const part of parts) {
        if ((part as any).inlineData?.data)
          newImageBase64 = (part as any).inlineData.data;
        if ((part as any).fileData?.fileUri)
          imageUri = (part as any).fileData.fileUri;
        if ((part as any).text) altText = (part as any).text ?? altText;
      }

      return res.json({
        success: true,
        imageBase64: newImageBase64,
        imageUri,
        altText,
        raw: response,
      });
    } catch (err: any) {
      console.error("edit-image-with-mask error:", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message ?? String(err) });
    }
  }
);

/**
 * POST /api/store-memory
 * body: { content: string, type?: 'conversation' | 'document' | 'note', source?: string, userId?: string, tags?: string[] }
 */
app.post(
  "/api/store-memory",
  rateLimitMiddleware("general"),
  async (req, res) => {
    try {
      const { content, type = "note", source, userId, tags } = req.body;

      // 🔒 Validate inputs
      if (!userId || !SecurityValidator.validateUserId(userId)) {
        logSecurityEvent("Invalid userId in store-memory", { userId });
        return res.status(400).json({ error: "Valid userId is required" });
      }

      if (!content || typeof content !== "string" || content.length > 50000) {
        logSecurityEvent("Invalid memory content", { userId });
        return res
          .status(400)
          .json({ error: "Valid content (string, max 50KB) is required" });
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
          tags,
        },
      };

      await embeddingService.storeMemory(memoryItem);

      return res.json({
        success: true,
        message: "Memory stored successfully",
        memoryId: memoryItem.id,
      });
    } catch (err: any) {
      console.error("store-memory error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  }
);

/**
 * POST /api/store-memories
 * body: { memories: Array<{ content: string, type?: string, source?: string, userId?: string, tags?: string[] }> }
 */
app.post(
  "/api/store-memories",
  rateLimitMiddleware("general"),
  async (req, res) => {
    try {
      const { memories } = req.body;

      if (!Array.isArray(memories) || memories.length === 0) {
        return res
          .status(400)
          .json({ error: "memories (array) is required and cannot be empty" });
      }

      // 🔒 Validate batch size
      if (memories.length > 50) {
        logSecurityEvent("Too many memories in batch", {
          count: memories.length,
        });
        return res.status(400).json({ error: "Maximum 50 memories per batch" });
      }

      // Validate each memory
      for (const memory of memories) {
        if (
          !memory.content ||
          typeof memory.content !== "string" ||
          memory.content.length > 50000
        ) {
          return res
            .status(400)
            .json({ error: "Each memory must have valid content (max 50KB)" });
        }
        if (memory.userId && !SecurityValidator.validateUserId(memory.userId)) {
          logSecurityEvent("Invalid userId in batch memory", {
            userId: memory.userId,
          });
          return res
            .status(400)
            .json({ error: "Invalid userId in memory batch" });
        }
      }

      const embeddingService = getEmbeddingService();

      const memoryItems: MemoryItem[] = memories.map((memory, index) => ({
        id: `batch_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        content: memory.content,
        metadata: {
          timestamp: Date.now(),
          type: memory.type || "note",
          source: memory.source,
          userId: memory.userId,
          tags: memory.tags,
        },
      }));

      await embeddingService.storeMemories(memoryItems);

      return res.json({
        success: true,
        message: `${memoryItems.length} memories stored successfully`,
        memoryIds: memoryItems.map((item) => item.id),
      });
    } catch (err: any) {
      console.error("store-memories error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  }
);

/**
 * POST /api/search-memory
 * body: { query: string, topK?: number, threshold?: number, userId?: string, type?: string }
 */
app.post(
  "/api/search-memory",
  rateLimitMiddleware("general"),
  async (req, res) => {
    try {
      const { query, topK = 5, threshold = 0.7, userId, type } = req.body;

      // 🔒 Validate inputs
      if (
        !query ||
        typeof query !== "string" ||
        !SecurityValidator.validatePrompt(query)
      ) {
        logSecurityEvent("Invalid search query", { userId });
        return res
          .status(400)
          .json({ error: "Valid query (string, max 10000 chars) is required" });
      }

      if (userId && !SecurityValidator.validateUserId(userId)) {
        logSecurityEvent("Invalid userId in search-memory", { userId });
        return res.status(400).json({ error: "Invalid userId format" });
      }

      if (topK && (typeof topK !== "number" || topK < 1 || topK > 100)) {
        return res
          .status(400)
          .json({ error: "topK must be a number between 1 and 100" });
      }

      const embeddingService = getEmbeddingService();

      // Build filter based on optional parameters
      const filter: Record<string, any> = {};
      if (type) filter.type = type;

      const results = await embeddingService.searchMemories(query, {
        topK,
        threshold,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        userId,
      });

      return res.json({
        success: true,
        query,
        results,
        count: results.length,
      });
    } catch (err: any) {
      console.error("search-memory error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  }
);

/**
 * DELETE /api/memory/:id
 * Delete a specific memory by ID
 */
app.delete(
  "/api/memory/:id",
  rateLimitMiddleware("general"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body; // Should be provided for ownership validation

      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Valid Memory ID is required" });
      }

      // 🔒 Validate userId for ownership check
      if (userId && !SecurityValidator.validateUserId(userId)) {
        logSecurityEvent("Invalid userId in delete-memory", {
          userId,
          memoryId: id,
        });
        return res.status(400).json({ error: "Invalid userId format" });
      }

      const embeddingService = getEmbeddingService();
      await embeddingService.deleteMemory(id);

      return res.json({
        success: true,
        message: "Memory deleted successfully",
      });
    } catch (err: any) {
      console.error("delete-memory error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  }
);

/**
 * GET /api/memory-stats
 * Get memory statistics
 */
app.get("/api/memory-stats", async (req, res) => {
  try {
    const embeddingService = getEmbeddingService();
    const stats = await embeddingService.getMemoryStats();

    return res.json({
      success: true,
      stats,
    });
  } catch (err: any) {
    console.error("memory-stats error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
    });
  }
});

/**
 * GET /api/debug-memories/:userId
 * Debug endpoint to list all memories for a user
 * ⚠️ DISABLED IN PRODUCTION
 */
app.get("/api/debug-memories/:userId", async (req, res) => {
  // 🔒 Disable in production
  if (process.env.NODE_ENV === "production") {
    logSecurityEvent("Debug endpoint accessed in production", {
      endpoint: "debug-memories",
    });
    return res
      .status(403)
      .json({ error: "Debug endpoints are disabled in production" });
  }

  try {
    const { userId } = req.params;

    if (!userId || !SecurityValidator.validateUserId(userId)) {
      return res.status(400).json({ error: "Valid User ID is required" });
    }

    const embeddingService = getEmbeddingService();

    // Search with very broad query and low threshold to get all memories
    const results = await embeddingService.searchMemories(
      "user conversation memory",
      {
        topK: 50,
        threshold: 0.0, // Get everything
        userId,
      }
    );

    return res.json({
      success: true,
      userId,
      totalMemories: results.length,
      memories: results.map((memory) => ({
        id: memory.id,
        type: memory.metadata.type,
        timestamp: new Date(memory.metadata.timestamp).toISOString(),
        content:
          memory.content.substring(0, 200) +
          (memory.content.length > 200 ? "..." : ""),
        score: memory.score,
        tags: memory.metadata.tags,
      })),
    });
  } catch (err: any) {
    console.error("debug-memories error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
    });
  }
});

/**
 * GET /api/hybrid-memory-debug/:userId
 * Debug endpoint for hybrid memory system
 * ⚠️ DISABLED IN PRODUCTION
 */
app.get("/api/hybrid-memory-debug/:userId", async (req, res) => {
  // 🔒 Disable in production
  if (process.env.NODE_ENV === "production") {
    logSecurityEvent("Debug endpoint accessed in production", {
      endpoint: "hybrid-memory-debug",
    });
    return res
      .status(403)
      .json({ error: "Debug endpoints are disabled in production" });
  }

  try {
    const { userId } = req.params;

    if (!userId || !SecurityValidator.validateUserId(userId)) {
      return res.status(400).json({ error: "Valid User ID is required" });
    }

    const hybridMemoryService = getHybridMemoryService();
    const debugInfo = hybridMemoryService.getMemoryDebugInfo(userId);

    return res.json({
      success: true,
      debugInfo,
    });
  } catch (err: any) {
    console.error("hybrid-memory-debug error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
    });
  }
});

/**
 * GET /api/recent-context/:userId
 * Get recent conversation context for a user
 */
app.get("/api/recent-context/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxTurns = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const hybridMemoryService = getHybridMemoryService();
    const recentContext = hybridMemoryService.getRecentContext(
      userId,
      Number(maxTurns)
    );

    return res.json({
      success: true,
      userId,
      recentContext,
    });
  } catch (err: any) {
    console.error("recent-context error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
    });
  }
});

/**
 * POST /api/hybrid-memory-search
 * Search using hybrid memory system
 */
app.post("/api/hybrid-memory-search", async (req, res) => {
  try {
    const {
      userId,
      query,
      maxLocalResults = 5,
      maxLongTermResults = 3,
      threshold = 0.3,
    } = req.body;

    if (!userId || !query) {
      return res.status(400).json({ error: "userId and query are required" });
    }

    const hybridMemoryService = getHybridMemoryService();

    // 🎯 For debug endpoint, search all chats (isNewChat = true)
    const memoryResult = await hybridMemoryService.searchMemory(
      userId,
      query,
      undefined, // chatId = undefined (search all chats)
      0, // messageCount = 0 (treat as new chat for comprehensive search)
      {
        maxLocalResults,
        maxLongTermResults,
        threshold,
      }
    );

    return res.json({
      success: true,
      memoryResult,
    });
  } catch (err: any) {
    console.error("hybrid-memory-search error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
    });
  }
});

/**
 * POST /api/set-user-profile
 * Manually set user profile for testing
 */
app.post(
  "/api/set-user-profile",
  rateLimitMiddleware("general"),
  async (req, res) => {
    try {
      const { userId, name, role, interests, preferences, background } =
        req.body;

      // 🔒 Validate userId
      if (!userId || !SecurityValidator.validateUserId(userId)) {
        logSecurityEvent("Invalid userId in set-user-profile", { userId });
        return res
          .status(400)
          .json({ success: false, error: "Valid userId is required" });
      }

      // Validate text fields length
      if (name && (typeof name !== "string" || name.length > 200)) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Name must be a string (max 200 chars)",
          });
      }
      if (role && (typeof role !== "string" || role.length > 200)) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Role must be a string (max 200 chars)",
          });
      }
      if (
        background &&
        (typeof background !== "string" || background.length > 5000)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Background must be a string (max 5000 chars)",
          });
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
        profile,
      });
    } catch (err: any) {
      console.error("set-user-profile error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  }
);

/**
 * GET /api/get-user-profile/:userId
 * Get user profile
 */
app.get(
  "/api/get-user-profile/:userId",
  rateLimitMiddleware("general"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // 🔒 Validate userId
      if (!SecurityValidator.validateUserId(userId)) {
        logSecurityEvent("Invalid userId in get-user-profile", { userId });
        return res
          .status(400)
          .json({ success: false, error: "Invalid userId format" });
      }

      const profile = userProfileService.getUserProfile(userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: "Profile not found",
        });
      }

      return res.json({
        success: true,
        profile,
      });
    } catch (err: any) {
      console.error("get-user-profile error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  }
);

/**
 * GET /api/performance-stats
 * Get performance optimization statistics
 * ⚠️ DISABLED IN PRODUCTION
 */
app.get("/api/performance-stats", (req, res) => {
  // 🔒 Disable in production
  if (process.env.NODE_ENV === "production") {
    logSecurityEvent("Debug endpoint accessed in production", {
      endpoint: "performance-stats",
    });
    return res
      .status(403)
      .json({ error: "Debug endpoints are disabled in production" });
  }

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
          "Profile caching (5min TTL)",
          "Recent context caching (2min TTL)",
          "Smart memory strategy selection",
          "Reduced Pinecone results (1 instead of 2)",
          "Background memory preloading",
          "Skip memory for simple queries",
        ],
      },
    });
  } catch (err: any) {
    console.error("performance-stats error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
    });
  }
});

/**
 * POST /api/end-chat
 * Called when user switches chats - persists current chat to Pinecone
 * 🎯 OPTIMIZED: Respects cooldown to avoid spam uploads
 */
app.post("/api/end-chat", rateLimitMiddleware("general"), async (req, res) => {
  try {
    const { userId, chatId, force } = req.body;

    // 🔒 Validate inputs
    if (!userId || !SecurityValidator.validateUserId(userId)) {
      logSecurityEvent("Invalid userId in end-chat", { userId });
      return res
        .status(400)
        .json({ success: false, error: "Valid userId is required" });
    }

    if (!chatId || !SecurityValidator.validateChatId(chatId)) {
      logSecurityEvent("Invalid chatId in end-chat", { userId, chatId });
      return res
        .status(400)
        .json({ success: false, error: "Valid chatId is required" });
    }

    console.log(
      `\n🔚 End chat request - User: ${userId}, Chat: ${chatId}, Force: ${force || false}`
    );

    // Enqueue background persistence job with retry/backoff
    const queue = getJobQueue();
    queue.enqueue('persist-chat', { userId, chatId, force: !!force });

    // Respond immediately (don't make user wait for Pinecone upload)
    return res.json({
      success: true,
      message: "Chat session will be persisted in background",
    });
  } catch (err: any) {
    console.error("end-chat error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
    });
  }
});

/**
 * POST /api/save-all-chats
 * Force upload all active chats (for sign-out or critical save)
 * 🎯 OPTIMIZED: Bypasses cooldown for critical events
 */
app.post(
  "/api/save-all-chats",
  rateLimitMiddleware("general"),
  async (req, res) => {
    try {
      const { userId, chatIds } = req.body;

      // 🔒 Validate inputs
      if (!userId || !SecurityValidator.validateUserId(userId)) {
        logSecurityEvent("Invalid userId in save-all-chats", { userId });
        return res
          .status(400)
          .json({ success: false, error: "Valid userId is required" });
      }

      if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
        logSecurityEvent("Invalid chatIds in save-all-chats", { userId });
        return res
          .status(400)
          .json({ success: false, error: "chatIds array is required" });
      }

      if (chatIds.length > 100) {
        logSecurityEvent("Too many chatIds in save-all-chats", {
          userId,
          count: chatIds.length,
        });
        return res
          .status(400)
          .json({ success: false, error: "Maximum 100 chats per request" });
      }

      // Validate each chatId format
      for (const chatId of chatIds) {
        if (!SecurityValidator.validateChatId(chatId)) {
          logSecurityEvent("Invalid chatId format in batch save", {
            userId,
            chatId,
          });
          return res
            .status(400)
            .json({
              success: false,
              error: `Invalid chatId format: ${chatId}`,
            });
        }
      }

      console.log(
        `\n💾 Force save all chats - User: ${userId}, Chats: ${chatIds.length}`
      );

      // Enqueue background persistence jobs (with force flag)
      const queue = getJobQueue();
      let enqueued = 0;
      for (const chatId of chatIds) {
        try {
          queue.enqueue('persist-chat', { userId, chatId, force: true });
          enqueued += 1;
        } catch (error) {
          console.error(`❌ Failed to enqueue save for chat ${chatId}:`, error);
        }
      }

      return res.json({
        success: true,
        message: `${enqueued} chat(s) queued for background save`,
        queued: enqueued,
        total: chatIds.length,
      });
    } catch (err: any) {
      console.error("save-all-chats error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  }
);

/**
 * GET /api/chats
 * Smart two-tier chat loading strategy:
 * 1. First load from local memory (instant) - recent chats
 * 2. Then check Pinecone (background) - older history
 * 3. Return in ascending order (oldest first)
 * Query params: userId (required), source (optional: 'local', 'pinecone', or 'all')
 */
app.get("/api/chats", rateLimitMiddleware("general"), async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const source = (req.query.source as string) || "local"; // Default to local for speed

    // 🔒 Validate userId
    if (!userId || !SecurityValidator.validateUserId(userId)) {
      logSecurityEvent("Invalid userId in get-chats", { userId });
      return res.status(400).json({
        success: false,
        error: "Valid userId query parameter is required",
      });
    }

    console.log(
      `\n📚 Fetching chat history for user: ${userId} (source: ${source})`
    );

    const hybridMemoryService = getHybridMemoryService();
    const embeddingService = getEmbeddingService();
    const allChats: any[] = [];

    // STEP 1: Load from Firestore (shared state across instances)
    if (source === "local" || source === "all") {
      console.log("   🔥 Loading active chats from Firestore...");
      const firestoreChats = await firestoreChatService.listActiveChats(userId);
      allChats.push(...firestoreChats);
      console.log(
        `   ✅ Found ${firestoreChats.length} active chat session(s) in Firestore`
      );
    }

    // STEP 2: Load from PINECONE (slower - only if requested or no local data)
    if (source === "pinecone" || (source === "all" && allChats.length === 0)) {
      console.log("   🔍 Checking Pinecone for older history...");
      try {
        // Use new PineconeStorageService to get properly structured chat history
        const {
          getPineconeStorageService,
        } = require("./services/pineconeStorageService");
        const pineconeStorage = getPineconeStorageService();

        // Get user's chats from Pinecone (same structure as local memory)
        const storedChats = await pineconeStorage.getUserChats(userId, 200);

        // Convert to API response format
          const pineconeChats = storedChats.map((chat: any) => ({
          id: chat.chatId,
          title: chat.title,
          timestamp: new Date(chat.createdAt).toISOString(),
          userId: userId,
          messages: chat.messages.map((msg: any) => ({
              id: msg.id,
            role: msg.role,
            content: msg.content,
              timestamp: new Date(msg.timestamp).toISOString(),
              attachments:
                msg.hasImage && msg.imageUrl ? [msg.imageUrl] : undefined,
              imagePrompt: msg.imagePrompt,
          })),
          source: "pinecone", // Mark source
        }));

        allChats.push(...pineconeChats);
        console.log(
          `   ✅ Found ${pineconeChats.length} chat sessions in Pinecone (${storedChats.reduce((sum: number, c: any) => sum + c.messages.length, 0)} messages)`
        );
      } catch (pineconeError) {
        console.warn(
          "   ⚠️ Pinecone query failed (non-critical):",
          pineconeError
        );
        // Don't fail the whole request if Pinecone is down
      }
    }

    // STEP 3: Sort by timestamp (ascending order - oldest first)
    allChats.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB; // Ascending order
    });

    console.log(
      `✅ Total: ${allChats.length} chat sessions loaded for user ${userId}\n`
    );

    return res.json({
      success: true,
      data: allChats,
      message: `Retrieved ${allChats.length} chats`,
      sources: {
        local: allChats.filter((c) => c.source === "local").length,
        pinecone: allChats.filter((c) => c.source === "pinecone").length,
      },
    });
  } catch (err: any) {
    console.error("❌ Error fetching chats:", err);
    return res.status(500).json({
      success: false,
      error: err?.message ?? String(err),
      data: [], // Return empty array on error
    });
  }
});

// Register job handlers (once at module load time)
(() => {
  const queue = getJobQueue();
  queue.register('persist-chat', async ({ userId, chatId, force }: { userId: string; chatId: string; force: boolean }) => {
    console.log(`💾 [QUEUE] Persisting chat ${chatId} (force=${force})...`);
    const hybridMemoryService = getHybridMemoryService();
    if (force) {
      await hybridMemoryService.forceUpload(userId, chatId);
    } else {
      await hybridMemoryService.persistChatSession(userId, chatId);
    }
    await firestoreChatService.markChatPersisted(userId, chatId);
    console.log(`✅ [QUEUE] Chat ${chatId} persisted`);
  });
})();

// Queue stats endpoint for debugging
app.get('/api/queue-stats', rateLimitMiddleware('general'), (req, res) => {
  try {
    const stats = getJobQueue().getStats();
    return res.json({ success: true, stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Dead-letter inspection endpoint (debug only)
app.get('/api/queue-dead-letter', rateLimitMiddleware('general'), (req, res) => {
  try {
    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const limit = Number.isFinite(limitParam) && limitParam! > 0 ? limitParam! : 20;
    const dead = getJobQueue().getDeadLetter(limit);
    return res.json({ success: true, dead });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`✅ User profiles will be created dynamically from user data`);
});
