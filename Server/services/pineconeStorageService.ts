/**
 * Pinecone Storage Service
 * Optimized for storing individual chat messages (like local storage)
 * Designed to handle 100s of users with clean data organization
 */

import { getEmbeddingService, MemoryItem } from './embeddingService';
import type { ConversationTurn } from './conversationService';

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  turnId: string; // Links user message with assistant response
  imageUrl?: string; // 🖼️ NEW! Image URL or base64 data
  imagePrompt?: string; // 🎨 NEW! Original image generation prompt
  hasImage?: boolean; // 🖼️ NEW! Quick filter flag
}

export interface StoredChat {
  chatId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export class PineconeStorageService {
  private embeddingService = getEmbeddingService();
  
  // 🎯 OPTIMIZATION: Track what's already been uploaded to avoid duplicates
  private uploadedTurns: Map<string, Set<string>> = new Map(); // chatId -> Set of turnIds

  /**
   * Check if specific turns have already been uploaded to Pinecone
   * @param chatId - Chat session ID
   * @param turnIds - Array of turn IDs to check
   * @returns Array of turn IDs that need uploading
   */
  private getUnuploadedTurns(chatId: string, turnIds: string[]): string[] {
    if (!this.uploadedTurns.has(chatId)) {
      return turnIds; // Nothing uploaded yet, all are new
    }
    
    const uploaded = this.uploadedTurns.get(chatId)!;
    return turnIds.filter(id => !uploaded.has(id));
  }

  /**
   * Mark turns as uploaded to prevent duplicate uploads
   * @param chatId - Chat session ID
   * @param turnIds - Array of turn IDs that were uploaded
   */
  private markTurnsAsUploaded(chatId: string, turnIds: string[]): void {
    if (!this.uploadedTurns.has(chatId)) {
      this.uploadedTurns.set(chatId, new Set());
    }
    
    const uploaded = this.uploadedTurns.get(chatId)!;
    turnIds.forEach(id => uploaded.add(id));
  }

  /**
   * Store individual conversation turns to Pinecone
   * 🎯 OPTIMIZED: Only uploads NEW turns, skips already-uploaded ones
   * 
   * @param userId - User's unique ID
   * @param chatId - Chat session ID
   * @param turns - Array of conversation turns to store
   * @param force - Force upload even if already uploaded (default: false)
   */
  async storeConversationTurns(
    userId: string,
    chatId: string,
    turns: ConversationTurn[],
    force: boolean = false
  ): Promise<void> {
    if (turns.length === 0) {
      console.log(`⚠️ No turns to store, skipping upload`);
      return;
    }

    console.log(`💾 Preparing to store ${turns.length} conversation turns to Pinecone...`);
    console.log(`   📁 User: ${userId}, Chat: ${chatId}`);

    // 🎯 OPTIMIZATION: Filter out already-uploaded turns
    let turnsToUpload = turns;
    if (!force) {
      const unuploadedTurnIds = this.getUnuploadedTurns(
        chatId, 
        turns.map(t => t.id)
      );
      
      turnsToUpload = turns.filter(t => unuploadedTurnIds.includes(t.id));
      
      if (turnsToUpload.length === 0) {
        console.log(`✅ All turns already uploaded to Pinecone, skipping`);
        return;
      }
      
      if (turnsToUpload.length < turns.length) {
        console.log(`   🔍 Filtered: ${turns.length} total → ${turnsToUpload.length} new (${turns.length - turnsToUpload.length} already uploaded)`);
      }
    }

    const memoryItems: MemoryItem[] = [];

    for (const turn of turnsToUpload) {
      // Store user message
      const userMessageId = `${userId}:${chatId}:${turn.id}:user`;
      memoryItems.push({
        id: userMessageId,
        content: turn.userPrompt,
        metadata: {
          timestamp: turn.timestamp,
          type: 'conversation' as const,
          userId: userId,
          chatId: chatId,
          turnId: turn.id,
          role: 'user',
          source: 'chat-message',
          tags: ['user-message', chatId],
          isFirstMessage: turns.indexOf(turn) === 0, // Mark first message
          imageUrl: turn.imageUrl, // 🖼️ Store image if present
          imagePrompt: turn.imagePrompt, // 🎨 Store image prompt
          hasImage: turn.hasImage, // 🖼️ Quick filter flag
        }
      });

      // Store assistant message
      const assistantMessageId = `${userId}:${chatId}:${turn.id}:assistant`;
      memoryItems.push({
        id: assistantMessageId,
        content: turn.aiResponse,
        metadata: {
          timestamp: turn.timestamp,
          type: 'conversation' as const,
          userId: userId,
          chatId: chatId,
          turnId: turn.id,
          role: 'assistant',
          source: 'chat-message',
          tags: ['assistant-message', chatId],
          imageUrl: turn.imageUrl, // 🖼️ Store image if present (from AI response)
          hasImage: turn.hasImage, // 🖼️ Quick filter flag
        }
      });
    }

    // Batch store to Pinecone (100 at a time)
    await this.embeddingService.storeMemories(memoryItems);

    // Mark turns as uploaded
    this.markTurnsAsUploaded(chatId, turnsToUpload.map(t => t.id));

    console.log(`✅ Stored ${memoryItems.length} messages to Pinecone`);
    console.log(`   📊 Breakdown: ${turnsToUpload.length} user + ${turnsToUpload.length} assistant messages`);
    console.log(`   💡 Upload tracker: ${this.uploadedTurns.get(chatId)?.size || 0} total turns uploaded for this chat`);
  }

  /**
   * Retrieve chat history for a user from Pinecone
   * Returns data in the same format as local storage
   * 
   * @param userId - User's unique ID
   * @param limit - Maximum number of messages to retrieve
   * @returns Array of stored chats with messages
   */
  async getUserChats(userId: string, limit: number = 200): Promise<StoredChat[]> {
    console.log(`🔍 Retrieving chats for user: ${userId} (limit: ${limit})`);

    try {
      // Search for all user's messages using semantic search
      const searchResults = await this.embeddingService.searchMemories('user conversation messages', {
        topK: limit,
        userId: userId,
        threshold: 0.0, // Get all messages, don't filter by similarity
      });

      // Group messages by chatId
      const chatMap = new Map<string, StoredChat>();

      for (const result of searchResults) {
        const chatId = result.metadata.chatId;
        if (!chatId) continue;

        // Initialize chat if not exists
        if (!chatMap.has(chatId)) {
          chatMap.set(chatId, {
            chatId: chatId,
            userId: userId,
            title: '', // Will be set from first message
            messages: [],
            createdAt: result.metadata.timestamp || Date.now(),
            updatedAt: result.metadata.timestamp || Date.now(),
          });
        }

        const chat = chatMap.get(chatId)!;

        // Add message
        const message: ChatMessage = {
          id: result.id,
          chatId: chatId,
          userId: userId,
          role: (result.metadata.role as 'user' | 'assistant') || 'user',
          content: result.content,
          timestamp: result.metadata.timestamp || Date.now(),
          turnId: result.metadata.turnId || result.id,
          imageUrl: result.metadata.imageUrl, // 🖼️ Restore image data
          imagePrompt: result.metadata.imagePrompt, // 🎨 Restore image prompt
          hasImage: result.metadata.hasImage, // 🖼️ Restore image flag
        };

        chat.messages.push(message);

        // Update timestamps
        if (message.timestamp < chat.createdAt) {
          chat.createdAt = message.timestamp;
        }
        if (message.timestamp > chat.updatedAt) {
          chat.updatedAt = message.timestamp;
        }

        // Set title from first user message
        if (!chat.title && message.role === 'user' && result.metadata.isFirstMessage) {
          chat.title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
        }
      }

      // Convert to array and sort messages within each chat
      const chats = Array.from(chatMap.values()).map(chat => {
        // Sort messages by timestamp (ascending)
        chat.messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // If no title was set, use first message
        if (!chat.title && chat.messages.length > 0) {
          const firstUserMsg = chat.messages.find(m => m.role === 'user');
          if (firstUserMsg) {
            chat.title = firstUserMsg.content.substring(0, 50) + 
                        (firstUserMsg.content.length > 50 ? '...' : '');
          } else {
            chat.title = 'Untitled Chat';
          }
        }
        
        return chat;
      });

      // Sort chats by creation date (ascending - oldest first)
      chats.sort((a, b) => a.createdAt - b.createdAt);

      console.log(`✅ Retrieved ${chats.length} chats with ${searchResults.length} total messages`);
      return chats;

    } catch (error) {
      console.error('❌ Error retrieving user chats from Pinecone:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Get a specific chat's messages
   * 
   * @param userId - User's unique ID
   * @param chatId - Chat session ID
   * @returns Chat with all messages, or null if not found
   */
  async getChat(userId: string, chatId: string): Promise<StoredChat | null> {
    console.log(`🔍 Retrieving specific chat: ${chatId} for user: ${userId}`);

    try {
      // Search for messages in this specific chat
      const searchResults = await this.embeddingService.searchMemories('conversation', {
        topK: 500, // Get all messages in this chat
        userId: userId,
        chatId: chatId,
        threshold: 0.0,
      });

      if (searchResults.length === 0) {
        console.log(`⚠️ No messages found for chat ${chatId}`);
        return null;
      }

      const messages: ChatMessage[] = [];
      let createdAt = Date.now();
      let updatedAt = 0;
      let title = '';

      for (const result of searchResults) {
        const message: ChatMessage = {
          id: result.id,
          chatId: chatId,
          userId: userId,
          role: (result.metadata.role as 'user' | 'assistant') || 'user',
          content: result.content,
          timestamp: result.metadata.timestamp || Date.now(),
          turnId: result.metadata.turnId || result.id,
        };

        messages.push(message);

        // Update timestamps
        if (message.timestamp < createdAt) createdAt = message.timestamp;
        if (message.timestamp > updatedAt) updatedAt = message.timestamp;

        // Set title from first user message
        if (!title && message.role === 'user' && result.metadata.isFirstMessage) {
          title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
        }
      }

      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);

      // Set title if not found
      if (!title && messages.length > 0) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        title = firstUserMsg 
          ? firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
          : 'Untitled Chat';
      }

      console.log(`✅ Retrieved chat ${chatId} with ${messages.length} messages`);

      return {
        chatId,
        userId,
        title,
        messages,
        createdAt,
        updatedAt,
      };

    } catch (error) {
      console.error(`❌ Error retrieving chat ${chatId}:`, error);
      return null;
    }
  }

  /**
   * Delete a specific chat and all its messages
   * 
   * @param userId - User's unique ID
   * @param chatId - Chat session ID
   */
  async deleteChat(userId: string, chatId: string): Promise<void> {
    console.log(`🗑️ Deleting chat ${chatId} for user ${userId}...`);

    try {
      const index = await this.embeddingService.getIndex();
      
      // Delete all vectors with this chatId
      // Note: Pinecone supports metadata filtering for deletes
      await index.namespace('').deleteMany({
        chatId: chatId,
        userId: userId,
      });

      // Clear from upload tracker
      this.uploadedTurns.delete(chatId);

      console.log(`✅ Deleted chat ${chatId} from Pinecone`);
    } catch (error) {
      console.error(`❌ Error deleting chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Clear upload tracking for a specific chat
   * Use this when you want to force re-upload
   * 
   * @param chatId - Chat session ID to clear
   */
  clearUploadTracker(chatId?: string): void {
    if (chatId) {
      this.uploadedTurns.delete(chatId);
      console.log(`🔄 Cleared upload tracker for chat: ${chatId}`);
    } else {
      this.uploadedTurns.clear();
      console.log(`🔄 Cleared ALL upload trackers`);
    }
  }

  /**
   * Get upload statistics
   */
  getUploadStats(): { totalChatsTracked: number; totalTurnsTracked: number } {
    let totalTurns = 0;
    this.uploadedTurns.forEach(set => totalTurns += set.size);
    
    return {
      totalChatsTracked: this.uploadedTurns.size,
      totalTurnsTracked: totalTurns
    };
  }

  /**
   * Delete ALL data for a user (GDPR compliance)
   * 
   * @param userId - User's unique ID
   */
  async deleteUserData(userId: string): Promise<void> {
    console.log(`🗑️ Deleting ALL data for user ${userId}...`);

    try {
      const index = await this.embeddingService.getIndex();
      
      // Delete all vectors for this user
      await index.namespace('').deleteMany({
        userId: userId,
      });

      console.log(`✅ Deleted all data for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error deleting user data for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get storage statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalChats: number;
    totalMessages: number;
    oldestMessage: number;
    newestMessage: number;
  }> {
    const chats = await this.getUserChats(userId, 1000);
    const totalMessages = chats.reduce((sum, chat) => sum + chat.messages.length, 0);
    
    let oldestMessage = Date.now();
    let newestMessage = 0;

    chats.forEach(chat => {
      if (chat.createdAt < oldestMessage) oldestMessage = chat.createdAt;
      if (chat.updatedAt > newestMessage) newestMessage = chat.updatedAt;
    });

    return {
      totalChats: chats.length,
      totalMessages,
      oldestMessage,
      newestMessage,
    };
  }
}

// Singleton instance
let pineconeStorageService: PineconeStorageService | null = null;

export function getPineconeStorageService(): PineconeStorageService {
  if (!pineconeStorageService) {
    pineconeStorageService = new PineconeStorageService();
  }
  return pineconeStorageService;
}
