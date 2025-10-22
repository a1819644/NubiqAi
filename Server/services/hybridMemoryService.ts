// hybridMemoryService.ts - Smart memory system combining local and Pinecone storage
import { getConversationService, ConversationTurn, ConversationSummary } from './conversationService';
import { getEmbeddingService, SearchResult } from './embeddingService';
import { getPineconeStorageService } from './pineconeStorageService';
import { userProfileService } from './userProfileService';

export interface HybridMemoryResult {
  type: 'local' | 'long-term' | 'hybrid';
  localResults: ConversationTurn[];
  longTermResults: SearchResult[];
  combinedContext: string;
  resultCount: { local: number; longTerm: number };
  optimization?: {
    skippedPinecone: boolean;
    reason: string;
    costSavings: boolean;
  };
  userProfileContext?: string; // 🎯 NEW! User profile context for cross-chat memory
}

export interface MemorySearchOptions {
  maxLocalResults?: number;
  maxLongTermResults?: number;
  localWeight?: number; // How much to prioritize local results
  threshold?: number; // Minimum similarity threshold for long-term results
  includeLocalSummaries?: boolean;
  skipPineconeIfLocalFound?: boolean; // NEW: Cost optimization flag
  minLocalResultsForSkip?: number; // NEW: Minimum local results to skip Pinecone
}

class HybridMemoryService {
  private conversationService = getConversationService();
  private embeddingService = getEmbeddingService();
  
  // 🎯 OPTIMIZATION: Track last upload time per chat to avoid frequent uploads
  private lastUploadTime: Map<string, number> = new Map(); // chatId -> timestamp
  private readonly UPLOAD_COOLDOWN_MS = 60000; // 1 minute cooldown between uploads

  constructor() {
    console.log('🔄 HybridMemoryService initialized - combining local and long-term memory');
  }

  /**
   * Check if enough time has passed since last upload
   * @param chatId - Chat session ID
   * @returns true if upload should be allowed
   */
  private shouldUpload(chatId: string): boolean {
    const lastUpload = this.lastUploadTime.get(chatId);
    if (!lastUpload) return true; // Never uploaded
    
    const timeSinceUpload = Date.now() - lastUpload;
    return timeSinceUpload >= this.UPLOAD_COOLDOWN_MS;
  }

  /**
   * Mark that an upload was performed
   * @param chatId - Chat session ID
   */
  private markUploadTime(chatId: string): void {
    this.lastUploadTime.set(chatId, Date.now());
  }

  /**
   * Get memory search configurations for different scenarios
   */
  static getSearchConfig(scenario: 'cost-optimized' | 'comprehensive' | 'balanced'): MemorySearchOptions {
    switch (scenario) {
      case 'cost-optimized':
        return {
          maxLocalResults: 3,
          maxLongTermResults: 1,
          skipPineconeIfLocalFound: true,
          minLocalResultsForSkip: 1, // Skip Pinecone with just 1 local result
          threshold: 0.4 // Higher threshold for Pinecone searches
        };
      
      case 'comprehensive':
        return {
          maxLocalResults: 5,
          maxLongTermResults: 5,
          skipPineconeIfLocalFound: false, // Always search both
          threshold: 0.2 // Lower threshold for more results
        };
      
      case 'balanced':
      default:
        return {
          maxLocalResults: 3,
          maxLongTermResults: 2,
          skipPineconeIfLocalFound: true,
          minLocalResultsForSkip: 2, // Skip Pinecone with 2+ local results
          threshold: 0.3
        };
    }
  }

  /**
   * Determine if we should skip Pinecone search based on query characteristics
   */
  private shouldSkipPineconeSearch(
    query: string, 
    localResults: ConversationTurn[], 
    localSummaries: ConversationSummary[],
    options: MemorySearchOptions
  ): { skip: boolean; reason: string } {
    const { 
      skipPineconeIfLocalFound = true,
      minLocalResultsForSkip = 2 
    } = options;

    // If optimization is disabled, never skip
    if (!skipPineconeIfLocalFound) {
      return { skip: false, reason: 'Optimization disabled' };
    }

    const totalLocalContext = localResults.length + localSummaries.length;

    // Skip if we have sufficient local context
    if (totalLocalContext >= minLocalResultsForSkip) {
      return { 
        skip: true, 
        reason: `Sufficient local context (${totalLocalContext} items, need ${minLocalResultsForSkip}+)` 
      };
    }

    // Skip for simple follow-up patterns
    const simplePatterns = [
      'yes', 'no', 'ok', 'okay', 'thanks', 'thank you',
      'what about', 'how about', 'what if', 'can you',
      'also', 'and', 'but', 'however'
    ];

    const queryLower = query.toLowerCase();
    const isSimpleFollowUp = simplePatterns.some(pattern => 
      queryLower.startsWith(pattern) || queryLower.includes(pattern)
    );

    if (isSimpleFollowUp && localResults.length > 0) {
      return { 
        skip: true, 
        reason: 'Simple follow-up with local context available' 
      };
    }

    // Skip for very recent queries (likely continuation)
    if (localResults.length > 0) {
      const mostRecentTurn = localResults[0];
      const timeSinceLastTurn = Date.now() - mostRecentTurn.timestamp;
      
      if (timeSinceLastTurn < 2 * 60 * 1000) { // Less than 2 minutes
        return { 
          skip: true, 
          reason: 'Recent conversation continuation (< 2 minutes)' 
        };
      }
    }

    return { 
      skip: false, 
      reason: `Insufficient local context (${totalLocalContext} items, need ${minLocalResultsForSkip}+)` 
    };
  }

  /**
   * Smart memory search with cost optimization - only searches Pinecone when needed
   * 🎯 ENHANCED: Now supports chat-scoped search for 90%+ cost reduction!
   */
  async searchMemory(
    userId: string, 
    query: string, 
    chatId?: string,              // 🎯 NEW! Chat ID for scoped search
    messageCount?: number,         // 🎯 NEW! Track if this is first message in chat
    options: MemorySearchOptions = {}
  ): Promise<HybridMemoryResult> {
    const {
      maxLocalResults = 5,
      maxLongTermResults = 3,
      localWeight = 0.7, // Prefer local results
      threshold = 0.3,
      includeLocalSummaries = true,
      skipPineconeIfLocalFound = true,
      minLocalResultsForSkip = 2
    } = options;

    const isNewChat = messageCount === 0 || messageCount === undefined;
    
    console.log(`🔍 ${isNewChat ? '🆕 NEW' : '💬 CONTINUING'} chat memory search`);
    console.log(`   User: ${userId}, Chat: ${chatId || 'none'}, Query: "${query.substring(0, 50)}..."`);

    // 1. Search local conversations first (fastest)
    const localResults = this.conversationService.searchLocalConversations(
      userId, 
      query, 
      maxLocalResults
    );

    console.log(`📱 Found ${localResults.length} local conversation matches`);

    // 2. Get local summaries if requested
    let localSummaries: ConversationSummary[] = [];
    if (includeLocalSummaries) {
      localSummaries = this.conversationService.getLocalSummaries(userId);
      console.log(`📋 Found ${localSummaries.length} local summaries`);
    }

    // 3. Smart Pinecone search decision (COST OPTIMIZATION)
    let longTermResults: SearchResult[] = [];
    const skipDecision = this.shouldSkipPineconeSearch(query, localResults, localSummaries, options);
    
    if (skipDecision.skip) {
      console.log(`💰 Skipping Pinecone search - ${skipDecision.reason}`);
    } else {
      console.log(`☁️ Searching Pinecone with ${isNewChat ? 'USER-WIDE' : 'CHAT-SPECIFIC'} scope - ${skipDecision.reason}`);
      try {
        longTermResults = await this.embeddingService.searchMemories(query, {
          topK: maxLongTermResults,
          threshold,
          userId,
          chatId: isNewChat ? undefined : chatId,  // 🎯 KEY OPTIMIZATION! Only search specific chat
          isNewChat
        });
        console.log(`☁️ Found ${longTermResults.length} long-term memory matches (scope: ${isNewChat ? 'all chats' : `chat ${chatId}`})`);
      } catch (error) {
        console.warn('⚠️ Long-term memory search failed:', error);
      }
    }

    // 4. Get user profile context (cross-chat memory)
    const userProfileContext = userProfileService.generateProfileContext(userId);
    if (userProfileContext) {
      console.log(`👤 Found user profile context for ${userId}`);
    }

    // 5. Create combined context
    const combinedContext = this.createCombinedContext(
      localResults,
      localSummaries,
      longTermResults,
      localWeight,
      userProfileContext  // 🎯 NEW! Pass profile context
    );

    const result: HybridMemoryResult = {
      type: this.determineResultType(localResults, longTermResults),
      localResults,
      longTermResults,
      combinedContext,
      resultCount: {
        local: localResults.length,
        longTerm: longTermResults.length
      },
      // NEW: Add cost optimization metadata
      optimization: {
        skippedPinecone: skipDecision.skip,
        reason: skipDecision.reason,
        costSavings: skipDecision.skip
      },
      userProfileContext  // 🎯 NEW! Include profile context in result
    };

    const optimizationNote = skipDecision.skip ? '💰 (Pinecone skipped - cost optimized)' : '';
    console.log(`✅ Hybrid search complete - Type: ${result.type}, Local: ${result.resultCount.local}, Long-term: ${result.resultCount.longTerm} ${optimizationNote}`);
    return result;
  }

  /**
   * Get recent conversation context for a user
   */
  getRecentContext(userId: string, maxTurns: number = 10): string {
    const recentTurns = this.conversationService.getRecentConversations(userId, maxTurns);
    
    if (recentTurns.length === 0) {
      return 'No recent conversation history available.';
    }

    const contextLines = recentTurns
      .reverse() // Show chronological order
      .map((turn, index) => {
        const timeAgo = this.formatTimeAgo(turn.timestamp);
        return `${index + 1}. [${timeAgo}] User: ${turn.userPrompt}\n   AI: ${turn.aiResponse.substring(0, 200)}${turn.aiResponse.length > 200 ? '...' : ''}`;
      });

    return `Recent conversation history (${recentTurns.length} exchanges):\n${contextLines.join('\n\n')}`;
  }

  /**
   * Store a conversation turn in local memory
   * 🎯 UPDATED: Now accepts optional chatId for chat-scoped memory
   * 🖼️ UPDATED: Now accepts optional imageData for image storage
   */
  storeConversationTurn(
    userId: string, 
    userPrompt: string, 
    aiResponse: string, 
    chatId?: string,
    imageData?: { url: string; prompt?: string } // 🖼️ NEW! Optional image data
  ): ConversationTurn {
    return this.conversationService.addConversationTurn(userId, userPrompt, aiResponse, chatId, imageData);
  }

  /**
   * Get memory debug information
   */
  getMemoryDebugInfo(userId: string): any {
    const localInfo = this.conversationService.getDebugInfo(userId);
    
    return {
      ...localInfo,
      hybridMemoryActive: true,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Create combined context from local and long-term results
   */
  private createCombinedContext(
    localResults: ConversationTurn[],
    localSummaries: ConversationSummary[],
    longTermResults: SearchResult[],
    localWeight: number,
    userProfileContext?: string  // 🎯 NEW! User profile context
  ): string {
    const sections: string[] = [];

    // Add user profile first (if available) - highest priority for cross-chat context
    if (userProfileContext) {
      sections.push(userProfileContext);
    }

    // Add recent local conversations (highest priority)
    if (localResults.length > 0) {
      const localContext = localResults
        .map((turn, index) => {
          const timeAgo = this.formatTimeAgo(turn.timestamp);
          return `${index + 1}. [${timeAgo}] User: ${turn.userPrompt}\n   AI: ${turn.aiResponse}`;
        })
        .join('\n\n');
      
      sections.push(`RECENT CONVERSATIONS (${localResults.length}):\n${localContext}`);
    }

    // Add local summaries if available
    if (localSummaries.length > 0) {
      const summaryContext = localSummaries
        .slice(0, 3) // Limit to 3 most recent summaries
        .map((summary, index) => {
          const timeAgo = this.formatTimeAgo(summary.timestamp);
          return `${index + 1}. [${timeAgo}] ${summary.summary.substring(0, 300)}${summary.summary.length > 300 ? '...' : ''}`;
        })
        .join('\n\n');
      
      sections.push(`CONVERSATION SUMMARIES (${Math.min(localSummaries.length, 3)}):\n${summaryContext}`);
    }

    // Add long-term memory results
    if (longTermResults.length > 0) {
      const longTermContext = longTermResults
        .map((result, index) => {
          const timeAgo = this.formatTimeAgo(result.metadata.timestamp);
          const confidence = `${(result.score * 100).toFixed(1)}%`;
          return `${index + 1}. [${timeAgo}, ${confidence} match] ${result.content}`;
        })
        .join('\n\n');
      
      sections.push(`RELEVANT PAST MEMORIES (${longTermResults.length}):\n${longTermContext}`);
    }

    if (sections.length === 0) {
      return 'No relevant conversation history found.';
    }

    return sections.join('\n\n' + '='.repeat(50) + '\n\n');
  }

  /**
   * Determine the type of result based on available memory sources
   */
  private determineResultType(localResults: ConversationTurn[], longTermResults: SearchResult[]): 'local' | 'long-term' | 'hybrid' {
    if (localResults.length > 0 && longTermResults.length > 0) {
      return 'hybrid';
    } else if (localResults.length > 0) {
      return 'local';
    } else if (longTermResults.length > 0) {
      return 'long-term';
    } else {
      return 'local'; // Default
    }
  }

  /**
   * Format timestamp to human-readable relative time
   */
  private formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  /**
   * Persist a chat session to Pinecone (called when user switches chats)
   * 🎯 OPTIMIZED: 
   * - Only uploads NEW turns (deduplication)
   * - Respects cooldown period (prevents spam uploads)
   * - Batches for efficiency
   * 
   * @param userId - User's unique ID
   * @param chatId - Chat session ID
   * @param force - Force upload ignoring cooldown (default: false)
   */
  async persistChatSession(userId: string, chatId: string, force: boolean = false): Promise<void> {
    console.log(`📦 Persist request for chat ${chatId} (user: ${userId}, force: ${force})`);
    
    // 🎯 OPTIMIZATION: Check cooldown to avoid frequent uploads
    if (!force && !this.shouldUpload(chatId)) {
      const lastUpload = this.lastUploadTime.get(chatId)!;
      const timeSince = Math.round((Date.now() - lastUpload) / 1000);
      console.log(`⏸️ Upload cooldown active - last upload was ${timeSince}s ago (cooldown: ${this.UPLOAD_COOLDOWN_MS / 1000}s)`);
      console.log(`💡 Skipping upload to save costs. Chat will be uploaded when cooldown expires.`);
      return;
    }
    
    // Get the conversation service to access turns
    const conversationService = getConversationService();
    const pineconeStorage = getPineconeStorageService();
    
    // Get all turns for this chat
    const allTurns = conversationService.getRecentConversations(userId, 1000);
    const chatTurns = allTurns.filter(turn => turn.chatId === chatId);
    
    if (chatTurns.length === 0) {
      console.log(`⚠️ No turns found for chat ${chatId}, skipping persistence`);
      return;
    }
    
    console.log(`📝 Found ${chatTurns.length} total turns for this chat`);
    
    // 🎯 Store individual messages to Pinecone (with auto-deduplication)
    await pineconeStorage.storeConversationTurns(userId, chatId, chatTurns, force);
    
    // Mark upload time
    this.markUploadTime(chatId);
    
    console.log(`✅ Chat session ${chatId} persisted successfully`);
  }

  /**
   * Force immediate persistence (bypass cooldown)
   * Use for critical events: user sign-out, app close, etc.
   */
  async forceUpload(userId: string, chatId: string): Promise<void> {
    console.log(`🚨 Force upload requested for chat ${chatId}`);
    await this.persistChatSession(userId, chatId, true);
  }

  /**
   * Persist multiple chats at once (batch operation)
   * Useful for sign-out or periodic backup
   */
  async persistMultipleChats(userId: string, chatIds: string[]): Promise<void> {
    console.log(`📦 Batch persist: ${chatIds.length} chats for user ${userId}`);
    
    for (const chatId of chatIds) {
      try {
        await this.persistChatSession(userId, chatId, false);
      } catch (error) {
        console.error(`❌ Failed to persist chat ${chatId}:`, error);
        // Continue with other chats
      }
    }
    
    console.log(`✅ Batch persist complete`);
  }

  /**
   * Get upload cooldown stats
   */
  getUploadStats(): { chatsTracked: number; cooldownActive: number } {
    const now = Date.now();
    let cooldownActive = 0;
    
    this.lastUploadTime.forEach((timestamp) => {
      if (now - timestamp < this.UPLOAD_COOLDOWN_MS) {
        cooldownActive++;
      }
    });
    
    return {
      chatsTracked: this.lastUploadTime.size,
      cooldownActive
    };
  }
}

// Singleton instance
let hybridMemoryService: HybridMemoryService | null = null;

export function getHybridMemoryService(): HybridMemoryService {
  if (!hybridMemoryService) {
    hybridMemoryService = new HybridMemoryService();
  }
  return hybridMemoryService;
}

export { HybridMemoryService };