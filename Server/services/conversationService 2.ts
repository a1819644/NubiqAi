// conversationService.ts - Local conversation storage and summarization
import { GoogleGenAI } from '@google/genai';
import { getEmbeddingService, MemoryItem } from './embeddingService';

export interface ConversationTurn {
  id: string;
  userPrompt: string;
  aiResponse: string;
  timestamp: number;
  userId: string;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  turns: ConversationTurn[];
  startTime: number;
  lastActivity: number;
  isSummarized: boolean;
}

export interface ConversationSummary {
  sessionId: string;
  userId: string;
  summary: string;
  keyTopics: string[];
  turnCount: number;
  timespan: { start: number; end: number };
  timestamp: number;
}

class ConversationService {
  private conversations: Map<string, ConversationSession> = new Map();
  private summaries: Map<string, ConversationSummary> = new Map();
  private ai: GoogleGenAI | undefined;
  private summarizationInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize Gemini client for summarization
    if (process.env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    
    // Start the periodic summarization process
    this.startPeriodicSummarization();
    console.log('🧠 ConversationService initialized with local memory and periodic summarization');
  }

  /**
   * Add a new conversation turn to local memory
   */
  addConversationTurn(userId: string, userPrompt: string, aiResponse: string): ConversationTurn {
    const sessionId = this.getActiveSessionId(userId);
    const turn: ConversationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userPrompt,
      aiResponse,
      timestamp: Date.now(),
      userId
    };

    let session = this.conversations.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        userId,
        turns: [],
        startTime: Date.now(),
        lastActivity: Date.now(),
        isSummarized: false
      };
      this.conversations.set(sessionId, session);
      console.log(`📝 Created new conversation session: ${sessionId} for user: ${userId}`);
    }

    session.turns.push(turn);
    session.lastActivity = Date.now();

    console.log(`💬 Added turn to session ${sessionId}: ${userPrompt.substring(0, 50)}...`);
    return turn;
  }

  /**
   * Get recent conversations for a user (local memory)
   */
  getRecentConversations(userId: string, maxTurns: number = 10): ConversationTurn[] {
    const allTurns: ConversationTurn[] = [];
    
    // Get all conversations for this user
    for (const session of this.conversations.values()) {
      if (session.userId === userId) {
        allTurns.push(...session.turns);
      }
    }

    // Sort by timestamp (most recent first) and limit
    return allTurns
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxTurns);
  }

  /**
   * Get local conversation summaries for a user
   */
  getLocalSummaries(userId: string): ConversationSummary[] {
    return Array.from(this.summaries.values())
      .filter(summary => summary.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Search recent conversations locally
   */
  searchLocalConversations(userId: string, query: string, maxResults: number = 5): ConversationTurn[] {
    const recentTurns = this.getRecentConversations(userId, 50); // Search in last 50 turns
    const queryLower = query.toLowerCase();
    
    return recentTurns
      .filter(turn => 
        turn.userPrompt.toLowerCase().includes(queryLower) ||
        turn.aiResponse.toLowerCase().includes(queryLower)
      )
      .slice(0, maxResults);
  }

  /**
   * Get or create active session ID for a user
   */
  private getActiveSessionId(userId: string): string {
    const now = Date.now();
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    // Find existing active session
    for (const session of this.conversations.values()) {
      if (session.userId === userId && 
          (now - session.lastActivity) < sessionTimeout &&
          !session.isSummarized) {
        return session.sessionId;
      }
    }

    // Create new session ID
    return `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the periodic summarization process (every 10 minutes)
   */
  private startPeriodicSummarization(): void {
    this.summarizationInterval = setInterval(() => {
      this.summarizeAndUploadConversations();
    }, 10 * 60 * 1000); // 10 minutes

    console.log('⏰ Started periodic summarization (every 10 minutes)');
  }

  /**
   * Summarize old conversations and upload to Pinecone
   */
  private async summarizeAndUploadConversations(): Promise<void> {
    try {
      const now = Date.now();
      const summarizationAge = 10 * 60 * 1000; // 10 minutes old
      const conversationsToSummarize: ConversationSession[] = [];

      // Find conversations that need summarization
      for (const session of this.conversations.values()) {
        if (!session.isSummarized && 
            session.turns.length > 0 && 
            (now - session.lastActivity) > summarizationAge) {
          conversationsToSummarize.push(session);
        }
      }

      if (conversationsToSummarize.length === 0) {
        console.log('📊 No conversations ready for summarization');
        return;
      }

      console.log(`📋 Summarizing ${conversationsToSummarize.length} conversation sessions...`);

      for (const session of conversationsToSummarize) {
        try {
          await this.summarizeAndUploadSession(session);
          session.isSummarized = true;
          console.log(`✅ Summarized session: ${session.sessionId}`);
        } catch (error) {
          console.error(`❌ Failed to summarize session ${session.sessionId}:`, error);
        }
      }

      // Clean up old summarized conversations
      this.cleanupOldConversations();

    } catch (error) {
      console.error('❌ Error in periodic summarization:', error);
    }
  }

  /**
   * Summarize a single session and upload to Pinecone
   */
  private async summarizeAndUploadSession(session: ConversationSession): Promise<void> {
    if (!this.ai) {
      throw new Error('Gemini AI not initialized for summarization');
    }

    // Prepare conversation text for summarization
    const conversationText = session.turns
      .map(turn => `User: ${turn.userPrompt}\nAI: ${turn.aiResponse}`)
      .join('\n\n');

    // Create summarization prompt
    const summarizationPrompt = `Please analyze this conversation and provide a comprehensive summary.

Conversation:
${conversationText}

Please provide:
1. A detailed summary of the main topics discussed
2. Key information the user shared about themselves
3. Important preferences or requirements mentioned
4. Any technical details or specific requests
5. The overall context and purpose of the conversation

Format as a structured summary that would be useful for future conversations with this user.`;

    // Generate summary using Gemini
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [summarizationPrompt]
    });

    const summaryText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    
    if (!summaryText) {
      throw new Error('Failed to generate conversation summary');
    }

    // Extract key topics (AI-based with keyword fallback)
    const keyTopics = await this.extractKeyTopics(conversationText);

    // Create summary object
    const summary: ConversationSummary = {
      sessionId: session.sessionId,
      userId: session.userId,
      summary: summaryText,
      keyTopics,
      turnCount: session.turns.length,
      timespan: {
        start: session.startTime,
        end: session.lastActivity
      },
      timestamp: Date.now()
    };

    // Store summary locally
    this.summaries.set(session.sessionId, summary);

    // Upload to Pinecone for long-term storage
    const embeddingService = getEmbeddingService();
    const memoryItem: MemoryItem = {
      id: `summary_${session.sessionId}`,
      content: `Conversation Summary (${session.turns.length} exchanges): ${summaryText}`,
      metadata: {
        timestamp: Date.now(),
        type: 'conversation_summary',
        source: 'local_summarization',
        userId: session.userId,
        tags: ['conversation-summary', 'auto-generated', ...keyTopics],
        sessionId: session.sessionId,
        turnCount: session.turns.length,
        timespanStart: summary.timespan.start,
        timespanEnd: summary.timespan.end
      }
    };

    await embeddingService.storeMemory(memoryItem);
    
    console.log(`📤 Uploaded conversation summary to Pinecone: ${session.sessionId} (${session.turns.length} turns)`);
  }

  /**
   * Extract topics from document content (can be used when processing documents)
   */
  async extractDocumentTopics(documentContent: string): Promise<string[]> {
    if (!this.ai) {
      return this.extractKeyTopicsKeywordBased(documentContent);
    }

    try {
      const documentTopicPrompt = `Analyze this document content and extract 3-6 key topics that describe what the document is about.

Document Content:
${documentContent.substring(0, 2000)}${documentContent.length > 2000 ? '...' : ''}

Please provide ONLY a comma-separated list of topics (lowercase, hyphenated). Focus on:
- Main subject matter
- Document type (e.g., contract, manual, report, specifications)
- Industry or domain
- Key concepts covered

Examples: business-contract, technical-documentation, user-manual, financial-report, project-specifications, legal-agreement

Topics:`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [documentTopicPrompt]
      });

      const aiTopics = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      
      if (aiTopics) {
        const extractedTopics = aiTopics
          .split(',')
          .map(topic => topic.trim().toLowerCase())
          .filter(topic => topic.length > 2 && topic.length < 30)
          .slice(0, 6);

        if (extractedTopics.length > 0) {
          console.log(`📄 Document topics extracted: ${extractedTopics.join(', ')}`);
          return extractedTopics;
        }
      }
    } catch (error) {
      console.warn('⚠️ Document topic extraction failed, using keyword fallback:', error);
    }

    return this.extractKeyTopicsKeywordBased(documentContent);
  }

  /**
   * Extract key topics from conversation text using AI-based analysis
   */
  private async extractKeyTopics(conversationText: string): Promise<string[]> {
    // Fallback keyword-based extraction if AI fails
    const fallbackTopics = this.extractKeyTopicsKeywordBased(conversationText);

    // Try AI-based topic extraction first
    if (this.ai) {
      try {
        const topicExtractionPrompt = `Analyze this conversation and extract 3-5 key topics that best describe what was discussed. 

Conversation:
${conversationText}

Please provide ONLY a comma-separated list of topics (lowercase, hyphenated). Focus on:
- Main subject areas discussed
- Technical domains involved  
- Types of tasks or problems addressed
- Learning or development areas

Examples of good topics: programming, web-development, ai-chatbots, debugging, project-planning, learning-concepts, data-analysis, ui-design

Topics:`;

        const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [topicExtractionPrompt]
        });

        const aiTopics = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
        
        if (aiTopics) {
          // Parse AI response and clean up topics
          const extractedTopics = aiTopics
            .split(',')
            .map(topic => topic.trim().toLowerCase())
            .filter(topic => topic.length > 2 && topic.length < 30) // Valid topic length
            .slice(0, 5); // Limit to 5 topics

          if (extractedTopics.length > 0) {
            console.log(`🤖 AI extracted topics: ${extractedTopics.join(', ')}`);
            return extractedTopics;
          }
        }
      } catch (error) {
        console.warn('⚠️ AI topic extraction failed, using keyword fallback:', error);
      }
    }

    // Fallback to keyword-based extraction
    console.log(`🔤 Using keyword-based topic extraction: ${fallbackTopics.join(', ')}`);
    return fallbackTopics;
  }

  /**
   * Fallback keyword-based topic extraction (original method)
   */
  private extractKeyTopicsKeywordBased(conversationText: string): string[] {
    const text = conversationText.toLowerCase();
    const topics: string[] = [];

    // Enhanced keyword detection with more categories
    const topicKeywords = {
      'programming': ['code', 'programming', 'javascript', 'python', 'typescript', 'function', 'api', 'algorithm', 'syntax'],
      'ai-development': ['ai', 'model', 'gemini', 'pinecone', 'embedding', 'memory', 'chat', 'machine-learning', 'neural'],
      'web-development': ['react', 'html', 'css', 'website', 'frontend', 'backend', 'server', 'responsive', 'framework'],
      'project-work': ['project', 'build', 'create', 'develop', 'implement', 'feature', 'planning', 'architecture'],
      'learning': ['learn', 'understand', 'explain', 'how', 'what', 'why', 'tutorial', 'concept', 'theory'],
      'debugging': ['error', 'bug', 'fix', 'debug', 'problem', 'issue', 'troubleshoot', 'exception', 'crash'],
      'data-analysis': ['data', 'analysis', 'database', 'query', 'analytics', 'visualization', 'chart', 'metrics'],
      'ui-design': ['design', 'ui', 'ux', 'interface', 'user', 'layout', 'component', 'styling', 'visual'],
      'deployment': ['deploy', 'deployment', 'production', 'hosting', 'server', 'cloud', 'docker', 'container'],
      'documentation': ['documentation', 'docs', 'readme', 'guide', 'manual', 'specification', 'comment']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        topics.push(topic);
      }
    }

    return topics.length > 0 ? topics : ['general'];
  }

  /**
   * Clean up old summarized conversations to free memory
   */
  private cleanupOldConversations(): void {
    const now = Date.now();
    const cleanupAge = 7 * 24 * 60 * 60 * 1000; // 7 days (1 week)
    let cleanedCount = 0;

    for (const [sessionId, session] of this.conversations.entries()) {
      if (session.isSummarized && (now - session.lastActivity) > cleanupAge) {
        this.conversations.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old conversation sessions (older than 1 week)`);
    }
  }

  /**
   * Get debug information about local memory state
   */
  getDebugInfo(userId?: string): any {
    const totalConversations = this.conversations.size;
    const totalSummaries = this.summaries.size;
    
    let userConversations = 0;
    let userSummaries = 0;
    let totalTurns = 0;

    if (userId) {
      for (const session of this.conversations.values()) {
        if (session.userId === userId) {
          userConversations++;
          totalTurns += session.turns.length;
        }
      }
      
      for (const summary of this.summaries.values()) {
        if (summary.userId === userId) {
          userSummaries++;
        }
      }
    }

    return {
      totalConversations,
      totalSummaries,
      userSpecific: userId ? {
        userId,
        conversations: userConversations,
        summaries: userSummaries,
        totalTurns
      } : null,
      memoryUsage: {
        conversations: `${Math.round(JSON.stringify([...this.conversations.values()]).length / 1024)} KB`,
        summaries: `${Math.round(JSON.stringify([...this.summaries.values()]).length / 1024)} KB`
      }
    };
  }

  /**
   * Stop the summarization interval (cleanup)
   */
  destroy(): void {
    if (this.summarizationInterval) {
      clearInterval(this.summarizationInterval);
      this.summarizationInterval = null;
      console.log('🛑 Stopped periodic summarization');
    }
  }
}

// Singleton instance
let conversationService: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!conversationService) {
    conversationService = new ConversationService();
  }
  return conversationService;
}

// Export topic extraction for document processing
export async function extractDocumentTopics(documentContent: string): Promise<string[]> {
  const service = getConversationService();
  return service.extractDocumentTopics(documentContent);
}

export { ConversationService };