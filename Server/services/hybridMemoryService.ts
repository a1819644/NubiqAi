// hybridMemoryService.ts - Smart memory system combining local and Pinecone storage
import { getConversationService, ConversationTurn, ConversationSummary } from './conversationService';
import { getEmbeddingService, SearchResult } from './embeddingService';

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

  constructor() {
    console.log('🔄 HybridMemoryService initialized - combining local and long-term memory');
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
   */
  async searchMemory(
    userId: string, 
    query: string, 
    options: MemorySearchOptions = {}
  ): Promise<HybridMemoryResult> {
    const {
      maxLocalResults = 5,
      maxLongTermResults = 3,
      localWeight = 0.7, // Prefer local results
      threshold = 0.3,
      includeLocalSummaries = true,
      skipPineconeIfLocalFound = true, // NEW: Cost optimization enabled by default
      minLocalResultsForSkip = 2 // NEW: Skip Pinecone if we have 2+ local results
    } = options;

    console.log(`🔍 Hybrid memory search for user: ${userId}, query: "${query.substring(0, 50)}..."`);

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
      console.log(`☁️ Searching Pinecone - ${skipDecision.reason}`);
      try {
        longTermResults = await this.embeddingService.searchMemories(query, {
          topK: maxLongTermResults,
          threshold,
          userId
        });
        console.log(`☁️ Found ${longTermResults.length} long-term memory matches`);
      } catch (error) {
        console.warn('⚠️ Long-term memory search failed:', error);
      }
    }

    // 4. Create combined context
    const combinedContext = this.createCombinedContext(
      localResults,
      localSummaries,
      longTermResults,
      localWeight
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
      }
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
   * Store a new conversation turn in local memory
   */
  storeConversationTurn(userId: string, userPrompt: string, aiResponse: string): ConversationTurn {
    return this.conversationService.addConversationTurn(userId, userPrompt, aiResponse);
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
    localWeight: number
  ): string {
    const sections: string[] = [];

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